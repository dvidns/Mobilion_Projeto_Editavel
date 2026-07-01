import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { useColors } from "@/hooks/use-colors";
import { listarDespesas } from "@/lib/despesas-api";
import type { DespesaRegistro } from "@/shared/despesas";

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function DespesasTabScreen() {
  const colors = useColors();
  const router = useRouter();
  const [despesas, setDespesas] = useState<DespesaRegistro[]>([]);

  const carregar = useCallback(async () => {
    try {
      const data = await listarDespesas();
      setDespesas(data);
    } catch {
      setDespesas([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const resumo = useMemo(() => {
    const totalPF = despesas.filter((d) => d.tipoPessoa === "PF").reduce((sum, d) => sum + d.valorTotal, 0);
    const totalPJ = despesas.filter((d) => d.tipoPessoa === "PJ").reduce((sum, d) => sum + d.valorTotal, 0);
    return { totalPF, totalPJ, totalGeral: totalPF + totalPJ };
  }, [despesas]);

  return (
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>Despesas</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: "#fff" }]}
          onPress={() => router.push("/despesas/nova" as any)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>PF</Text>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>{formatMoney(resumo.totalPF)}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>PJ</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{formatMoney(resumo.totalPJ)}</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <TouchableOpacity
          style={[styles.reportBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push("/relatorios-fiscais" as any)}
          activeOpacity={0.75}
        >
          <MaterialIcons name="summarize" size={20} color={colors.primary} />
          <Text style={[styles.reportBtnText, { color: colors.foreground }]}>Abrir Relatórios Fiscais</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={despesas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
            <MaterialIcons name="receipt-long" size={44} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>Nenhuma despesa cadastrada ainda.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/despesas/${item.id}` as any)}>
            <Card>
              <View style={styles.rowBetween}>
                <Text style={[styles.nome, { color: colors.foreground }]} numberOfLines={1}>{item.fornecedorNome}</Text>
                <View style={[styles.badge, { backgroundColor: item.tipoPessoa === "PF" ? colors.warning + "25" : colors.success + "25" }]}> 
                  <Text style={{ color: item.tipoPessoa === "PF" ? colors.warning : colors.success, fontWeight: "700" }}>{item.tipoPessoa}</Text>
                </View>
              </View>
              <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>
                {item.dataEmissao ?? item.createdAt.slice(0, 10)} {item.fornecedorCnpj ? `· CNPJ ${item.fornecedorCnpj}` : ""}
              </Text>
              <View style={styles.rowBetween}>
                <Text style={[styles.valor, { color: colors.primary }]}>{formatMoney(item.valorTotal)}</Text>
                {item.conferidoIR ? (
                  <Text style={[styles.sub, { color: colors.success }]}>Conferido IR</Text>
                ) : (
                  <Text style={[styles.sub, { color: colors.muted }]}>Pendente IR</Text>
                )}
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 12,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  reportBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reportBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  empty: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  nome: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  sub: {
    fontSize: 12,
    marginTop: 4,
  },
  valor: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
