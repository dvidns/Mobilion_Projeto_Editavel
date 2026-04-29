import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StatusAgendamento = "pendente" | "confirmado" | "concluido" | "cancelado" | "retorno";
export type StatusOrcamento = "pendente" | "aprovado" | "recusado";

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  endereco?: string;
  bairro?: string;
  notas?: string;
  historicoEnderecos?: string[]; // Histórico de endereços anteriores
  criadoEm: string;
}

export interface Movel {
  id: string;
  nome: string; // Ex: "Guarda-roupa", "Cozinha"
  descricao?: string;
  fotoUri?: string;
  modulos?: number; // Para cozinha: número de módulos
  valorPorModulo?: number; // Para cozinha: valor por módulo
  pecas?: Peca[];
  materiais?: Material[];
}

export interface Peca {
  id: string;
  nome: string;
  quantidade: number;
  observacoes?: string;
}

export interface Material {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string; // "un", "kg", "m", etc
  observacoes?: string;
}

export interface Agendamento {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  data: string; // ISO date string
  hora: string; // "HH:MM"
  tipoServico: string;
  descricao?: string;
  endereco?: string;
  valor: number;
  status: StatusAgendamento;
  moveis?: Array<{
    id: string;
    servicoNome: string;
    valor: number;
    quantidade: number;
    observacao?: string;
  }>; // Múltiplos móveis/serviços
  temRetorno?: boolean; // Se tem retorno para finalizar
  dataRetorno?: string; // Data do retorno
  horaRetorno?: string; // Hora do retorno
  enderecoRetorno?: string; // Endereço do retorno (pode ser diferente do inicial)
  valorRecebido?: number; // Valor realmente recebido do cliente (pode ser diferente do orçado)
  dataConclusao?: string; // Data e hora de conclusão
  fotos?: string[]; // URIs das fotos dos móveis registradas no serviço
  criadoEm: string;
  atualizadoEm?: string;
}

export interface Servico {
  id: string;
  nome: string;
  categoria: string;
  valorMin: number;
  valorMax: number;
  valorSugerido: number;
  tempoEstimadoHoras?: number; // Tempo estimado em horas para cálculo automático
}

export interface ItemOrcamento {
  servicoId: string;
  servicoNome: string;
  quantidade: number;
  valor: number;
  modulos?: number; // Para cozinha
  valorPorModulo?: number; // Para cozinha
}

export interface Orcamento {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  itens: ItemOrcamento[];
  total: number;
  status: StatusOrcamento;
  observacoes?: string;
  criadoEm: string;
}

// ─── Keys ────────────────────────────────────────────────────────────────────

const KEYS = {
  clientes: "@montafacil:clientes",
  agendamentos: "@montafacil:agendamentos",
  servicos: "@montafacil:servicos",
  orcamentos: "@montafacil:orcamentos",
  whatsappTipo: "@montafacil:whatsapp_tipo",
  avaliacaoLink: "@montafacil:avaliacao_link",
  valorHora: "@montafacil:valor_hora",
  moveis: "@montafacil:moveis",
  lembrete: "@montafacil:lembrete_personalizado",
  itensEstoque: "@montafacil:itens_estoque",
  margemLucro: "@montafacil:margem_lucro",
  margemMoveis: "@montafacil:margem_moveis",
  margemPecas: "@montafacil:margem_pecas",
  linkPagamento: "@montafacil:link_pagamento",
};

// ─── Preferência WhatsApp ─────────────────────────────────────────────────────

export type WhatsAppTipo = "normal" | "business";

/** Retorna null se ainda não foi escolhido, ou o tipo salvo */
export async function getWhatsAppTipo(): Promise<WhatsAppTipo | null> {
  const raw = await AsyncStorage.getItem(KEYS.whatsappTipo);
  return (raw as WhatsAppTipo | null) ?? null;
}

export async function saveWhatsAppTipo(tipo: WhatsAppTipo): Promise<void> {
  await AsyncStorage.setItem(KEYS.whatsappTipo, tipo);
}

/**
 * Monta a URL do WhatsApp de acordo com a preferência salva.
 * scheme: "whatsapp" (normal) ou "whatsapp-business" (Business)
 */
export function buildWhatsAppUrl(tipo: WhatsAppTipo, telefone: string, mensagem: string): string {
  const tel = telefone.replace(/\D/g, "");
  const telFull = tel.startsWith("55") ? tel : `55${tel}`;
  const encoded = encodeURIComponent(mensagem);
  if (tipo === "business") {
    return `whatsapp-business://send?phone=${telFull}&text=${encoded}`;
  }
  return `whatsapp://send?phone=${telFull}&text=${encoded}`;
}

// --- Configurações ---

export async function getAvaliacaoLink(): Promise<string> {
  const raw = await AsyncStorage.getItem(KEYS.avaliacaoLink);
  return raw ?? "https://google.com/maps";
}

export async function saveAvaliacaoLink(link: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.avaliacaoLink, link);
}

export async function getLembretePersonalizado(): Promise<string> {
  const raw = await AsyncStorage.getItem(KEYS.lembrete);
  return raw ?? "Olá {cliente}! Confirmando o serviço de {servico} no dia {data} às {hora}. Valor: {valor}.";
}

export async function saveLembretePersonalizado(lembrete: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.lembrete, lembrete);
}

export async function getLinkPagamento(): Promise<string> {
  const raw = await AsyncStorage.getItem(KEYS.linkPagamento);
  return raw ?? "";
}

export async function saveLinkPagamento(link: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.linkPagamento, link);
}

// ─── Default services (reference prices) ─────────────────────────────────────

export const SERVICOS_PADRAO: Servico[] = [
  { id: "s1", nome: "Guarda-roupa 2 portas", categoria: "Quarto", valorMin: 80, valorMax: 150, valorSugerido: 100 },
  { id: "s2", nome: "Guarda-roupa 3 portas", categoria: "Quarto", valorMin: 100, valorMax: 180, valorSugerido: 130 },
  { id: "s3", nome: "Guarda-roupa 4 portas", categoria: "Quarto", valorMin: 120, valorMax: 220, valorSugerido: 160 },
  { id: "s4", nome: "Guarda-roupa 6 portas", categoria: "Quarto", valorMin: 150, valorMax: 280, valorSugerido: 200 },
  { id: "s5", nome: "Cama de solteiro", categoria: "Quarto", valorMin: 60, valorMax: 100, valorSugerido: 80 },
  { id: "s6", nome: "Cama de casal", categoria: "Quarto", valorMin: 80, valorMax: 130, valorSugerido: 100 },
  { id: "s7", nome: "Cama box", categoria: "Quarto", valorMin: 50, valorMax: 90, valorSugerido: 70 },
  { id: "s8", nome: "Cômoda", categoria: "Quarto", valorMin: 60, valorMax: 100, valorSugerido: 80 },
  { id: "s9", nome: "Armário de cozinha (por módulo)", categoria: "Cozinha", valorMin: 40, valorMax: 80, valorSugerido: 60 },
  { id: "s10", nome: "Cozinha completa (até 10 módulos)", categoria: "Cozinha", valorMin: 300, valorMax: 600, valorSugerido: 400 },
  { id: "s11", nome: "Mesa de jantar", categoria: "Sala", valorMin: 60, valorMax: 120, valorSugerido: 80 },
  { id: "s12", nome: "Estante/Rack TV", categoria: "Sala", valorMin: 80, valorMax: 150, valorSugerido: 100 },
  { id: "s13", nome: "Sofá (montagem)", categoria: "Sala", valorMin: 50, valorMax: 100, valorSugerido: 70 },
  { id: "s14", nome: "Mesa de escritório", categoria: "Escritório", valorMin: 60, valorMax: 120, valorSugerido: 80 },
  { id: "s15", nome: "Cadeira de escritório", categoria: "Escritório", valorMin: 30, valorMax: 60, valorSugerido: 40 },
  { id: "s16", nome: "Estante de escritório", categoria: "Escritório", valorMin: 60, valorMax: 120, valorSugerido: 80 },
  { id: "s17", nome: "Desmontagem (por peça)", categoria: "Desmontagem", valorMin: 40, valorMax: 80, valorSugerido: 60 },
  { id: "s18", nome: "Berço", categoria: "Quarto", valorMin: 60, valorMax: 100, valorSugerido: 80 },
  { id: "s19", nome: "Beliche", categoria: "Quarto", valorMin: 100, valorMax: 160, valorSugerido: 130 },
  { id: "s20", nome: "Armário banheiro/lavanderia", categoria: "Outros", valorMin: 50, valorMax: 90, valorSugerido: 70 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toNumberSafe(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const normalized = trimmed.includes(",")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normalizeItemOrcamento(item: Partial<ItemOrcamento>): ItemOrcamento {
  return {
    servicoId: String(item.servicoId ?? ""),
    servicoNome: String(item.servicoNome ?? "Serviço"),
    quantidade: Math.max(1, Math.trunc(toNumberSafe(item.quantidade, 1))),
    valor: toNumberSafe(item.valor, 0),
    modulos: item.modulos !== undefined ? toNumberSafe(item.modulos, 0) : undefined,
    valorPorModulo: item.valorPorModulo !== undefined ? toNumberSafe(item.valorPorModulo, 0) : undefined,
  };
}

function calcularTotalOrcamento(itens: ItemOrcamento[]): number {
  return itens.reduce((soma, item) => {
    const valor = toNumberSafe(item.valor, 0);
    const quantidade = Math.max(1, Math.trunc(toNumberSafe(item.quantidade, 1)));
    return soma + valor * quantidade;
  }, 0);
}

function normalizeOrcamento(raw: Partial<Orcamento>): Orcamento {
  const itensRaw = Array.isArray(raw.itens) ? raw.itens : [];
  const itens = itensRaw.map((i) => normalizeItemOrcamento(i));
  const totalItens = calcularTotalOrcamento(itens);
  const total = itens.length > 0 ? totalItens : toNumberSafe(raw.total, 0);

  return {
    id: String(raw.id ?? uuid()),
    clienteId: String(raw.clienteId ?? ""),
    clienteNome: String(raw.clienteNome ?? ""),
    clienteTelefone: String(raw.clienteTelefone ?? ""),
    itens,
    total,
    status: (raw.status ?? "pendente") as StatusOrcamento,
    observacoes: raw.observacoes,
    criadoEm: raw.criadoEm ?? new Date().toISOString(),
  };
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export async function getClientes(): Promise<Cliente[]> {
  const raw = await AsyncStorage.getItem(KEYS.clientes);
  return raw ? JSON.parse(raw) : [];
}

export async function saveClientes(clientes: Cliente[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.clientes, JSON.stringify(clientes));
}

export async function addCliente(data: Omit<Cliente, "id" | "criadoEm">): Promise<Cliente> {
  const clientes = await getClientes();
  const novo: Cliente = { ...data, id: uuid(), criadoEm: new Date().toISOString() };
  await saveClientes([...clientes, novo]);
  return novo;
}

export async function updateCliente(id: string, data: Partial<Cliente>): Promise<void> {
  const clientes = await getClientes();
  await saveClientes(clientes.map((c) => (c.id === id ? { ...c, ...data } : c)));
}

/**
 * Atualiza o endereço do cliente mantendo um histórico dos endereços anteriores.
 * Se o novo endereço for igual ao atual, nenhuma alteração é feita.
 */
export async function atualizarEnderecoCliente(id: string, novoEndereco: string): Promise<void> {
  const novoEnderecoTrimmed = novoEndereco.trim();
  if (!novoEnderecoTrimmed) return;

  const clientes = await getClientes();
  const updated = clientes.map((c) => {
    if (c.id !== id) return c;
    const enderecoAtual = (c.endereco ?? "").trim();
    if (!enderecoAtual || enderecoAtual === novoEnderecoTrimmed) {
      // Sem endereço anterior ou mesmo endereço: apenas atualiza
      return { ...c, endereco: novoEnderecoTrimmed };
    }
    // Endereço diferente: move o atual para o histórico
    const historico = c.historicoEnderecos ?? [];
    const novoHistorico = historico.includes(enderecoAtual)
      ? historico
      : [enderecoAtual, ...historico];
    return { ...c, endereco: novoEnderecoTrimmed, historicoEnderecos: novoHistorico };
  });
  await saveClientes(updated);
}

export async function deleteCliente(id: string): Promise<void> {
  const clientes = await getClientes();
  await saveClientes(clientes.filter((c) => c.id !== id));
}

// ─── Agendamentos ─────────────────────────────────────────────────────────────

export async function getAgendamentos(): Promise<Agendamento[]> {
  const raw = await AsyncStorage.getItem(KEYS.agendamentos);
  if (!raw) return [];
  
  const agendamentos = JSON.parse(raw) as any[];
  
  // Migração: converter agendamentos antigos para novo formato
  const migrados = agendamentos.map((a) => {
    if (!a.moveis) {
      // Agendamento antigo - converter para novo formato
      return {
        ...a,
        moveis: [{
          id: uuid(),
          servicoNome: a.tipoServico || "Serviço",
          valor: a.valor ?? 0,
          quantidade: 1,
          observacao: undefined,
        }],
      };
    }
    // Verificar se os moveis estão no formato antigo (têm 'nome' em vez de 'servicoNome')
    const primeiroMovel = a.moveis[0];
    if (primeiroMovel && 'nome' in primeiroMovel && !('servicoNome' in primeiroMovel)) {
      return {
        ...a,
        moveis: a.moveis.map((m: any) => ({
          id: m.id || uuid(),
          servicoNome: m.nome || a.tipoServico || "Serviço",
          valor: m.valor ?? a.valor ?? 0,
          quantidade: m.quantidade ?? 1,
          observacao: m.observacao,
        })),
      };
    }
    // Garantir compatibilidade para registros sem observacao
    if (primeiroMovel && !("observacao" in primeiroMovel)) {
      return {
        ...a,
        moveis: a.moveis.map((m: any) => ({
          ...m,
          observacao: undefined,
        })),
      };
    }
    return a;
  });
  
  return migrados;
}

export async function saveAgendamentos(agendamentos: Agendamento[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.agendamentos, JSON.stringify(agendamentos));
}

export async function addAgendamento(data: Omit<Agendamento, "id" | "criadoEm">): Promise<Agendamento> {
  const agendamentos = await getAgendamentos();
  
  // Garantir que tipoServico não está vazio
  if (!data.tipoServico || data.tipoServico.trim() === "") {
    throw new Error("Tipo de serviço é obrigatório");
  }
  
  // Garantir que moveis existe e tem pelo menos um item
  if (!data.moveis || data.moveis.length === 0) {
    throw new Error("Adicione pelo menos um móvel/serviço");
  }
  
  const novo: Agendamento = {
    ...data,
    id: uuid(),
    criadoEm: new Date().toISOString(),
    moveis: data.moveis,
  };
  await saveAgendamentos([...agendamentos, novo]);
  return novo;
}

export async function updateAgendamento(id: string, data: Partial<Agendamento>): Promise<void> {
  const agendamentos = await getAgendamentos();
  await saveAgendamentos(agendamentos.map((a) => (a.id === id ? { ...a, ...data } : a)));
}

export async function deleteAgendamento(id: string): Promise<void> {
  const agendamentos = await getAgendamentos();
  await saveAgendamentos(agendamentos.filter((a) => a.id !== id));
}

// ─── Serviços ─────────────────────────────────────────────────────────────────

export async function getServicos(): Promise<Servico[]> {
  const raw = await AsyncStorage.getItem(KEYS.servicos);
  if (!raw) {
    await AsyncStorage.setItem(KEYS.servicos, JSON.stringify(SERVICOS_PADRAO));
    return SERVICOS_PADRAO;
  }
  return JSON.parse(raw);
}

export async function saveServicos(servicos: Servico[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.servicos, JSON.stringify(servicos));
}

export async function addServico(data: Omit<Servico, "id">): Promise<Servico> {
  const servicos = await getServicos();
  const novoServico: Servico = {
    ...data,
    id: uuid(),
  };
  await saveServicos([...servicos, novoServico]);
  return novoServico;
}

export async function updateServico(id: string, data: Partial<Servico>): Promise<void> {
  const servicos = await getServicos();
  await saveServicos(servicos.map((s) => (s.id === id ? { ...s, ...data } : s)));

  // Se o valor sugerido mudou, sincroniza os orçamentos que usam esse serviço.
  if (data.valorSugerido !== undefined) {
    await syncOrcamentosByServicoId(id, toNumberSafe(data.valorSugerido, 0));
  }
}

// ─── Orçamentos ───────────────────────────────────────────────────────────────

export async function getOrcamentos(): Promise<Orcamento[]> {
  const raw = await AsyncStorage.getItem(KEYS.orcamentos);
  if (!raw) return [];

  const parsed = JSON.parse(raw) as Array<Partial<Orcamento>>;
  const normalized = parsed.map((orcamento) => normalizeOrcamento(orcamento));

  // Persiste migração silenciosa para evitar inconsistências nas próximas leituras.
  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await saveOrcamentos(normalized);
  }

  return normalized;
}

export async function saveOrcamentos(orcamentos: Orcamento[]): Promise<void> {
  const normalized = orcamentos.map((o) => normalizeOrcamento(o));
  await AsyncStorage.setItem(KEYS.orcamentos, JSON.stringify(normalized));
}

export async function addOrcamento(data: Omit<Orcamento, "id" | "criadoEm">): Promise<Orcamento> {
  const orcamentos = await getOrcamentos();
  const novo: Orcamento = normalizeOrcamento({ ...data, id: uuid(), criadoEm: new Date().toISOString() });
  await saveOrcamentos([...orcamentos, novo]);
  return novo;
}

export async function updateOrcamento(id: string, data: Partial<Orcamento>): Promise<void> {
  const orcamentos = await getOrcamentos();
  await saveOrcamentos(
    orcamentos.map((o) => (o.id === id ? normalizeOrcamento({ ...o, ...data }) : o))
  );
}

async function syncOrcamentosByServicoId(servicoId: string, novoValor: number): Promise<void> {
  const orcamentos = await getOrcamentos();
  let updated = false;

  const sincronizados = orcamentos.map((orcamento) => {
    let touched = false;
    const itens = orcamento.itens.map((item) => {
      if (item.servicoId !== servicoId) return item;
      touched = true;
      return { ...item, valor: novoValor };
    });

    if (!touched) return orcamento;
    updated = true;
    return normalizeOrcamento({ ...orcamento, itens });
  });

  if (updated) {
    await saveOrcamentos(sincronizados);
  }
}

export async function deleteOrcamento(id: string): Promise<void> {
  const orcamentos = await getOrcamentos();
  await saveOrcamentos(orcamentos.filter((o) => o.id !== id));
}

// ─── Valor/Hora ───────────────────────────────────────────────────────────────

export async function getValorHora(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEYS.valorHora);
  return raw ? parseFloat(raw) : 100; // Padrão: R$ 100/hora
}

export async function saveValorHora(valor: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.valorHora, String(valor));
}

// ─── Tabela de Preços / Estoque ───────────────────────────────────────────────

export type CategoriaItem = "movel" | "peca";

export interface ItemEstoque {
  id: string;
  nome: string;
  categoria: CategoriaItem; // "movel" | "peca"
  precoUnitario: number;    // Custo/preço unitário
  estoque: number;          // Quantidade em estoque
  estoqueMinimo: number;    // Alerta quando estoque <= estoqueMinimo
  criadoEm: string;
}

export async function getItensEstoque(): Promise<ItemEstoque[]> {
  const raw = await AsyncStorage.getItem(KEYS.itensEstoque);
  if (!raw) return [];
  return JSON.parse(raw) as ItemEstoque[];
}

export async function saveItensEstoque(itens: ItemEstoque[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.itensEstoque, JSON.stringify(itens));
}

export async function addItemEstoque(data: Omit<ItemEstoque, "id" | "criadoEm">): Promise<ItemEstoque> {
  const itens = await getItensEstoque();
  const novo: ItemEstoque = { ...data, id: uuid(), criadoEm: new Date().toISOString() };
  await saveItensEstoque([...itens, novo]);
  return novo;
}

export async function updateItemEstoque(id: string, data: Partial<ItemEstoque>): Promise<void> {
  const itens = await getItensEstoque();
  await saveItensEstoque(itens.map((i) => (i.id === id ? { ...i, ...data } : i)));
}

export async function deleteItemEstoque(id: string): Promise<void> {
  const itens = await getItensEstoque();
  await saveItensEstoque(itens.filter((i) => i.id !== id));
}

export async function getMargemLucro(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEYS.margemLucro);
  return raw ? parseFloat(raw) : 50; // Padrão 50%
}

export async function saveMargemLucro(margem: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.margemLucro, String(margem));
}

// Margem separada por categoria
export async function getMargemMoveis(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEYS.margemMoveis);
  if (raw) return parseFloat(raw);
  // fallback: herda margem geral se existir
  return getMargemLucro();
}

export async function saveMargemMoveis(margem: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.margemMoveis, String(margem));
}

export async function getMargemPecas(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEYS.margemPecas);
  if (raw) return parseFloat(raw);
  return getMargemLucro();
}

export async function saveMargemPecas(margem: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.margemPecas, String(margem));
}
