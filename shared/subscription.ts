export type PlanType = "free" | "pro" | "annual";

export interface SubscriptionState {
  plan: PlanType;
  /** ISO date string — null = nunca expira (free) ou assinatura ativa sem data fim */
  expiresAt: string | null;
  /** ISO date string de quando assinou */
  subscribedAt: string | null;
  /** Modo simulado/local ou plano de demonstracao */
  isSimulated: boolean;
}
