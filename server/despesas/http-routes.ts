import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { despesaItens, despesas } from "../../drizzle/schema";
import { tipoPessoaSchema } from "../../shared/despesas";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { extrairDespesaComIA } from "./ai-extractor";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Arquivo invalido: envie uma imagem"));
      return;
    }
    cb(null, true);
  },
});

const payloadSchema = z.object({
  tipoPessoa: tipoPessoaSchema,
  clienteId: z.string().trim().min(1).optional(),
  conferidoIR: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .optional(),
});

const filtroQuerySchema = z.object({
  ano: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12).optional(),
});

type RegistroDespesa = {
  id: string;
  tipoPessoa: "PF" | "PJ";
  clienteId: string | null;
  fornecedorNome: string;
  fornecedorCnpj: string | null;
  dataEmissao: string | null;
  valorTotal: number;
  imageUrl: string;
  imageStorageKey: string | null;
  conferidoIR: boolean;
  dadosExtraidos: unknown;
  createdAt: string;
};

function valorToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toRegistroDespesa(row: typeof despesas.$inferSelect): RegistroDespesa {
  let dadosExtraidos: unknown = null;
  try {
    dadosExtraidos = row.dadosExtraidosJson ? JSON.parse(row.dadosExtraidosJson) : null;
  } catch {
    dadosExtraidos = null;
  }

  return {
    id: row.id,
    tipoPessoa: row.tipoPessoa,
    clienteId: row.clienteId,
    fornecedorNome: row.fornecedorNome,
    fornecedorCnpj: row.fornecedorCnpj,
    dataEmissao: row.dataEmissao,
    valorTotal: valorToNumber(row.valorTotal),
    imageUrl: row.imageUrl,
    imageStorageKey: row.imageStorageKey,
    conferidoIR: row.conferidoIR === 1,
    dadosExtraidos,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
  };
}

function dentroDoPeriodo(data: string, ano: number, mes?: number): boolean {
  const [yy, mm] = data.split("-").map(Number);
  if (!Number.isFinite(yy) || !Number.isFinite(mm)) return false;
  if (yy !== ano) return false;
  if (mes !== undefined && mm !== mes) return false;
  return true;
}

function buildCsv(data: RegistroDespesa[]) {
  const header = [
    "id",
    "tipoPessoa",
    "clienteId",
    "fornecedorNome",
    "fornecedorCnpj",
    "dataEmissao",
    "valorTotal",
    "conferidoIR",
    "imageUrl",
    "createdAt",
  ];

  const escape = (value: string | number | boolean | null) => {
    const raw = value === null ? "" : String(value);
    return `"${raw.replace(/"/g, '""')}"`;
  };

  const lines = [header.join(",")];
  for (const row of data) {
    lines.push(
      [
        row.id,
        row.tipoPessoa,
        row.clienteId,
        row.fornecedorNome,
        row.fornecedorCnpj,
        row.dataEmissao,
        row.valorTotal.toFixed(2),
        row.conferidoIR,
        row.imageUrl,
        row.createdAt,
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function registerDespesasHttpRoutes(): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const query = req.query as Record<string, string | undefined>;
      const filtro = query.ano ? filtroQuerySchema.parse(query) : null;

      const db = await getDb();
      if (!db) {
        res.json({ ok: true, data: [] });
        return;
      }

      const rows = await db.select().from(despesas).orderBy(desc(despesas.createdAt));
      let data = rows.map(toRegistroDespesa);
      if (filtro) {
        data = data.filter((item) => {
          const refDate = item.dataEmissao ?? item.createdAt.slice(0, 10);
          return dentroDoPeriodo(refDate, filtro.ano, filtro.mes);
        });
      }

      res.json({ ok: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao listar despesas";
      res.status(400).json({ ok: false, message });
    }
  });

  router.get("/resumo", async (req, res) => {
    try {
      const filtro = filtroQuerySchema.parse(req.query);
      const db = await getDb();
      if (!db) {
        res.json({
          ok: true,
          data: {
            periodo: filtro.mes ? "mensal" : "anual",
            ano: filtro.ano,
            mes: filtro.mes,
            totalPF: 0,
            totalPJ: 0,
            totalGeral: 0,
            quantidadePF: 0,
            quantidadePJ: 0,
          },
        });
        return;
      }

      const rows = await db.select().from(despesas).orderBy(desc(despesas.createdAt));
      const filtradas = rows
        .map(toRegistroDespesa)
        .filter((item) => dentroDoPeriodo(item.dataEmissao ?? item.createdAt.slice(0, 10), filtro.ano, filtro.mes));

      const totalPF = filtradas
        .filter((item) => item.tipoPessoa === "PF")
        .reduce((sum, item) => sum + item.valorTotal, 0);
      const totalPJ = filtradas
        .filter((item) => item.tipoPessoa === "PJ")
        .reduce((sum, item) => sum + item.valorTotal, 0);

      res.json({
        ok: true,
        data: {
          periodo: filtro.mes ? "mensal" : "anual",
          ano: filtro.ano,
          mes: filtro.mes,
          totalPF,
          totalPJ,
          totalGeral: totalPF + totalPJ,
          quantidadePF: filtradas.filter((item) => item.tipoPessoa === "PF").length,
          quantidadePJ: filtradas.filter((item) => item.tipoPessoa === "PJ").length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao montar resumo fiscal";
      res.status(400).json({ ok: false, message });
    }
  });

  router.get("/exportar.csv", async (req, res) => {
    try {
      const filtro = filtroQuerySchema.parse(req.query);
      const db = await getDb();
      if (!db) {
        res.status(200).type("text/csv; charset=utf-8").send("id,tipoPessoa,clienteId,fornecedorNome,fornecedorCnpj,dataEmissao,valorTotal,conferidoIR,imageUrl,createdAt\n");
        return;
      }

      const rows = await db.select().from(despesas).orderBy(desc(despesas.createdAt));
      const filtradas = rows
        .map(toRegistroDespesa)
        .filter((item) => dentroDoPeriodo(item.dataEmissao ?? item.createdAt.slice(0, 10), filtro.ano, filtro.mes));

      const csv = buildCsv(filtradas);
      const sufixo = filtro.mes ? `${filtro.ano}-${String(filtro.mes).padStart(2, "0")}` : String(filtro.ano);

      res
        .status(200)
        .setHeader("Content-Type", "text/csv; charset=utf-8")
        .setHeader("Content-Disposition", `attachment; filename=despesas-ir-${sufixo}.csv`)
        .send(csv);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao exportar CSV";
      res.status(400).json({ ok: false, message });
    }
  });

  router.post("/processar", upload.single("arquivo"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ ok: false, message: "Arquivo de imagem e obrigatorio no campo 'arquivo'" });
        return;
      }

      const payload = payloadSchema.parse({
        tipoPessoa: req.body.tipoPessoa,
        clienteId: req.body.clienteId,
        conferidoIR: req.body.conferidoIR,
      });
      const userOpenIdHeader = req.headers["x-open-id"];
      const userOpenId =
        typeof userOpenIdHeader === "string" && userOpenIdHeader.trim().length > 0
          ? userOpenIdHeader
          : null;

      const extraido = await extrairDespesaComIA({
        imageBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });

      const despesaId = randomUUID();
      const extension = req.file.originalname.split(".").pop() || "jpg";
      const storageKey = `despesas/${despesaId}.${extension}`;

      let imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      let imageStorageKey: string | null = null;

      try {
        const storage = await storagePut(storageKey, req.file.buffer, req.file.mimetype);
        imageUrl = storage.url;
        imageStorageKey = storage.key;
      } catch (storageError) {
        console.warn("[despesas] upload em storage indisponivel, mantendo imagem em data URL", storageError);
      }

      const db = await getDb();
      if (db) {
        await db.insert(despesas).values({
          id: despesaId,
          userOpenId,
          tipoPessoa: payload.tipoPessoa,
          clienteId: payload.clienteId ?? null,
          fornecedorNome: extraido.nomeEmpresa,
          fornecedorCnpj: extraido.cnpj,
          dataEmissao: extraido.dataEmissao,
          valorTotal: extraido.valorTotal.toFixed(2),
          imageUrl,
          imageStorageKey,
          conferidoIR: payload.conferidoIR ? 1 : 0,
          dadosExtraidosJson: JSON.stringify(extraido),
        });

        if (extraido.itens.length > 0) {
          await db.insert(despesaItens).values(
            extraido.itens.map((item) => ({
              despesaId,
              nome: item.nome,
              quantidade: item.quantidade.toFixed(3),
              valorUnitario: item.valor_unitario.toFixed(2),
              valorTotal: item.valor_total.toFixed(2),
            })),
          );
        }
      }

      res.status(201).json({
        ok: true,
        data: {
          id: despesaId,
          tipoPessoa: payload.tipoPessoa,
          clienteId: payload.clienteId ?? null,
          conferidoIR: payload.conferidoIR ?? false,
          imageUrl,
          extraido,
        },
      });
    } catch (error) {
      console.error("[despesas.processar] erro", error);
      const message = error instanceof Error ? error.message : "Falha ao processar despesa";
      res.status(400).json({ ok: false, message });
    }
  });

  return router;
}
