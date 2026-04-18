import { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView, Linking,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useColors } from "@/hooks/use-colors";
import { getAgendamentos, type Agendamento } from "@/lib/store";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function toISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getValorExibicao(item: Agendamento & { isRetorno?: boolean }) {
  const valorBase = item.valorRecebido ?? item.valor;

  if (!item.temRetorno) {
    return valorBase;
  }

  const totalMoveis = (item.moveis ?? []).reduce(
    (sum, movel) => sum + (Number(movel.valor) || 0) * (Number(movel.quantidade) || 1),
    0
  );

  if (totalMoveis > 0) {
    return totalMoveis / 2;
  }

  return valorBase;
}

export default function AgendaScreen() {
  const colors = useColors();
  const router = useRouter();
  const today = toISO(new Date());

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [allAgendamentos, setAllAgendamentos] = useState<Agendamento[]>([]);

  const load = useCallback(async () => {
    const all = await getAgendamentos();
    setAllAgendamentos(all);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Build calendar days
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Dates with agendamentos (incluindo retornos)
  const datesWithItems = new Set(
    allAgendamentos
      .filter((a) => a.status !== "cancelado")
      .flatMap((a) => {
        const dates = [a.data];
        if (a.temRetorno && a.dataRetorno) {
          dates.push(a.dataRetorno);
        }
        return dates;
      })
  );

  // Items for selected date (incluindo retornos)
  const dayItems = allAgendamentos
    .flatMap((a) => {
      const items = [];
      // Agendamento original
      if (a.data === selectedDate) {
        items.push({ ...a, isRetorno: false });
      }
      // Retorno
      if (a.temRetorno && a.dataRetorno === selectedDate) {
        items.push({ ...a, isRetorno: true });
      }
      return items;
    })
    .sort((a, b) => {
      const horaA = a.isRetorno ? (a.horaRetorno || "00:00") : a.hora;
      const horaB = b.isRetorno ? (b.horaRetorno || "00:00") : b.hora;
      return horaA.localeCompare(horaB);
    });

  function prevMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
  }

  function selectDay(day: number) {
    const d = new Date(year, month, day);
    setSelectedDate(toISO(d));
  }

  function openMaps(endereco: string) {
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(endereco)}`;
    Linking.openURL(mapsUrl).catch(() => {
      Linking.openURL("https://www.google.com/maps");
    });
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>Agenda</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: "#fff" }]}
          onPress={() => router.push("/agendamento/novo" as any)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Calendar */}
        <View style={[styles.calendar, { backgroundColor: colors.primary }]}>
          {/* Month nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} activeOpacity={0.7}>
              <MaterialIcons name="chevron-left" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {MESES[month]} {year}
            </Text>
            <TouchableOpacity onPress={nextMonth} activeOpacity={0.7}>
              <MaterialIcons name="chevron-right" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Day names */}
          <View style={styles.daysRow}>
            {DIAS_SEMANA.map((d, i) => (
              <Text key={i} style={styles.dayName}>{d}</Text>
            ))}
          </View>

          {/* Days grid */}
          <View style={styles.grid}>
            {calDays.map((day, idx) => {
              if (!day) return <View key={idx} style={styles.dayCell} />;
              const iso = toISO(new Date(year, month, day));
              const isToday = iso === today;
              const isSelected = iso === selectedDate;
              const hasDot = datesWithItems.has(iso);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.dayCell,
                    isSelected && styles.daySelected,
                    isToday && !isSelected && styles.dayToday,
                  ]}
                  onPress={() => selectDay(day)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      isSelected && styles.dayNumSelected,
                      isToday && !isSelected && { color: "#FBBC04", fontWeight: "700" },
                    ]}
                  >
                    {day}
                  </Text>
                  {hasDot && (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: isSelected ? "#fff" : "#FBBC04" },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Day list */}
        <View style={styles.dayList}>
          <Text style={[styles.dayListTitle, { color: colors.muted }]}>
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </Text>

          {dayItems.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="event-busy" size={40} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Nenhum serviço neste dia
              </Text>
            </View>
          ) : (
            <>
            {dayItems.map((item, idx) => {
              const hora = item.isRetorno ? (item.horaRetorno || "—") : item.hora;
              const label = item.isRetorno ? `🔄 Retorno - ${item.tipoServico}` : item.tipoServico;
              const bgColor = item.isRetorno ? colors.warning + "18" : colors.primary + "18";
              const textColor = item.isRetorno ? colors.warning : colors.primary;
              return (
                <Card key={`${item.id}-${item.isRetorno ? 'retorno' : 'agendamento'}`} onPress={() => router.push(`/agendamento/${item.id}` as any)}>
                  <View style={styles.itemRow}>
                    <View style={[styles.timeBox, { backgroundColor: bgColor }]}>
                      <Text style={[styles.timeText, { color: textColor }]}>{hora}</Text>
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
                        {item.clienteNome}
                      </Text>
                      <Text style={[styles.itemService, { color: colors.muted }]} numberOfLines={1}>
                        {label}
                      </Text>
                      {item.isRetorno && item.enderecoRetorno ? (
                        <TouchableOpacity
                          onPress={() => openMaps(item.enderecoRetorno || "")}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.itemEndereco, { color: colors.primary }]} numberOfLines={1}>
                            📍 {item.enderecoRetorno}
                          </Text>
                        </TouchableOpacity>
                      ) : item.endereco ? (
                        <TouchableOpacity
                          onPress={() => openMaps(item.endereco || "")}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.itemEndereco, { color: colors.primary }]} numberOfLines={1}>
                            📍 {item.endereco}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={[styles.itemValue, { color: colors.success }]}>
                        {formatMoney(getValorExibicao(item))}
                      </Text>
                      <StatusBadge status={item.status} />
                    </View>
                  </View>
                </Card>
              );
            })}
            {dayItems.length > 0 && (
              <View style={[styles.totalRow, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.totalLabel, { color: colors.muted }]}>TOTAL DO DIA</Text>
                <Text style={[styles.totalValue, { color: colors.success }]}>
                  {formatMoney(dayItems.reduce((sum, item) => sum + getValorExibicao(item), 0))}
                </Text>
              </View>
            )}
            </>
          )}
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
    fontSize: 20,
    fontWeight: "700",
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  calendar: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  monthTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  daysRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayName: {
    flex: 1,
    textAlign: "center",
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
  },
  daySelected: {
    backgroundColor: "#fff",
  },
  dayToday: {
    borderWidth: 1,
    borderColor: "#FBBC04",
  },
  dayNum: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "500",
  },
  dayNumSelected: {
    color: "#1A73E8",
    fontWeight: "700",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  dayList: {
    padding: 16,
    paddingBottom: 100,
  },
  dayListTitle: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "capitalize",
    marginBottom: 12,
  },
  empty: {
    alignItems: "center",
    paddingTop: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 15,
  },
  itemRow: {
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
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
  },
  itemService: {
    fontSize: 13,
  },
  itemEndereco: {
    fontSize: 12,
    marginTop: 4,
    textDecorationLine: "underline",
  },
  itemRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  itemValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    borderTopWidth: 1,
    borderRadius: 10,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  moveisContainer: {
    marginTop: 8,
    borderRadius: 10,
    overflow: "hidden",
  },
  movelItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  movelListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  movelNome: {
    fontSize: 13,
    fontWeight: "500",
  },
  movelValor: {
    fontSize: 13,
    fontWeight: "600",
  },

});
