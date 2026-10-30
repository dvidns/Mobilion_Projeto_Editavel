import OpenAI from "openai";
import { ZodError } from "zod";
import { ENV } from "../_core/env";
import { despesaExtraidaSchema, type DespesaExtraida } from "../../shared/despesas";

export class IAExtractionError extends Error {
  code:
    | "OPENAI_KEY_MISSING"
    | "OPENAI_REQUEST_FAILED"
    | "OPENAI_EMPTY_OUTPUT"
    | "OPENAI_INVALID_JSON"
    | "OPENAI_SCHEMA_INVALID";
  details?: unknown;

  constructor(
    code:
      | "OPENAI_KEY_MISSING"
      | "OPENAI_REQUEST_FAILED"
      | "OPENAI_EMPTY_OUTPUT"
      | "OPENAI_INVALID_JSON"
      | "OPENAI_SCHEMA_INVALID",
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "IAExtractionError";
    this.code = code;
    this.details = details;
  }
}

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

function extractOutputText(response: any): string | undefined {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const chunks: string[] = [];
  const output = Array.isArray(response?.output) ? response.output : [];
  for (const block of output) {
    const content = Array.isArray(block?.content) ? block.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        chunks.push(part.text);
      }
      if (typeof part?.output_text === "string" && part.output_text.trim()) {
        chunks.push(part.output_text);
      }
    }
  }

  if (chunks.length === 0) return undefined;
  return chunks.join("\n");
}

function parsePossibleJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]);
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("JSON nao encontrado na resposta");
  }
}

export async function extrairDespesaComIA(params: {
  imageBuffer: Buffer;
  mimeType: string;
}): Promise<DespesaExtraida> {
  if (!params.imageBuffer || params.imageBuffer.length === 0) {
    throw new IAExtractionError("OPENAI_REQUEST_FAILED", "Imagem invalida para processamento");
  }

  if (!ENV.openAiApiKey) {
    throw new IAExtractionError("OPENAI_KEY_MISSING", "OPENAI_API_KEY nao configurada no backend");
  }

  const client = new OpenAI({ apiKey: ENV.openAiApiKey });
  const base64Image = params.imageBuffer.toString("base64");
  const imageUrl = `data:${params.mimeType};base64,${base64Image}`;

  const modelCandidates = Array.from(new Set([ENV.openAiModel, "gpt-4.1-mini", "gpt-4o-mini"]));
  let response: any = null;
  let lastError: unknown = null;

  for (const model of modelCandidates) {
    try {
      response = await client.responses.create({
        model,
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
                  "Responda SOMENTE JSON.",
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
            strict: false,
          },
        },
      } as any);

      if (response) break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw new IAExtractionError("OPENAI_REQUEST_FAILED", "Falha na chamada da IA para OCR", {
      message: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }

  const outputText = extractOutputText(response);
  if (!outputText) {
    throw new IAExtractionError("OPENAI_EMPTY_OUTPUT", "A IA nao retornou conteudo estruturado", {
      responseKeys: Object.keys((response as unknown as Record<string, unknown>) || {}),
    });
  }

  let parsed: unknown;
  try {
    parsed = parsePossibleJson(outputText);
  } catch (error) {
    throw new IAExtractionError("OPENAI_INVALID_JSON", "A resposta da IA nao veio em JSON valido", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    return despesaExtraidaSchema.parse(parsed);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new IAExtractionError("OPENAI_SCHEMA_INVALID", "A IA retornou dados fora do formato esperado", {
        issues: error.issues,
      });
    }
    throw error;
  }
}
