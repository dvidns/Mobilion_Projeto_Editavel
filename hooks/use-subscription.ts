import { useState, useEffect, useCallback } from "react";
import {
  getSubscription,
  simulatePurchase,
  cancelSubscription,
  isPro as checkIsPro,
} from "@/lib/subscription-store";
import {
  activateDemoPlanRemote,
  activateLicenseRemote,
  cancelSubscriptionRemote,
  getSubscriptionRemote,
} from "@/lib/subscription-api";
import { isRevenueCatAvailable, purchaseWithRevenueCat, restoreRevenueCatPurchases } from "@/lib/revenuecat";
import type { PlanType, SubscriptionState } from "@/shared/subscription";

interface UseSubscriptionReturn {
  state: SubscriptionState | null;
  loading: boolean;
  isPro: boolean;
  purchase: (plan: PlanType) => Promise<void>;
  activateLicense: (code: string) => Promise<void>;
  cancel: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (isRevenueCatAvailable()) {
        await restoreRevenueCatPurchases();
      }
      const remote = await getSubscriptionRemote();
      setState(remote);
      await cancelSubscription();
      if (remote.plan !== "free") {
        await simulatePurchase(remote.plan);
      }
    } catch {
      const local = await getSubscription();
      setState(local);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const purchase = useCallback(async (plan: PlanType) => {
    setLoading(true);
    try {
      if (plan === "free") {
        await cancelSubscriptionRemote();
      } else {
        if (isRevenueCatAvailable()) {
          await purchaseWithRevenueCat(plan);
        } else {
          await activateDemoPlanRemote(plan);
        }
      }
      const refreshed = await getSubscriptionRemote();
      setState(refreshed);
      await cancelSubscription();
      if (refreshed.plan !== "free") {
        await simulatePurchase(refreshed.plan);
      }
    } catch {
      const next = await simulatePurchase(plan);
      setState(next);
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(async () => {
    setLoading(true);
    try {
      await cancelSubscriptionRemote();
      const refreshed = await getSubscriptionRemote();
      setState(refreshed);
      await cancelSubscription();
    } catch {
      await cancelSubscription();
      const next = await getSubscription();
      setState(next);
    } finally {
      setLoading(false);
    }
  }, []);

  const activateLicense = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const activated = await activateLicenseRemote(code);
      setState(activated);
      await cancelSubscription();
      if (activated.plan !== "free") {
        await simulatePurchase(activated.plan);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    state,
    loading,
    isPro: state ? checkIsPro(state) : false,
    purchase,
    activateLicense,
    cancel,
    refresh,
  };
}
