import OpenAI from "openai";
import { ENV } from "../_core/env";
import { despesaExtraidaSchema, type DespesaExtraida } from "../../shared/despesas";

const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["nomeEmpresa", "cnpj", "dataEmissao", "valorTotal", "itens"],
  properties: {
    nomeEmpresa: { type: "string" },
    cnpj: { type: ["string", "null"] },
    dataEmissao: { type: ["string", "null"] },
    valorTotal: { type: "number" },
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nome", "valor_unitario", "quantidade", "valor_total"],
        properties: {
          nome: { type: "string" },
          valor_unitario: { type: "number" },
          quantidade: { type: "number" },
          valor_total: { type: "number" },
        },
      },
    },
  },
};

export async function extrairDespesaComIA(params: {
  imageBuffer: Buffer;
  mimeType: string;
}): Promise<DespesaExtraida> {
  if (!ENV.openAiApiKey) {
    throw new Error("OPENAI_API_KEY nao configurada no backend");
  }

  const client = new OpenAI({ apiKey: ENV.openAiApiKey });
  const base64Image = params.imageBuffer.toString("base64");
  const imageUrl = `data:${params.mimeType};base64,${base64Image}`;

  const response = await client.responses.create({
    model: ENV.openAiModel,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "Extraia dados de nota fiscal ou recibo e retorne apenas JSON valido no schema solicitado.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Extraia obrigatoriamente:",
              "- nomeEmpresa",
              "- cnpj (ou null)",
              "- dataEmissao no formato YYYY-MM-DD (ou null)",
              "- valorTotal",
              "- itens[] com nome, valor_unitario, quantidade, valor_total",
              "Use 0 para valores ausentes e array vazio para itens nao reconhecidos.",
            ].join("\n"),
          },
          {
            type: "input_image",
            image_url: imageUrl,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "nota_fiscal_extraida",
        schema: extractionJsonSchema,
        strict: true,
      },
    },
  } as any);

  const outputText = (response as any).output_text as string | undefined;
  if (!outputText) {
    throw new Error("A IA nao retornou conteudo estruturado");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("A resposta da IA nao veio em JSON valido");
  }

  return despesaExtraidaSchema.parse(parsed);
}
