import { z } from "zod";

export const tipoPessoaSchema = z.enum(["PF", "PJ"]);
export type TipoPessoa = z.infer<typeof tipoPessoaSchema>;

export const despesaItemExtraidoSchema = z.object({
  nome: z.string().min(1),
  valor_unitario: z.number().nonnegative(),
  quantidade: z.number().positive(),
  valor_total: z.number().nonnegative(),
});

export const despesaExtraidaSchema = z.object({
  nomeEmpresa: z.string().min(1),
  cnpj: z.string().nullable(),
  dataEmissao: z.string().nullable(),
  valorTotal: z.number().nonnegative(),
  itens: z.array(despesaItemExtraidoSchema),
});

export type DespesaItemExtraido = z.infer<typeof despesaItemExtraidoSchema>;
export type DespesaExtraida = z.infer<typeof despesaExtraidaSchema>;

export interface ProcessarDespesaPayload {
  tipoPessoa: TipoPessoa;
  clienteId?: string | null;
  conferidoIR?: boolean;
  salvar?: boolean;
}

export type IaProcessarErroCodigo =
  | "OPENAI_KEY_MISSING"
  | "OPENAI_REQUEST_FAILED"
  | "OPENAI_EMPTY_OUTPUT"
  | "OPENAI_INVALID_JSON"
  | "OPENAI_SCHEMA_INVALID"
  | "NO_USEFUL_DATA"
  | "UNKNOWN";

export interface ProcessarDespesaData {
  imageUrl: string;
  imageStorageKey: string | null;
  extraido: DespesaExtraida;
  salvo: boolean;
  id: string | null;
  tipoPessoa: TipoPessoa;
  clienteId: string | null;
  conferidoIR: boolean;
}

export interface ConfirmarDespesaPayload {
  tipoPessoa: TipoPessoa;
  clienteId?: string | null;
  conferidoIR?: boolean;
  imageUrl: string;
  imageStorageKey?: string | null;
  extraido: DespesaExtraida;
}

export interface DespesaRegistro {
  id: string;
  tipoPessoa: TipoPessoa;
  clienteId: string | null;
  fornecedorNome: string;
  fornecedorCnpj: string | null;
  dataEmissao: string | null;
  valorTotal: number;
  imageUrl: string;
  imageStorageKey: string | null;
  conferidoIR: boolean;
  dadosExtraidos: DespesaExtraida;
  createdAt: string;
}

export type PeriodoFiscal = "mensal" | "anual";

export interface FiltroDespesas {
  ano: number;
  mes?: number;
}

export interface RelatorioFiscalResumo {
  periodo: PeriodoFiscal;
  ano: number;
  mes?: number;
  totalPF: number;
  totalPJ: number;
  totalGeral: number;
  quantidadePF: number;
  quantidadePJ: number;
}
