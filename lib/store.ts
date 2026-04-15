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
  moveis?: Array<{ id: string; servicoNome: string; valor: number; quantidade: number }>; // Múltiplos móveis/serviços
  temRetorno?: boolean; // Se tem retorno para finalizar
  dataRetorno?: string; // Data do retorno
  horaRetorno?: string; // Hora do retorno
  enderecoRetorno?: string; // Endereço do retorno (pode ser diferente do inicial)
  valorRecebido?: number; // Valor realmente recebido do cliente (pode ser diferente do orçado)
  dataConclusao?: string; // Data e hora de conclusão
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
}

// ─── Orçamentos ───────────────────────────────────────────────────────────────

export async function getOrcamentos(): Promise<Orcamento[]> {
  const raw = await AsyncStorage.getItem(KEYS.orcamentos);
  return raw ? JSON.parse(raw) : [];
}

export async function saveOrcamentos(orcamentos: Orcamento[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.orcamentos, JSON.stringify(orcamentos));
}

export async function addOrcamento(data: Omit<Orcamento, "id" | "criadoEm">): Promise<Orcamento> {
  const orcamentos = await getOrcamentos();
  const novo: Orcamento = { ...data, id: uuid(), criadoEm: new Date().toISOString() };
  await saveOrcamentos([...orcamentos, novo]);
  return novo;
}

export async function updateOrcamento(id: string, data: Partial<Orcamento>): Promise<void> {
  const orcamentos = await getOrcamentos();
  await saveOrcamentos(orcamentos.map((o) => (o.id === id ? { ...o, ...data } : o)));
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
