import type { ConfirmarDespesaPayload, DespesaExtraida, TipoPessoa } from "@/shared/despesas";

type DraftPayload = {
  tipoPessoa: TipoPessoa;
  clienteId: string | null;
  conferidoIR: boolean;
  imageUrl: string;
  imageStorageKey: string | null;
  extraido: DespesaExtraida;
};

let currentDraft: DraftPayload | null = null;

export function setDespesaPreviewDraft(draft: DraftPayload) {
  currentDraft = draft;
}

export function getDespesaPreviewDraft(): DraftPayload | null {
  return currentDraft;
}

export function clearDespesaPreviewDraft() {
  currentDraft = null;
}

export function toConfirmarPayload(draft: DraftPayload): ConfirmarDespesaPayload {
  return {
    tipoPessoa: draft.tipoPessoa,
    clienteId: draft.clienteId,
    conferidoIR: draft.conferidoIR,
    imageUrl: draft.imageUrl,
    imageStorageKey: draft.imageStorageKey,
    extraido: draft.extraido,
  };
}
