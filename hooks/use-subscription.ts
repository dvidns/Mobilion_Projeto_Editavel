import { useState, useEffect, useCallback } from "react";
import {
  getSubscription,
  simulatePurchase,
  cancelSubscription,
  isPro as checkIsPro,
  type SubscriptionState,
  type PlanType,
} from "@/lib/subscription-store";

interface UseSubscriptionReturn {
  state: SubscriptionState | null;
  loading: boolean;
  isPro: boolean;
  purchase: (plan: PlanType) => Promise<void>;
  cancel: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await getSubscription();
    setState(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const purchase = useCallback(async (plan: PlanType) => {
    setLoading(true);
    const next = await simulatePurchase(plan);
    setState(next);
    setLoading(false);
  }, []);

  const cancel = useCallback(async () => {
    setLoading(true);
    await cancelSubscription();
    const next = await getSubscription();
    setState(next);
    setLoading(false);
  }, []);

  return {
    state,
    loading,
    isPro: state ? checkIsPro(state) : false,
    purchase,
    cancel,
    refresh,
  };
}
