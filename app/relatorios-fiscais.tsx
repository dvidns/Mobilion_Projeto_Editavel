import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/button";
import { useColors } from "@/hooks/use-colors";
import { exportarCsvIR, obterResumoFiscal } from "@/lib/despesas-api";
import type { RelatorioFiscalResumo } from "@/shared/despesas";

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ANO_INICIAL = 2023;

export default function RelatoriosFiscaisScreen() {
  const colors = useColors();
  const router = useRouter();

  const now = new Date();
  const [periodo, setPeriodo] = useState<"mensal" | "anual">("mensal");
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [resumo, setResumo] = useState<RelatorioFiscalResumo | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  async function carregarResumo() {
    setLoading(true);
    try {
      const data = await obterResumoFiscal({ ano, mes: periodo === "mensal" ? mes : undefined });
      setResumo(data);
    } catch (error) {
      Alert.alert("Erro", `Falha ao carregar resumo fiscal: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarResumo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, ano, mes]);

  async function exportarCsv() {
    setExporting(true);
    try {
      const csv = await exportarCsvIR({ ano, mes: periodo === "mensal" ? mes : undefined });
      const sufixo = periodo === "mensal" ? `${ano}-${String(mes).padStart(2, "0")}` : String(ano);
      const fileUri = `${FileSystem.documentDirectory}despesas-ir-${sufixo}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Exportar CSV para IR",
        });
      } else {
        Alert.alert("Sucesso", `Arquivo CSV salvo em ${fileUri}`);
      }
    } catch (error) {
      Alert.alert("Erro", `Falha na exportação CSV: ${String(error)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}> 
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Relatórios Fiscais</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Período</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.chip, { borderColor: periodo === "mensal" ? colors.primary : colors.border, backgroundColor: colors.surface }]}
            onPress={() => setPeriodo("mensal")}
          >
            <Text style={{ color: periodo === "mensal" ? colors.primary : colors.foreground, fontWeight: "700" }}>Mensal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, { borderColor: periodo === "anual" ? colors.primary : colors.border, backgroundColor: colors.surface }]}
            onPress={() => setPeriodo("anual")}
          >
            <Text style={{ color: periodo === "anual" ? colors.primary : colors.foreground, fontWeight: "700" }}>Anual</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Ano</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity style={[styles.stepBtn, { borderColor: colors.border }]} onPress={() => setAno((a) => Math.max(ANO_INICIAL, a - 1))}>
            <MaterialIcons name="remove" size={18} color={colors.muted} />
          </TouchableOpacity>
          <Text style={[styles.stepValue, { color: colors.foreground }]}>{ano}</Text>
          <TouchableOpacity style={[styles.stepBtn, { borderColor: colors.border }]} onPress={() => setAno((a) => Math.min(now.getFullYear(), a + 1))}>
            <MaterialIcons name="add" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {periodo === "mensal" && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Mês</Text>
            <View style={styles.monthGrid}>
              {meses.map((nome, idx) => {
                const value = idx + 1;
                const selected = mes === value;
                return (
                  <TouchableOpacity
                    key={nome}
                    style={[
                      styles.monthChip,
                      { borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.surface },
                    ]}
                    onPress={() => setMes(value)}
                  >
                    <Text style={{ color: selected ? colors.primary : colors.foreground, fontWeight: "600" }}>{nome}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Consolidado IR</Text>
          {loading ? (
            <Text style={{ color: colors.muted }}>Carregando resumo...</Text>
          ) : (
            <>
              <View style={styles.kpiRow}>
                <Text style={[styles.kpiLabel, { color: colors.muted }]}>Total PF</Text>
                <Text style={[styles.kpiValue, { color: colors.warning }]}>{formatMoney(resumo?.totalPF ?? 0)}</Text>
              </View>
              <View style={styles.kpiRow}>
                <Text style={[styles.kpiLabel, { color: colors.muted }]}>Total PJ</Text>
                <Text style={[styles.kpiValue, { color: colors.success }]}>{formatMoney(resumo?.totalPJ ?? 0)}</Text>
              </View>
              <View style={styles.kpiRow}>
                <Text style={[styles.kpiLabel, { color: colors.muted }]}>Total Geral</Text>
                <Text style={[styles.kpiValue, { color: colors.primary }]}>{formatMoney(resumo?.totalGeral ?? 0)}</Text>
              </View>
            </>
          )}
        </View>

        <Button
          title={exporting ? "Exportando CSV..." : "Exportar CSV para Contabilidade"}
          onPress={exportarCsv}
          loading={exporting}
          disabled={exporting}
          icon={!exporting ? <MaterialIcons name="download" size={16} color="#fff" /> : undefined}
        />
      </View>
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
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    flex: 1,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    fontSize: 18,
    fontWeight: "700",
    minWidth: 64,
    textAlign: "center",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  monthChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    width: "22%",
    alignItems: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  kpiLabel: {
    fontSize: 13,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "700",
  },
});
