import AsyncStorage from "@react-native-async-storage/async-storage";
import { getValidAccessToken, getStoredUserProfile } from "./google-auth-service";
import {
  getClientes,
  getAgendamentos,
  getOrcamentos,
  getServicos,
  saveClientes,
  saveAgendamentos,
  saveOrcamentos,
  Cliente,
  Agendamento,
  Orcamento,
  Servico,
} from "./store";

const SYNC_METADATA_KEY = "@mobilion:firestore_sync_meta";

export interface FirestoreSyncMeta {
  lastSyncTimestamp: number;
  lastSyncStatus: "idle" | "syncing" | "success" | "error";
  lastErrorMessage?: string;
}

export function getFirestoreProjectId(): string {
  return (
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_PROJECT_ID ||
    "mobilion-assistente"
  );
}

function getFirestoreBaseUrl(): string {
  const projectId = getFirestoreProjectId();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

/**
 * Converte um objeto JavaScript plano para a estrutura de tipos do Cloud Firestore REST.
 */
function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) {
      fields[key] = { nullValue: null };
    } else if (typeof val === "string") {
      fields[key] = { stringValue: val };
    } else if (typeof val === "number") {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (typeof val === "boolean") {
      fields[key] = { booleanValue: val };
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map((v) => {
            if (typeof v === "object" && v !== null) {
              return { mapValue: { fields: toFirestoreFields(v) } };
            }
            if (typeof v === "string") return { stringValue: v };
            if (typeof v === "number") return { doubleValue: v };
            if (typeof v === "boolean") return { booleanValue: v };
            return { stringValue: String(v) };
          }),
        },
      };
    } else if (typeof val === "object") {
      fields[key] = { mapValue: { fields: toFirestoreFields(val) } };
    }
  }
  return fields;
}

/**
 * Converte campos retornados do Cloud Firestore REST de volta para objeto JavaScript plano.
 */
function fromFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const res: Record<string, any> = {};
  for (const [key, wrapper] of Object.entries(fields || {})) {
    if ("stringValue" in wrapper) res[key] = wrapper.stringValue;
    else if ("integerValue" in wrapper) res[key] = parseInt(wrapper.integerValue, 10);
    else if ("doubleValue" in wrapper) res[key] = parseFloat(wrapper.doubleValue);
    else if ("booleanValue" in wrapper) res[key] = wrapper.booleanValue;
    else if ("nullValue" in wrapper) res[key] = null;
    else if ("mapValue" in wrapper) res[key] = fromFirestoreFields(wrapper.mapValue.fields);
    else if ("arrayValue" in wrapper) {
      res[key] = (wrapper.arrayValue.values || []).map((v: any) => {
        if ("mapValue" in v) return fromFirestoreFields(v.mapValue.fields);
        if ("stringValue" in v) return v.stringValue;
        if ("integerValue" in v) return parseInt(v.integerValue, 10);
        if ("doubleValue" in v) return parseFloat(v.doubleValue);
        if ("booleanValue" in v) return v.booleanValue;
        return v;
      });
    }
  }
  return res;
}

export async function getSyncMeta(): Promise<FirestoreSyncMeta> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_METADATA_KEY);
    return raw ? JSON.parse(raw) : { lastSyncTimestamp: 0, lastSyncStatus: "idle" };
  } catch {
    return { lastSyncTimestamp: 0, lastSyncStatus: "idle" };
  }
}

async function updateSyncMeta(partial: Partial<FirestoreSyncMeta>): Promise<void> {
  const current = await getSyncMeta();
  await AsyncStorage.setItem(SYNC_METADATA_KEY, JSON.stringify({ ...current, ...partial }));
}

/**
 * Salva ou atualiza um documento no Cloud Firestore.
 */
async function setFirestoreDoc(
  userSub: string,
  collection: string,
  docId: string,
  data: Record<string, any>,
  accessToken: string
): Promise<boolean> {
  const baseUrl = getFirestoreBaseUrl();
  const url = `${baseUrl}/users/${encodeURIComponent(userSub)}/${collection}/${encodeURIComponent(docId)}`;

  const body = JSON.stringify({
    fields: toFirestoreFields(data),
  });

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body,
  });

  return response.ok;
}

/**
 * Espelha todos os dados locais do AsyncStorage no Cloud Firestore (Backup / Sync na nuvem seguro).
 * Preserva 100% dos dados locais sem perda.
 */
export async function syncLocalDataToFirestore(): Promise<{
  success: boolean;
  clientesSynced: number;
  agendamentosSynced: number;
  orcamentosSynced: number;
  error?: string;
}> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return { success: false, clientesSynced: 0, agendamentosSynced: 0, orcamentosSynced: 0, error: "Usuário Google não autenticado." };
  }

  const user = await getStoredUserProfile();
  if (!user?.id) {
    return { success: false, clientesSynced: 0, agendamentosSynced: 0, orcamentosSynced: 0, error: "Perfil Google ausente." };
  }

  await updateSyncMeta({ lastSyncStatus: "syncing" });

  try {
    const [clientes, agendamentos, orcamentos] = await Promise.all([
      getClientes(),
      getAgendamentos(),
      getOrcamentos(),
    ]);

    let cCount = 0;
    let aCount = 0;
    let oCount = 0;

    // Enviar clientes
    for (const c of clientes) {
      const ok = await setFirestoreDoc(user.id, "clientes", c.id, c, accessToken);
      if (ok) cCount++;
    }

    // Enviar agendamentos
    for (const a of agendamentos) {
      const ok = await setFirestoreDoc(user.id, "agendamentos", a.id, a, accessToken);
      if (ok) aCount++;
    }

    // Enviar orçamentos
    for (const o of orcamentos) {
      const ok = await setFirestoreDoc(user.id, "orcamentos", o.id, o, accessToken);
      if (ok) oCount++;
    }

    await updateSyncMeta({
      lastSyncTimestamp: Date.now(),
      lastSyncStatus: "success",
      lastErrorMessage: undefined,
    });

    return {
      success: true,
      clientesSynced: cCount,
      agendamentosSynced: aCount,
      orcamentosSynced: oCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido na sincronização Firestore";
    await updateSyncMeta({
      lastSyncStatus: "error",
      lastErrorMessage: msg,
    });
    return {
      success: false,
      clientesSynced: 0,
      agendamentosSynced: 0,
      orcamentosSynced: 0,
      error: msg,
    };
  }
}

