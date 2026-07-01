import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import type { PlanType, SubscriptionState } from "@/shared/subscription";

const DEVICE_KEY = "@montafacil:device-id";

function makeUrl(path: string) {
  const base = getApiBaseUrl();
  return `${base}/api/subscription${path}`;
}

function generateDeviceId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getDeviceId(): Promise<string> {
  if (Platform.OS === "web") {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(DEVICE_KEY) : null;
    if (raw) return raw;
    const created = generateDeviceId();
    if (typeof window !== "undefined") window.localStorage.setItem(DEVICE_KEY, created);
    return created;
  }

  const raw = await AsyncStorage.getItem(DEVICE_KEY);
  if (raw) return raw;
  const created = generateDeviceId();
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}

async function buildHeaders() {
  const user = await Auth.getUserInfo();
  const deviceId = await getDeviceId();

  return {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
    ...(user?.openId ? { "X-Open-Id": user.openId } : {}),
  };
}

export async function getSubscriptionSubjectKey(): Promise<string> {
  const user = await Auth.getUserInfo();
  if (user?.openId) {
    return `openid:${user.openId}`;
  }

  const deviceId = await getDeviceId();
  return `device:${deviceId}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text().catch(() => "");
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = parsed?.message || text || `Falha HTTP ${response.status}`;
    throw new Error(message);
  }

  return parsed as T;
}

function defaultState(): SubscriptionState {
  return {
    plan: "free",
    expiresAt: null,
    subscribedAt: null,
    isSimulated: false,
  };
}

export interface LicenseSummary {
  id: number;
  codeHint: string;
  plan: Exclude<PlanType, "free">;
  status: "active" | "revoked" | "expired";
  maxActivations: number;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export async function getSubscriptionRemote(): Promise<SubscriptionState> {
  const response = await fetch(makeUrl("/status"), {
    method: "GET",
    headers: await buildHeaders(),
  });

  const json = await parseJson<{ ok: boolean; data: SubscriptionState }>(response);
  return json?.data ?? defaultState();
}

export async function activateDemoPlanRemote(plan: Exclude<PlanType, "free">): Promise<SubscriptionState> {
  const response = await fetch(makeUrl("/activate-demo"), {
    method: "POST",
    headers: await buildHeaders(),
    body: JSON.stringify({ plan }),
  });

  const json = await parseJson<{ ok: boolean; data: SubscriptionState }>(response);
  return json.data;
}

export async function cancelSubscriptionRemote(): Promise<SubscriptionState> {
  const response = await fetch(makeUrl("/cancel"), {
    method: "POST",
    headers: await buildHeaders(),
    body: JSON.stringify({}),
  });

  const json = await parseJson<{ ok: boolean; data: SubscriptionState }>(response);
  return json.data;
}

export async function activateLicenseRemote(code: string): Promise<SubscriptionState> {
  const response = await fetch(makeUrl("/license/activate"), {
    method: "POST",
    headers: await buildHeaders(),
    body: JSON.stringify({ code }),
  });

  const json = await parseJson<{ ok: boolean; data: SubscriptionState }>(response);
  return json.data;
}

export async function createLicenseRemote(payload: {
  plan: Exclude<PlanType, "free">;
  expiresAt?: string | null;
  maxActivations?: number;
}): Promise<{
  code: string;
  codeHint: string;
  plan: Exclude<PlanType, "free">;
  maxActivations: number;
  expiresAt: string | null;
}> {
  const response = await fetch(makeUrl("/license/create"), {
    method: "POST",
    headers: await buildHeaders(),
    body: JSON.stringify(payload),
  });

  const json = await parseJson<{
    ok: boolean;
    data: {
      code: string;
      codeHint: string;
      plan: Exclude<PlanType, "free">;
      maxActivations: number;
      expiresAt: string | null;
    };
  }>(response);
  return json.data;
}

export async function listLicensesRemote(): Promise<LicenseSummary[]> {
  const response = await fetch(makeUrl("/license/list"), {
    method: "GET",
    headers: await buildHeaders(),
  });

  const json = await parseJson<{ ok: boolean; data: LicenseSummary[] }>(response);
  return json.data;
}

export async function revokeLicenseRemote(licenseId: number): Promise<void> {
  const response = await fetch(makeUrl("/license/revoke"), {
    method: "POST",
    headers: await buildHeaders(),
    body: JSON.stringify({ licenseId }),
  });

  await parseJson<{ ok: boolean }>(response);
}
