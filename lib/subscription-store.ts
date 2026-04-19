import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanType = "free" | "pro" | "annual";

export interface SubscriptionState {
  plan: PlanType;
  /** ISO date string — null = nunca expira (free) ou assinatura ativa sem data fim */
  expiresAt: string | null;
  /** ISO date string de quando assinou */
  subscribedAt: string | null;
  /** Simulado localmente até RevenueCat ser integrado */
  isSimulated: boolean;
}

export interface PlanInfo {
  id: PlanType;
  name: string;
  price: string;
  priceMonthly: string; // Valor por mês (para anual mostrar equivalente)
  period: string;
  badge?: string;
  features: string[];
}

// ─── Planos disponíveis ───────────────────────────────────────────────────────

export const PLANS: PlanInfo[] = [
  {
    id: "free",
    name: "Grátis",
    price: "R$ 0",
    priceMonthly: "R$ 0",
    period: "para sempre",
    features: [
      "Até 30 agendamentos/mês",
      "Cadastro de clientes",
      "Agenda e calendário",
      "WhatsApp de lembrete",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 19,90",
    priceMonthly: "R$ 19,90",
    period: "por mês",
    features: [
      "Agendamentos ilimitados",
      "Relatório de faturamento",
      "Orçamentos em PDF e imagem",
      "Painel de controle",
      "Tabela de preços personalizada",
      "Backup automático na nuvem",
    ],
  },
  {
    id: "annual",
    name: "Anual",
    price: "R$ 159",
    priceMonthly: "R$ 13,25",
    period: "por ano",
    badge: "Melhor custo",
    features: [
      "Tudo do Pro",
      "Equivale a R$ 13,25/mês",
      "2 meses grátis em relação ao mensal",
      "Prioridade no suporte",
    ],
  },
];

// ─── Storage key ─────────────────────────────────────────────────────────────

const KEY = "@montafacil:subscription";

const DEFAULT_STATE: SubscriptionState = {
  plan: "free",
  expiresAt: null,
  subscribedAt: null,
  isSimulated: false,
};

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getSubscription(): Promise<SubscriptionState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed: SubscriptionState = JSON.parse(raw);
    // Se expirou, volta para free
    if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
      await saveSubscription({ ...DEFAULT_STATE });
      return { ...DEFAULT_STATE };
    }
    return parsed;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveSubscription(state: SubscriptionState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

/**
 * Simula assinatura localmente (usado até RevenueCat ser integrado).
 * Pro: 30 dias. Annual: 365 dias.
 */
export async function simulatePurchase(plan: PlanType): Promise<SubscriptionState> {
  if (plan === "free") {
    const state: SubscriptionState = { ...DEFAULT_STATE };
    await saveSubscription(state);
    return state;
  }

  const now = new Date();
  const days = plan === "annual" ? 365 : 30;
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const state: SubscriptionState = {
    plan,
    expiresAt,
    subscribedAt: now.toISOString(),
    isSimulated: true,
  };
  await saveSubscription(state);
  return state;
}

export async function cancelSubscription(): Promise<void> {
  await saveSubscription({ ...DEFAULT_STATE });
}

export function isPlanActive(state: SubscriptionState): boolean {
  if (state.plan === "free") return true;
  if (!state.expiresAt) return true;
  return new Date(state.expiresAt) > new Date();
}

export function isPro(state: SubscriptionState): boolean {
  return (state.plan === "pro" || state.plan === "annual") && isPlanActive(state);
}
