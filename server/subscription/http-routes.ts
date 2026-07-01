import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { licenseActivations, licenses, subscriptions, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import type { PlanType, SubscriptionState } from "../../shared/subscription";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";

type RevenueCatWebhookPayload = {
  event?: {
    type?: string;
    app_user_id?: string;
    product_id?: string;
    expiration_at_ms?: number | string | null;
    purchased_at_ms?: number | string | null;
    original_transaction_id?: string | null;
    aliases?: string[];
  };
};

function normalizeSubjectKey(rawValue: string): string {
  const value = rawValue.trim();
  if (!value) return "";
  if (value.startsWith("openid:") || value.startsWith("device:")) return value;
  return `openid:${value}`;
}

function getSubjectKey(req: { headers: Record<string, unknown> }): string | null {
  const openId = typeof req.headers["x-open-id"] === "string" ? req.headers["x-open-id"].trim() : "";
  if (openId) return `openid:${openId}`;

  const deviceId = typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"].trim() : "";
  if (deviceId) return `device:${deviceId}`;

  return null;
}

function defaultState(): SubscriptionState {
  return {
    plan: "free",
    expiresAt: null,
    subscribedAt: null,
    isSimulated: false,
  };
}

function isExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= Date.now();
}

function toDateFromMs(ms: number | string | null | undefined): Date | null {
  if (ms === null || ms === undefined) return null;
  const num = typeof ms === "string" ? Number(ms) : ms;
  if (!Number.isFinite(num)) return null;
  return new Date(num);
}

function mapPlanFromProductId(productId: string | undefined): PlanType {
  const raw = (productId ?? "").toLowerCase();
  if (!raw) return "pro";
  if (raw.includes("annual") || raw.includes("anual") || raw.includes("year")) return "annual";
  return "pro";
}

function mapStatusFromEventType(eventType: string | undefined): "active" | "canceled" | "expired" {
  const type = (eventType ?? "").toUpperCase();
  if (type.includes("EXPIRATION")) return "expired";
  if (type.includes("CANCELLATION") || type.includes("BILLING_ISSUE")) return "canceled";
  return "active";
}

function isRevenueCatWebhookAuthorized(req: { headers: Record<string, unknown> }): boolean {
  const expected = ENV.revenueCatWebhookSecret.trim();
  if (!expected) return true;

  const authHeader = typeof req.headers["authorization"] === "string" ? req.headers["authorization"] : "";
  const xAuthHeader = typeof req.headers["x-authorization"] === "string" ? req.headers["x-authorization"] : "";
  const candidates = [authHeader, xAuthHeader].filter(Boolean);

  return candidates.some((value) => {
    const normalized = value.startsWith("Bearer ") ? value.slice(7).trim() : value.trim();
    return normalized === expected;
  });
}

function normalizeLicenseCode(rawValue: string): string {
  return rawValue.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function formatLicenseCode(rawValue: string): string {
  const normalized = normalizeLicenseCode(rawValue);
  const groups: string[] = [];
  for (let i = 0; i < normalized.length; i += 4) {
    groups.push(normalized.slice(i, i + 4));
  }
  return groups.join("-");
}

function hashLicenseCode(normalizedCode: string): string {
  return createHash("sha256").update(normalizedCode).digest("hex");
}

function randomBlock(size = 4): string {
  return randomBytes(size).toString("hex").toUpperCase();
}

function generateLicenseCode(plan: "pro" | "annual"): string {
  const prefix = plan === "annual" ? "AN" : "PRO";
  return `${prefix}${randomBlock(2)}${randomBlock(2)}${randomBlock(2)}`;
}

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function buildSubscriptionState(params: {
  plan: PlanType;
  expiresAt: Date | null;
  subscribedAt: Date | null;
}): SubscriptionState {
  return {
    plan: params.plan,
    expiresAt: toIsoOrNull(params.expiresAt),
    subscribedAt: toIsoOrNull(params.subscribedAt),
    isSimulated: true,
  };
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data de expiração inválida");
  }
  return parsed;
}

async function authenticateAdmin(req: any, res: any): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      res.status(403).json({ ok: false, message: "Acesso negado. Apenas admin." });
      return null;
    }
    return user;
  } catch {
    res.status(401).json({ ok: false, message: "Autenticação obrigatória." });
    return null;
  }
}

async function upsertSubscriptionFromLicense(params: {
  subjectKey: string;
  plan: Exclude<PlanType, "free">;
  expiresAt: Date | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Banco indisponível para ativação de licença");
  }

  const now = new Date();
  await db
    .insert(subscriptions)
    .values({
      subjectKey: params.subjectKey,
      plan: params.plan,
      status: "active",
      store: "manual",
      subscribedAt: now,
      expiresAt: params.expiresAt,
    })
    .onDuplicateKeyUpdate({
      set: {
        plan: params.plan,
        status: "active",
        store: "manual",
        subscribedAt: now,
        expiresAt: params.expiresAt,
      },
    });

  return buildSubscriptionState({
    plan: params.plan,
    subscribedAt: now,
    expiresAt: params.expiresAt,
  });
}

export function registerSubscriptionHttpRoutes(): Router {
  const router = Router();

  router.post("/license/create", async (req, res) => {
    try {
      const admin = await authenticateAdmin(req as any, res);
      if (!admin) return;

      const rawPlan = typeof req.body?.plan === "string" ? req.body.plan : "";
      const plan = rawPlan === "pro" || rawPlan === "annual" ? rawPlan : null;
      if (!plan) {
        res.status(400).json({ ok: false, message: "Plano inválido. Use 'pro' ou 'annual'." });
        return;
      }

      const maxActivationsRaw = Number(req.body?.maxActivations ?? 1);
      const maxActivations = Number.isInteger(maxActivationsRaw) && maxActivationsRaw > 0
        ? maxActivationsRaw
        : 1;

      const expiresAt = parseOptionalDate(req.body?.expiresAt);

      const db = await getDb();
      if (!db) {
        res.status(503).json({ ok: false, message: "Banco indisponível para gerar licença" });
        return;
      }

      let createdCode = "";
      let createdHash = "";

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = generateLicenseCode(plan);
        const normalized = normalizeLicenseCode(candidate);
        const hash = hashLicenseCode(normalized);
        const [existing] = await db.select().from(licenses).where(eq(licenses.codeHash, hash)).limit(1);
        if (existing) continue;
        createdCode = candidate;
        createdHash = hash;
        break;
      }

      if (!createdCode || !createdHash) {
        res.status(500).json({ ok: false, message: "Falha ao gerar código de licença único" });
        return;
      }

      await db.insert(licenses).values({
        codeHash: createdHash,
        codeHint: createdCode.slice(-4),
        plan,
        status: "active",
        maxActivations,
        usedCount: 0,
        expiresAt,
        createdByOpenId: admin.openId,
      });

      res.status(201).json({
        ok: true,
        data: {
          code: formatLicenseCode(createdCode),
          codeHint: createdCode.slice(-4),
          plan,
          maxActivations,
          expiresAt: toIsoOrNull(expiresAt),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao criar licença";
      res.status(400).json({ ok: false, message });
    }
  });

  router.get("/license/list", async (req, res) => {
    try {
      const admin = await authenticateAdmin(req as any, res);
      if (!admin) return;

      const db = await getDb();
      if (!db) {
        res.status(503).json({ ok: false, message: "Banco indisponível para listar licenças" });
        return;
      }

      const rows = await db.select().from(licenses);
      res.json({
        ok: true,
        data: rows.map((row) => ({
          id: row.id,
          codeHint: row.codeHint,
          plan: row.plan,
          status: row.status,
          maxActivations: row.maxActivations,
          usedCount: row.usedCount,
          expiresAt: toIsoOrNull(row.expiresAt),
          createdAt: row.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao listar licenças";
      res.status(400).json({ ok: false, message });
    }
  });

  router.post("/license/revoke", async (req, res) => {
    try {
      const admin = await authenticateAdmin(req as any, res);
      if (!admin) return;

      const idRaw = Number(req.body?.licenseId);
      if (!Number.isInteger(idRaw) || idRaw <= 0) {
        res.status(400).json({ ok: false, message: "licenseId inválido" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ ok: false, message: "Banco indisponível para revogar licença" });
        return;
      }

      await db
        .update(licenses)
        .set({ status: "revoked" })
        .where(eq(licenses.id, idRaw));

      res.status(200).json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao revogar licença";
      res.status(400).json({ ok: false, message });
    }
  });

  router.post("/license/activate", async (req, res) => {
    try {
      const subjectKey = getSubjectKey(req as any);
      if (!subjectKey) {
        res.status(400).json({ ok: false, message: "Identificação do usuário/dispositivo é obrigatória" });
        return;
      }

      const rawCode = typeof req.body?.code === "string" ? req.body.code : "";
      const normalizedCode = normalizeLicenseCode(rawCode);
      if (!normalizedCode) {
        res.status(400).json({ ok: false, message: "Informe uma chave de ativação válida" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ ok: false, message: "Banco indisponível para ativar licença" });
        return;
      }

      const codeHash = hashLicenseCode(normalizedCode);
      const [license] = await db.select().from(licenses).where(eq(licenses.codeHash, codeHash)).limit(1);

      if (!license) {
        res.status(404).json({ ok: false, message: "Chave de ativação não encontrada" });
        return;
      }

      const expiredByDate = Boolean(license.expiresAt && license.expiresAt.getTime() <= Date.now());
      if (expiredByDate && license.status !== "expired") {
        await db
          .update(licenses)
          .set({ status: "expired" })
          .where(eq(licenses.id, license.id));
      }

      if (license.status === "revoked" || expiredByDate || license.status === "expired") {
        res.status(409).json({ ok: false, message: "Esta chave está revogada ou expirada" });
        return;
      }

      const [currentActivation] = await db
        .select()
        .from(licenseActivations)
        .where(and(eq(licenseActivations.licenseId, license.id), eq(licenseActivations.subjectKey, subjectKey)))
        .limit(1);

      if (!currentActivation) {
        const allActivations = await db
          .select()
          .from(licenseActivations)
          .where(eq(licenseActivations.licenseId, license.id));

        if (allActivations.length >= license.maxActivations) {
          res.status(409).json({ ok: false, message: "Esta chave já foi usada em outro aparelho" });
          return;
        }

        await db.insert(licenseActivations).values({
          licenseId: license.id,
          subjectKey,
        });

        await db
          .update(licenses)
          .set({ usedCount: allActivations.length + 1 })
          .where(eq(licenses.id, license.id));
      }

      const nextState = await upsertSubscriptionFromLicense({
        subjectKey,
        plan: license.plan,
        expiresAt: license.expiresAt ?? null,
      });

      res.status(200).json({ ok: true, data: nextState });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao ativar licença";
      res.status(400).json({ ok: false, message });
    }
  });

  router.post("/webhook/revenuecat", async (req, res) => {
    try {
      if (!isRevenueCatWebhookAuthorized(req as any)) {
        res.status(401).json({ ok: false, message: "Webhook RevenueCat nao autorizado" });
        return;
      }

      const payload = req.body as RevenueCatWebhookPayload;
      const event = payload?.event;
      if (!event) {
        res.status(400).json({ ok: false, message: "Payload do webhook invalido" });
        return;
      }

      const subjectKey = normalizeSubjectKey(event.app_user_id ?? event.aliases?.[0] ?? "");
      if (!subjectKey) {
        res.status(200).json({ ok: true, ignored: true, reason: "app_user_id ausente" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ ok: false, message: "Banco indisponivel para processar webhook" });
        return;
      }

      const status = mapStatusFromEventType(event.type);
      const subscribedAt = toDateFromMs(event.purchased_at_ms);
      const expiresAt = toDateFromMs(event.expiration_at_ms);
      const plan = status === "expired" ? "free" : mapPlanFromProductId(event.product_id);

      await db
        .insert(subscriptions)
        .values({
          subjectKey,
          plan,
          status,
          store: "revenuecat",
          externalSubscriptionId: event.original_transaction_id ?? null,
          subscribedAt,
          expiresAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            plan,
            status,
            store: "revenuecat",
            externalSubscriptionId: event.original_transaction_id ?? null,
            subscribedAt,
            expiresAt,
          },
        });

      res.status(200).json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar webhook da RevenueCat";
      res.status(400).json({ ok: false, message });
    }
  });

  router.get("/status", async (req, res) => {
    try {
      const subjectKey = getSubjectKey(req as any);
      if (!subjectKey) {
        res.json({ ok: true, data: defaultState() });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.json({ ok: true, data: defaultState() });
        return;
      }

      const [row] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.subjectKey, subjectKey))
        .limit(1);

      if (!row) {
        res.json({ ok: true, data: defaultState() });
        return;
      }

      const expired = isExpired(row.expiresAt ?? null);
      const plan: PlanType = expired ? "free" : row.plan;
      const data: SubscriptionState = {
        plan,
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        subscribedAt: row.subscribedAt ? row.subscribedAt.toISOString() : null,
        isSimulated: row.store === "manual",
      };

      // Auto-ajuste simples de status quando expirado.
      if (expired && row.status !== "expired") {
        await db
          .update(subscriptions)
          .set({
            status: "expired",
            plan: "free",
          })
          .where(eq(subscriptions.id, row.id));
      }

      res.json({ ok: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao obter assinatura";
      res.status(400).json({ ok: false, message });
    }
  });

  router.post("/activate-demo", async (req, res) => {
    try {
      const subjectKey = getSubjectKey(req as any);
      if (!subjectKey) {
        res.status(400).json({ ok: false, message: "Identificacao do usuario/dispositivo e obrigatoria" });
        return;
      }

      const rawPlan = typeof req.body?.plan === "string" ? req.body.plan : "";
      const plan = (rawPlan === "pro" || rawPlan === "annual" ? rawPlan : null) as Exclude<PlanType, "free"> | null;
      if (!plan) {
        res.status(400).json({ ok: false, message: "Plano invalido. Use 'pro' ou 'annual'." });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ ok: false, message: "Banco indisponivel para ativar assinatura" });
        return;
      }

      const now = new Date();
      const days = plan === "annual" ? 365 : 30;
      const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      await db
        .insert(subscriptions)
        .values({
          subjectKey,
          plan,
          status: "active",
          store: "manual",
          subscribedAt: now,
          expiresAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            plan,
            status: "active",
            store: "manual",
            subscribedAt: now,
            expiresAt,
          },
        });

      const data: SubscriptionState = {
        plan,
        expiresAt: expiresAt.toISOString(),
        subscribedAt: now.toISOString(),
        isSimulated: true,
      };

      res.status(200).json({ ok: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao ativar assinatura demo";
      res.status(400).json({ ok: false, message });
    }
  });

  router.post("/cancel", async (req, res) => {
    try {
      const subjectKey = getSubjectKey(req as any);
      if (!subjectKey) {
        res.status(400).json({ ok: false, message: "Identificacao do usuario/dispositivo e obrigatoria" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ ok: false, message: "Banco indisponivel para cancelar assinatura" });
        return;
      }

      await db
        .update(subscriptions)
        .set({
          plan: "free",
          status: "canceled",
          expiresAt: null,
        })
        .where(and(eq(subscriptions.subjectKey, subjectKey)));

      res.status(200).json({ ok: true, data: defaultState() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao cancelar assinatura";
      res.status(400).json({ ok: false, message });
    }
  });

  return router;
}
