import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getAgendamentos, type Agendamento, type StatusAgendamento } from "@/lib/store";

function getWeekDates() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function formatDateShort(dateStr: string) {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" });
}

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_COLORS: Record<StatusAgendamento, { bg: string; text: string; icon: string }> = {
  pendente: { bg: "#FEF3C7", text: "#92400E", icon: "schedule" },
  confirmado: { bg: "#DBEAFE", text: "#1E40AF", icon: "check-circle" },
  concluido: { bg: "#DCFCE7", text: "#166534", icon: "done-all" },
  cancelado: { bg: "#FEE2E2", text: "#991B1B", icon: "cancel" },
  retorno: { bg: "#FED7AA", text: "#9A3412", icon: "event" },
};

export default function PainelScreen() {
  const colors = useColors();
  const router = useRouter();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [weekDates, setWeekDates] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const all = await getAgendamentos();
      const dates = getWeekDates();
      setWeekDates(dates);

      // Filtrar agendamentos da semana
      const weekItems = all.filter((a) => dates.includes(a.data));
      setAgendamentos(weekItems);
    } catch (err) {
      console.error("Erro ao carregar agendamentos:", err);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Calcular estatísticas
  const stats = {
    total: agendamentos.length,
    pendentes: agendamentos.filter((a) => a.status === "pendente").length,
    confirmados: agendamentos.filter((a) => a.status === "confirmado").length,
    concluidos: agendamentos.filter((a) => a.status === "concluido").length,
    cancelados: agendamentos.filter((a) => a.status === "cancelado").length,
    totalValue: agendamentos
      .filter((a) => a.status !== "cancelado")
      .reduce((sum, a) => sum + (a.valorRecebido ?? a.valor), 0),
  };

  // Agrupar por dia
  const agendamentosPorDia: Record<string, Agendamento[]> = {};
  weekDates.forEach((date) => {
    agendamentosPorDia[date] = agendamentos
      .filter((a) => a.data === date)
      .sort((a, b) => a.hora.localeCompare(b.hora));
  });

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Painel de Controle</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Cards de Estatísticas */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: "#3B82F6" + "18" }]}>
              <MaterialIcons name="event" size={24} color="#3B82F6" />
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Total</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: "#FCD34D" + "18" }]}>
              <MaterialIcons name="schedule" size={24} color="#F59E0B" />
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.pendentes}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Pendentes</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: "#60A5FA" + "18" }]}>
              <MaterialIcons name="check-circle" size={24} color="#3B82F6" />
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.confirmados}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Confirmados</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: "#34D399" + "18" }]}>
              <MaterialIcons name="done-all" size={24} color="#10B981" />
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.concluidos}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Concluídos</Text>
          </View>
        </View>

        {/* Card de Valor Total */}
        <View style={[styles.valueCard, { backgroundColor: colors.primary }]}>
          <View>
            <Text style={styles.valueLabel}>Faturamento Previsto</Text>
            <Text style={styles.valueAmount}>{formatMoney(stats.totalValue)}</Text>
          </View>
          <MaterialIcons name="trending-up" size={40} color="rgba(255,255,255,0.3)" />
        </View>

        {/* Agendamentos por Dia */}
        <View style={styles.weekSection}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>SEMANA</Text>

          {weekDates.map((date) => {
            const dayAgendamentos = agendamentosPorDia[date] || [];
            const dayName = formatDateShort(date);

            return (
              <View key={date} style={styles.dayContainer}>
                <View style={[styles.dayHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.dayName, { color: colors.foreground }]}>{dayName}</Text>
                  <View style={[styles.dayBadge, { backgroundColor: colors.primary + "18" }]}>
                    <Text style={[styles.dayBadgeText, { color: colors.primary }]}>
                      {dayAgendamentos.length}
                    </Text>
                  </View>
                </View>

                {dayAgendamentos.length > 0 ? (
                  <View style={styles.dayItems}>
                    {dayAgendamentos.map((item) => {
                      const statusColor = STATUS_COLORS[item.status];
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.dayItem, { backgroundColor: statusColor.bg, borderColor: statusColor.text }]}
                          onPress={() => router.push(`/agendamento/${item.id}` as any)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.dayItemLeft}>
                            <Text style={[styles.dayItemTime, { color: statusColor.text }]}>
                              {item.hora}
                            </Text>
                            <View style={styles.dayItemInfo}>
                              <Text style={[styles.dayItemName, { color: statusColor.text }]} numberOfLines={1}>
                                {item.clienteNome}
                              </Text>
                              <Text style={[styles.dayItemService, { color: statusColor.text, opacity: 0.7 }]} numberOfLines={1}>
                                {item.tipoServico}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.dayItemRight}>
                            <MaterialIcons name={statusColor.icon as "schedule" | "check-circle" | "done-all" | "cancel"} size={20} color={statusColor.text} />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={[styles.emptyDay, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MaterialIcons name="event-available" size={24} color={colors.border} />
                    <Text style={[styles.emptyDayText, { color: colors.muted }]}>Sem agendamentos</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Legenda de Status */}
        <View style={styles.legendSection}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>LEGENDA DE STATUS</Text>
          <View style={styles.legendGrid}>
            {(Object.entries(STATUS_COLORS) as [StatusAgendamento, typeof STATUS_COLORS.pendente][]).map(
              ([status, color]) => (
                <View key={status} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color.bg, borderColor: color.text, borderWidth: 1.5 }]}>
                    <MaterialIcons name={color.icon as "schedule" | "check-circle" | "done-all" | "cancel"} size={12} color={color.text} />
                  </View>
                  <Text style={[styles.legendLabel, { color: colors.foreground }]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </View>
              )
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: "48%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  valueCard: {
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  valueLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  valueAmount: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  weekSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  dayContainer: {
    gap: 8,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayName: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  dayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  dayItems: {
    gap: 6,
  },
  dayItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayItemLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dayItemTime: {
    fontSize: 13,
    fontWeight: "700",
    minWidth: 40,
  },
  dayItemInfo: {
    flex: 1,
  },
  dayItemName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  dayItemService: {
    fontSize: 11,
  },
  dayItemRight: {
    marginLeft: 8,
  },
  emptyDay: {
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 6,
  },
  emptyDayText: {
    fontSize: 12,
  },
  legendSection: {
    gap: 8,
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
});
