import { Platform } from "react-native";
import type { PlanType } from "@/shared/subscription";
import { getSubscriptionSubjectKey } from "@/lib/subscription-api";

type PurchasesModule = typeof import("react-native-purchases");

let purchasesModulePromise: Promise<PurchasesModule | null> | null = null;
let configuredSubjectKey: string | null = null;

function getApiKey(): string {
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";
  }
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
  }
  return "";
}

function getEntitlementKey() {
  return process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_KEY ?? "pro";
}

function getPlanProductId(plan: Exclude<PlanType, "free">) {
  if (plan === "annual") {
    return process.env.EXPO_PUBLIC_REVENUECAT_PRODUCT_ANNUAL_ID ?? "";
  }
  return process.env.EXPO_PUBLIC_REVENUECAT_PRODUCT_PRO_ID ?? "";
}

async function getPurchasesModule(): Promise<PurchasesModule | null> {
  if (Platform.OS === "web") return null;

  if (!purchasesModulePromise) {
    purchasesModulePromise = import("react-native-purchases").catch(() => null);
  }

  return purchasesModulePromise;
}

function hasActiveEntitlement(customerInfo: {
  entitlements?: {
    active?: Record<string, unknown>;
  };
}): boolean {
  const active = customerInfo.entitlements?.active ?? {};
  const entitlementKey = getEntitlementKey();

  if (entitlementKey && active[entitlementKey]) {
    return true;
  }

  return Object.keys(active).length > 0;
}

async function ensureConfigured(purchases: PurchasesModule): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("RevenueCat API key nao configurada no app.");
  }

  const subjectKey = await getSubscriptionSubjectKey();
  if (!subjectKey) {
    throw new Error("Nao foi possivel identificar usuario/dispositivo para assinatura.");
  }

  if (configuredSubjectKey === subjectKey) {
    return;
  }

  await purchases.default.configure({ apiKey, appUserID: subjectKey });
  configuredSubjectKey = subjectKey;
}

export function isRevenueCatAvailable(): boolean {
  return Platform.OS !== "web";
}

export async function purchaseWithRevenueCat(plan: Exclude<PlanType, "free">): Promise<void> {
  const purchases = await getPurchasesModule();
  if (!purchases) {
    throw new Error("Compras in-app indisponiveis nesta plataforma.");
  }

  await ensureConfigured(purchases);

  const preferredProductId = getPlanProductId(plan);
  const offerings = await purchases.default.getOfferings();
  const currentOffering = offerings.current;
  if (!currentOffering) {
    throw new Error("Nenhuma oferta de assinatura disponivel no momento.");
  }

  const targetPackage = preferredProductId
    ? currentOffering.availablePackages.find((pkg) => pkg.product.identifier === preferredProductId)
    : currentOffering.availablePackages.find((pkg) => {
      const productId = pkg.product.identifier.toLowerCase();
      if (plan === "annual") {
        return productId.includes("annual") || productId.includes("year");
      }
      return productId.includes("month") || productId.includes("pro");
    });

  if (!targetPackage) {
    throw new Error("Pacote do plano selecionado nao encontrado nas ofertas configuradas.");
  }

  const { customerInfo } = await purchases.default.purchasePackage(targetPackage);
  if (!hasActiveEntitlement(customerInfo)) {
    throw new Error("Compra realizada, mas sem entitlement ativo.");
  }
}

export async function restoreRevenueCatPurchases(): Promise<void> {
  const purchases = await getPurchasesModule();
  if (!purchases) return;

  await ensureConfigured(purchases);
  await purchases.default.restorePurchases();
}
