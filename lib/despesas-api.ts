import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import type {
  DespesaRegistro,
  ProcessarDespesaPayload,
  RelatorioFiscalResumo,
} from "@/shared/despesas";

const baseUrl = getApiBaseUrl();

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
  if (!response.ok) {
    const text = await response.text().catch(() => "Erro desconhecido");
    throw new Error(text || `Falha HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function listarDespesas(params?: { ano?: number; mes?: number }): Promise<DespesaRegistro[]> {
  const response = await fetch(
    makeUrl("/", {
      ano: params?.ano ? String(params.ano) : undefined,
      mes: params?.mes ? String(params.mes) : undefined,
    }),
  );
  const json = await parseJson<{ ok: boolean; data: DespesaRegistro[] }>(response);
  return json.data;
}

export async function obterResumoFiscal(params: { ano: number; mes?: number }): Promise<RelatorioFiscalResumo> {
  const response = await fetch(
    makeUrl("/resumo", {
      ano: String(params.ano),
      mes: params.mes ? String(params.mes) : undefined,
    }),
  );
  const json = await parseJson<{ ok: boolean; data: RelatorioFiscalResumo }>(response);
  return json.data;
}

export async function exportarCsvIR(params: { ano: number; mes?: number }): Promise<string> {
  const response = await fetch(
    makeUrl("/exportar.csv", {
      ano: String(params.ano),
      mes: params.mes ? String(params.mes) : undefined,
    }),
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "Falha na exportação");
    throw new Error(text || `Falha HTTP ${response.status}`);
  }
  return response.text();
}

export async function processarDespesaComImagem(
  payload: ProcessarDespesaPayload & { imageUri: string; imageMimeType?: string },
): Promise<{
  id: string;
  tipoPessoa: "PF" | "PJ";
  clienteId: string | null;
  conferidoIR: boolean;
  imageUrl: string;
  extraido: {
    nomeEmpresa: string;
    cnpj: string | null;
    dataEmissao: string | null;
    valorTotal: number;
    itens: Array<{
      nome: string;
      valor_unitario: number;
      quantidade: number;
      valor_total: number;
    }>;
  };
}> {
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

  const response = await fetch(makeUrl("/processar"), {
    method: "POST",
    body: formData,
  });

  const json = await parseJson<{
    ok: boolean;
    data: {
      id: string;
      tipoPessoa: "PF" | "PJ";
      clienteId: string | null;
      conferidoIR: boolean;
      imageUrl: string;
      extraido: {
        nomeEmpresa: string;
        cnpj: string | null;
        dataEmissao: string | null;
        valorTotal: number;
        itens: Array<{
          nome: string;
          valor_unitario: number;
          quantidade: number;
          valor_total: number;
        }>;
      };
    };
  }>(response);

  return json.data;
}
