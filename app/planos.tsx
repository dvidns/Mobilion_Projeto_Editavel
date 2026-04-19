import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSubscription } from "@/hooks/use-subscription";
import { PLANS, type PlanType } from "@/lib/subscription-store";

function formatExpiry(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function PlanosScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, loading, isPro, purchase, cancel } = useSubscription();

  async function handlePurchase(planId: PlanType) {
    if (planId === "free") {
      Alert.alert("Plano Grátis", "Você já tem acesso ao plano gratuito.");
      return;
    }
    const plan = PLANS.find((p) => p.id === planId)!;
    Alert.alert(
      `Assinar ${plan.name}`,
      `${plan.price} ${plan.period}\n\n⚠️ Modo demonstração: nenhuma cobrança real será realizada.\n\nA cobrança real será ativada em breve via Google Play.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Ativar demonstração",
          onPress: async () => {
            await purchase(planId);
            Alert.alert(
              "✅ Plano ativado!",
              `Você agora tem acesso ao MontaFácil ${plan.name} por 30 dias (demonstração).`,
            );
          },
        },
      ],
    );
  }

  async function handleCancel() {
    Alert.alert(
      "Cancelar assinatura",
      "Tem certeza? Você voltará para o plano gratuito.",
      [
        { text: "Manter plano", style: "cancel" },
        {
          text: "Cancelar assinatura",
          style: "destructive",
          onPress: async () => {
            await cancel();
            Alert.alert("Assinatura cancelada", "Você voltou para o plano Grátis.");
          },
        },
      ],
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planos</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.primary + "12" }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + "20" }]}>
            <MaterialIcons name="workspace-premium" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>MontaFácil Pro</Text>
          <Text style={[styles.heroSub, { color: colors.muted }]}>
            Desbloqueie relatórios, orçamentos em PDF, painel completo e muito mais.
          </Text>
        </View>

        {/* Status atual */}
        {!loading && state && (
          <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statusRow}>
              <MaterialIcons
                name={isPro ? "verified" : "lock-open"}
                size={20}
                color={isPro ? colors.success : colors.muted}
              />
              <Text style={[styles.statusText, { color: colors.foreground }]}>
                Plano atual:{" "}
                <Text style={{ fontWeight: "700", color: isPro ? colors.success : colors.foreground }}>
                  {PLANS.find((p) => p.id === state.plan)?.name ?? "Grátis"}
                </Text>
              </Text>
            </View>
            {isPro && state.expiresAt && (
              <Text style={[styles.statusExpiry, { color: colors.muted }]}>
                {state.isSimulated ? "⚠️ Demonstração · " : ""}
                Válido até {formatExpiry(state.expiresAt)}
              </Text>
            )}
          </View>
        )}

        {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />}

        {/* Cards de plano */}
        {PLANS.map((plan) => {
          const isCurrentPlan = state?.plan === plan.id;
          const isHighlighted = plan.id === "annual";

          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isHighlighted ? colors.primary : isCurrentPlan ? colors.success : colors.border,
                  borderWidth: isHighlighted || isCurrentPlan ? 2 : 1,
                },
              ]}
            >
              {/* Badge topo */}
              {(plan.badge || isCurrentPlan) && (
                <View style={[
                  styles.planBadge,
                  { backgroundColor: isCurrentPlan ? colors.success : colors.primary },
                ]}>
                  <Text style={styles.planBadgeText}>
                    {isCurrentPlan ? "SEU PLANO" : plan.badge}
                  </Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                <View style={styles.planPriceRow}>
                  <Text style={[styles.planPrice, { color: isHighlighted ? colors.primary : colors.foreground }]}>
                    {plan.price}
                  </Text>
                  <Text style={[styles.planPeriod, { color: colors.muted }]}>  {plan.period}</Text>
                </View>
                {plan.id === "annual" && (
                  <Text style={[styles.planEquiv, { color: colors.success }]}>
                    Equivale a {plan.priceMonthly}/mês
                  </Text>
                )}
              </View>

              <View style={styles.planFeatures}>
                {plan.features.map((feat) => (
                  <View key={feat} style={styles.featureRow}>
                    <MaterialIcons
                      name="check-circle"
                      size={16}
                      color={plan.id === "free" ? colors.muted : colors.success}
                    />
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{feat}</Text>
                  </View>
                ))}
              </View>

              {/* Botão */}
              {isCurrentPlan ? (
                plan.id !== "free" && (
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.error }]}
                    onPress={handleCancel}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cancelBtnText, { color: colors.error }]}>Cancelar assinatura</Text>
                  </TouchableOpacity>
                )
              ) : (
                plan.id !== "free" && (
                  <TouchableOpacity
                    style={[
                      styles.purchaseBtn,
                      { backgroundColor: isHighlighted ? colors.primary : colors.primary + "15" },
                    ]}
                    onPress={() => handlePurchase(plan.id)}
                    activeOpacity={0.8}
                    disabled={loading}
                  >
                    <Text style={[
                      styles.purchaseBtnText,
                      { color: isHighlighted ? "#fff" : colors.primary },
                    ]}>
                      {loading ? "Aguarde..." : `Assinar ${plan.name}`}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          );
        })}

        {/* Nota de rodapé */}
        <Text style={[styles.note, { color: colors.muted }]}>
          💳 O pagamento será processado via Google Play Store.{"\n"}
          Você pode cancelar a qualquer momento nas configurações.{"\n\n"}
          ⚠️ Atualmente em modo demonstração — nenhuma cobrança real.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  content: {
    padding: 16,
    paddingBottom: 60,
    gap: 14,
  },
  hero: {
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  heroSub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  statusCard: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 14,
  },
  statusExpiry: {
    fontSize: 12,
    marginLeft: 28,
  },
  planCard: {
    borderRadius: 14,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },
  planBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 2,
  },
  planBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  planHeader: {
    gap: 4,
  },
  planName: {
    fontSize: 20,
    fontWeight: "700",
  },
  planPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  planPrice: {
    fontSize: 28,
    fontWeight: "800",
  },
  planPeriod: {
    fontSize: 14,
  },
  planEquiv: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  planFeatures: {
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  purchaseBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  purchaseBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  cancelBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    marginTop: 4,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 4,
  },
});
