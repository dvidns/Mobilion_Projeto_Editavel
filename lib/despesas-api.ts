import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/oauth";
import type {
  ConfirmarDespesaPayload,
  DespesaRegistro,
  ProcessarDespesaData,
  ProcessarDespesaPayload,
  RelatorioFiscalResumo,
} from "@/shared/despesas";

const baseUrl = getApiBaseUrl();
const DESPESAS_LOCAL_KEY = "despesas_local_v1";

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadLocalDespesas(): Promise<DespesaRegistro[]> {
  try {
    const raw = await AsyncStorage.getItem(DESPESAS_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveLocalDespesas(data: DespesaRegistro[]) {
  await AsyncStorage.setItem(DESPESAS_LOCAL_KEY, JSON.stringify(data));
}

function filtrarDespesasPorPeriodo(despesas: DespesaRegistro[], params?: { ano?: number; mes?: number }) {
  if (!params?.ano) return despesas;
  return despesas.filter((item) => {
    const ref = item.dataEmissao ?? item.createdAt.slice(0, 10);
    const [ano, mes] = ref.split("-").map(Number);
    if (!Number.isFinite(ano) || !Number.isFinite(mes)) return false;
    if (ano !== params.ano) return false;
    if (params.mes && mes !== params.mes) return false;
    return true;
  });
}

function mergeDespesas(remotas: DespesaRegistro[], locais: DespesaRegistro[]) {
  const byId = new Map<string, DespesaRegistro>();

  // Prioriza remoto em caso de mesmo id.
  for (const item of [...locais, ...remotas]) {
    byId.set(item.id, item);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function makeUrl(path: string, searchParams?: Record<string, string | undefined>) {
  const url = `${baseUrl}/api/despesas${path}`;
  if (!searchParams) return url;
  const qp = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== "") qp.set(key, value);
  });
  const query = qp.toString();
  return query ? `${url}?${query}` : url;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text().catch(() => "");
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const message =
      (parsed && typeof parsed.message === "string" && parsed.message) ||
      text ||
      `Falha HTTP ${response.status}`;
    const code = parsed && typeof parsed.code === "string" ? parsed.code : "UNKNOWN";
    const error = new Error(message) as Error & {
      code?: string;
      details?: unknown;
      data?: unknown;
      status?: number;
    };
    error.code = code;
    error.details = parsed?.details;
    error.data = parsed?.data;
    error.status = response.status;
    throw error;
  }

  if (parsed !== null) {
    return parsed as T;
  }
  return response.json() as Promise<T>;
}

export async function listarDespesas(params?: { ano?: number; mes?: number }): Promise<DespesaRegistro[]> {
  const local = await loadLocalDespesas();

  try {
    const response = await fetch(
      makeUrl("/", {
        ano: params?.ano ? String(params.ano) : undefined,
        mes: params?.mes ? String(params.mes) : undefined,
      }),
    );
    const json = await parseJson<{ ok: boolean; data: DespesaRegistro[] }>(response);
    return filtrarDespesasPorPeriodo(mergeDespesas(json.data, local), params);
  } catch {
    return filtrarDespesasPorPeriodo(local, params);
  }
}

export async function obterStatusIA(): Promise<{
  provider: "openai";
  configured: boolean;
  model: string;
}> {
  const response = await fetch(makeUrl("/status-ia"));
  const json = await parseJson<{
    ok: boolean;
    data: {
      provider: "openai";
      configured: boolean;
      model: string;
    };
  }>(response);
  return json.data;
}

export async function obterResumoFiscal(params: { ano: number; mes?: number }): Promise<RelatorioFiscalResumo> {
  const despesas = await listarDespesas(params);
  const totalPF = despesas
    .filter((item) => item.tipoPessoa === "PF")
    .reduce((sum, item) => sum + item.valorTotal, 0);
  const totalPJ = despesas
    .filter((item) => item.tipoPessoa === "PJ")
    .reduce((sum, item) => sum + item.valorTotal, 0);

  return {
    periodo: params.mes ? "mensal" : "anual",
    ano: params.ano,
    mes: params.mes,
    totalPF,
    totalPJ,
    totalGeral: totalPF + totalPJ,
    quantidadePF: despesas.filter((item) => item.tipoPessoa === "PF").length,
    quantidadePJ: despesas.filter((item) => item.tipoPessoa === "PJ").length,
  };
}

export async function exportarCsvIR(params: { ano: number; mes?: number }): Promise<string> {
  const despesas = await listarDespesas(params);
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
  for (const row of despesas) {
    lines.push(
      [
        row.id,
        row.tipoPessoa,
        row.clienteId,
        row.fornecedorNome,
        row.fornecedorCnpj,
        row.dataEmissao,
        Number(row.valorTotal).toFixed(2),
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

export async function processarDespesaComImagem(
  payload: ProcessarDespesaPayload & { imageUri: string; imageMimeType?: string },
): Promise<ProcessarDespesaData> {
  const formData = new FormData();

  if (Platform.OS === "web") {
    const blob = await fetch(payload.imageUri).then((r) => r.blob());
    formData.append("arquivo", blob, `despesa-${Date.now()}.jpg`);
  } else {
    formData.append("arquivo", {
      uri: payload.imageUri,
      name: `despesa-${Date.now()}.jpg`,
      type: payload.imageMimeType ?? "image/jpeg",
    } as any);
  }

  formData.append("tipoPessoa", payload.tipoPessoa);
  if (payload.clienteId) formData.append("clienteId", payload.clienteId);
  if (payload.conferidoIR !== undefined) formData.append("conferidoIR", String(payload.conferidoIR));
  if (payload.salvar !== undefined) formData.append("salvar", String(payload.salvar));

  const response = await fetch(makeUrl("/processar"), {
    method: "POST",
    body: formData,
  });

  const json = await parseJson<{
    ok: boolean;
    data: ProcessarDespesaData;
  }>(response);

  return json.data;
}

export async function confirmarDespesaProcessada(payload: ConfirmarDespesaPayload): Promise<ProcessarDespesaData> {
  try {
    const response = await fetch(makeUrl("/confirmar"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await parseJson<{ ok: boolean; data: ProcessarDespesaData }>(response);
    return json.data;
  } catch {
    const nowIso = new Date().toISOString();
    const id = genId();
    const registro: DespesaRegistro = {
      id,
      tipoPessoa: payload.tipoPessoa,
      clienteId: payload.clienteId ?? null,
      fornecedorNome: payload.extraido.nomeEmpresa,
      fornecedorCnpj: payload.extraido.cnpj,
      dataEmissao: payload.extraido.dataEmissao,
      valorTotal: payload.extraido.valorTotal,
      imageUrl: payload.imageUrl,
      imageStorageKey: payload.imageStorageKey ?? null,
      conferidoIR: payload.conferidoIR ?? false,
      dadosExtraidos: payload.extraido,
      createdAt: nowIso,
    };

    const current = await loadLocalDespesas();
    await saveLocalDespesas([registro, ...current]);

    return {
      id,
      tipoPessoa: payload.tipoPessoa,
      clienteId: payload.clienteId ?? null,
      conferidoIR: payload.conferidoIR ?? false,
      imageUrl: payload.imageUrl,
      imageStorageKey: payload.imageStorageKey ?? null,
      extraido: payload.extraido,
      salvo: true,
    };
  }
}
