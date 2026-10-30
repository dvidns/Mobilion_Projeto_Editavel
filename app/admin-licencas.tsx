import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/button";
import { useColors } from "@/hooks/use-colors";
import { createLicenseRemote, listLicensesRemote, revokeLicenseRemote, type LicenseSummary } from "@/lib/subscription-api";
import type { PlanType } from "@/shared/subscription";

export default function AdminLicencasScreen() {
  const colors = useColors();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Extract<PlanType, "pro" | "annual">>("pro");
  const [items, setItems] = useState<LicenseSummary[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLicensesRemote();
      setItems(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar licenças";
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleCreate() {
    setLoading(true);
    try {
      const created = await createLicenseRemote({
        plan,
        maxActivations: 1,
      });
      Alert.alert(
        "Chave gerada",
        `Plano: ${created.plan === "annual" ? "Anual" : "Pro"}\nChave: ${created.code}`,
      );
      await carregar();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao criar licença";
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(licenseId: number) {
    Alert.alert("Revogar chave", "Deseja revogar esta licença?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Revogar",
        style: "destructive",
        onPress: async () => {
          try {
            await revokeLicenseRemote(licenseId);
            await carregar();
          } catch (error) {
            const message = error instanceof Error ? error.message : "Falha ao revogar licença";
            Alert.alert("Erro", message);
          }
        },
      },
    ]);
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin de Licenças</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>GERAR NOVA CHAVE</Text>

        <View style={styles.planRow}>
          <TouchableOpacity
            style={[
              styles.planChip,
              {
                borderColor: plan === "pro" ? colors.primary : colors.border,
                backgroundColor: colors.surface,
              },
            ]}
            onPress={() => setPlan("pro")}
          >
            <Text style={{ color: plan === "pro" ? colors.primary : colors.foreground, fontWeight: "700" }}>Pro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.planChip,
              {
                borderColor: plan === "annual" ? colors.primary : colors.border,
                backgroundColor: colors.surface,
              },
            ]}
            onPress={() => setPlan("annual")}
          >
            <Text style={{ color: plan === "annual" ? colors.primary : colors.foreground, fontWeight: "700" }}>Anual</Text>
          </TouchableOpacity>
        </View>

        <Button
          title={loading ? "Gerando..." : "Gerar chave (1 aparelho)"}
          onPress={handleCreate}
          loading={loading}
          disabled={loading}
          icon={!loading ? <MaterialIcons name="vpn-key" size={16} color="#fff" /> : undefined}
        />

        <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 14 }]}>CHAVES CADASTRADAS</Text>

        {items.map((item) => (
          <View key={item.id} style={[styles.itemCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.itemRow}>
              <Text style={[styles.itemTitle, { color: colors.foreground }]}>#{item.id} · ****{item.codeHint}</Text>
              <Text style={{ color: item.status === "active" ? colors.success : colors.error, fontWeight: "700" }}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: colors.muted }}>
              Plano: {item.plan === "annual" ? "Anual" : "Pro"} · Ativações: {item.usedCount}/{item.maxActivations}
            </Text>
            {item.status === "active" && (
              <TouchableOpacity style={[styles.revokeBtn, { borderColor: colors.error }]} onPress={() => handleRevoke(item.id)}>
                <Text style={{ color: colors.error, fontWeight: "700" }}>Revogar</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
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
    paddingVertical: 14,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  planRow: {
    flexDirection: "row",
    gap: 8,
  },
  planChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  revokeBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
});
