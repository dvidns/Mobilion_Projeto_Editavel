import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useColors } from "@/hooks/use-colors";
import * as WebBrowser from "expo-web-browser";
import {
  getAgendamentos, updateAgendamento,
  type Agendamento, type StatusAgendamento,
} from "@/lib/store";

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getValorExibicao(item: Pick<Agendamento, "valor" | "valorRecebido">) {
  return item.valorRecebido ?? item.valor;
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const all = await getAgendamentos();
    const todayItems = all
      .filter((a) => a.data === today)
      .sort((a, b) => a.hora.localeCompare(b.hora));
    setAgendamentos(todayItems);
  }, [today]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = agendamentos
    .filter((a) => a.status !== "cancelado")
    .reduce((sum, a) => sum + (a.valorRecebido ?? a.valor), 0);

  const confirmados = agendamentos.filter((a) => a.status === "confirmado" || a.status === "concluido").length;

  function handleStatusChange(item: Agendamento) {
    const opcoes: { label: string; value: StatusAgendamento }[] = [
      { label: "Pendente", value: "pendente" },
      { label: "Confirmado", value: "confirmado" },
      { label: "Concluído", value: "concluido" },
      { label: "Cancelado", value: "cancelado" },
    ];
    Alert.alert("Alterar status", item.clienteNome, [
      ...opcoes.map((o) => ({
        text: o.label,
        onPress: async () => {
          await updateAgendamento(item.id, { status: o.value });
          load();
        },
      })),
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View>
          <Text style={styles.headerSub}>Hoje</Text>
          <Text style={styles.headerDate}>{formatDate(new Date())}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: "#fff" }]}
          onPress={() => router.push("/agendamento/novo" as any)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary cards */}
      <View style={[styles.summaryRow, { backgroundColor: colors.primary }]}>
        <View style={[styles.summaryCard, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
          <Text style={styles.summaryNum}>{agendamentos.length}</Text>
          <Text style={styles.summaryLabel}>Serviços</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
          <Text style={styles.summaryNum}>{confirmados}</Text>
          <Text style={styles.summaryLabel}>Confirmados</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
          <Text style={styles.summaryNum}>{formatMoney(total)}</Text>
          <Text style={styles.summaryLabel}>Previsto</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={agendamentos}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="event-available" size={52} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Nenhum serviço para hoje
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/agendamento/novo" as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyBtnText}>+ Novo agendamento</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/agendamento/${item.id}` as any)}>
            <View style={styles.cardRow}>
              <View style={[styles.timeBox, { backgroundColor: colors.primary + "18" }]}>
                <Text style={[styles.timeText, { color: colors.primary }]}>{item.hora}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.clienteNome}
                </Text>
                <Text style={[styles.cardService, { color: colors.muted }]} numberOfLines={1}>
                  {item.tipoServico}
                </Text>
                {item.endereco ? (
                  <Text style={[styles.cardAddr, { color: colors.muted }]} numberOfLines={1}>
                    📍 {item.endereco}
                  </Text>
                ) : null}
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.cardValue, { color: colors.success }]}>
                  {formatMoney(getValorExibicao(item))}
                </Text>
                <View style={styles.cardActions}>
                  {item.endereco && (
                    <TouchableOpacity
                      onPress={() => {
                        const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(item.endereco || '')}`;
                        WebBrowser.openBrowserAsync(mapsUrl);
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="location-on" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  <StatusBadge status={item.status} />
                </View>
              </View>
            </View>
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 0,
  },
  headerSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "500",
  },
  headerDate: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  summaryNum: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    marginTop: 2,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardService: {
    fontSize: 13,
  },
  cardAddr: {
    fontSize: 12,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
