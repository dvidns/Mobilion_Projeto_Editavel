import { useState, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, AppState, type AppStateStatus,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useColors } from "@/hooks/use-colors";
import * as WebBrowser from "expo-web-browser";
import {
  getAgendamentos,
  type Agendamento,
} from "@/lib/store";

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

function toLocalISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function msUntilNextLocalMidnight(from = new Date()) {
  const nextMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 0, 0, 0, 50);
  return Math.max(1000, nextMidnight.getTime() - from.getTime());
}

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type AgendamentoComRetorno = Agendamento & { isRetorno: boolean };

function getValorExibicao(item: Pick<Agendamento, "valor" | "valorRecebido" | "temRetorno" | "moveis">) {
  const valorBase = item.valorRecebido ?? item.valor;
  if (!item.temRetorno) return valorBase;
  const totalMoveis = (item.moveis ?? []).reduce(
    (sum, m) => sum + (Number(m.valor) || 0) * (Number(m.quantidade) || 1),
    0
  );
  return totalMoveis > 0 ? totalMoveis / 2 : valorBase;
}

function getStatusExibicao(item: AgendamentoComRetorno): Agendamento["status"] {
  if (item.status !== "retorno") return item.status;
  return item.isRetorno ? "retorno" : "concluido";
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const [agendamentos, setAgendamentos] = useState<AgendamentoComRetorno[]>([]);
  const [today, setToday] = useState(() => toLocalISODate());

  const loadForDate = useCallback(async (dateISO: string) => {
    const all = await getAgendamentos();
    const todayItems = all
      .flatMap((a): AgendamentoComRetorno[] => {
        const items: AgendamentoComRetorno[] = [];
        if (a.data === dateISO) {
          items.push({ ...a, isRetorno: false });
        }
        if (a.temRetorno && a.dataRetorno === dateISO) {
          items.push({ ...a, isRetorno: true });
        }
        return items;
      })
      .sort((a, b) => {
        const horaA = a.isRetorno ? (a.horaRetorno || "00:00") : a.hora;
        const horaB = b.isRetorno ? (b.horaRetorno || "00:00") : b.hora;
        return horaA.localeCompare(horaB);
      });
    setAgendamentos(todayItems);
  }, []);

  useEffect(() => {
    void loadForDate(today);
  }, [loadForDate, today]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setToday(toLocalISODate());
    }, msUntilNextLocalMidnight());

    return () => clearTimeout(timeout);
  }, [today]);

  useEffect(() => {
    const onAppStateChange = (state: AppStateStatus) => {
      if (state !== "active") return;
      const localToday = toLocalISODate();
      setToday((prev) => (prev === localToday ? prev : localToday));
      void loadForDate(localToday);
    };

    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, [loadForDate]);

  useFocusEffect(useCallback(() => {
    void loadForDate(today);
  }, [loadForDate, today]));

  const total = agendamentos
    .filter((a) => a.status !== "cancelado")
    .reduce((sum, a) => sum + getValorExibicao(a), 0);

  const confirmados = agendamentos.filter((a) => a.status === "confirmado" || a.status === "concluido").length;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View>
          <Text style={styles.headerSub}>Hoje</Text>
          <Text style={styles.headerDate}>{formatDate(new Date(`${today}T12:00:00`))}</Text>
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
        keyExtractor={(i) => `${i.id}-${i.isRetorno ? "retorno" : "ag"}`}
        renderItem={({ item }) => {
          const hora = item.isRetorno ? (item.horaRetorno || "—") : item.hora;
          const label = item.isRetorno ? `🔄 Retorno - ${item.tipoServico}` : item.tipoServico;
          const endereco = item.isRetorno ? (item.enderecoRetorno || item.endereco) : item.endereco;
          const bgColor = item.isRetorno ? colors.warning + "18" : colors.primary + "18";
          const textColor = item.isRetorno ? colors.warning : colors.primary;
          return (
            <Card
              onPress={() =>
                router.push({
                  pathname: "/agendamento/[id]",
                  params: {
                    id: item.id,
                    etapa: item.isRetorno ? "retorno" : "agendamento",
                  },
                } as any)
              }
            >
              <View style={styles.cardRow}>
                <View style={[styles.timeBox, { backgroundColor: bgColor }]}>
                  <Text style={[styles.timeText, { color: textColor }]}>{hora}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.clienteNome}
                  </Text>
                  <Text style={[styles.cardService, { color: colors.muted }]} numberOfLines={1}>
                    {label}
                  </Text>
                  {endereco ? (
                    <Text style={[styles.cardAddr, { color: colors.muted }]} numberOfLines={1}>
                      📍 {endereco}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.cardValue, { color: colors.success }]}>
                    {formatMoney(getValorExibicao(item))}
                  </Text>
                  <View style={styles.cardActions}>
                    {endereco && (
                      <TouchableOpacity
                        onPress={() => {
                          const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(endereco || "")}`;
                          WebBrowser.openBrowserAsync(mapsUrl);
                        }}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="location-on" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                    <StatusBadge status={getStatusExibicao(item)} />
                  </View>
                </View>
              </View>
            </Card>
          );
        }}
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
