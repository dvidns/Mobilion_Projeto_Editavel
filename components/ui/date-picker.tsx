import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toISO(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplay(iso: string) {
  // "2025-12-31" → "31/12/2025"
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface DatePickerProps {
  value: string; // ISO "YYYY-MM-DD"
  onChange: (iso: string) => void;
  label?: string;
  minDate?: string; // ISO, optional
}

export function DatePicker({ value, onChange, label, minDate }: DatePickerProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  const today = toISO(new Date());

  // Parse current value to get initial month
  const parsedDate = value ? new Date(value + "T12:00:00") : new Date();
  const [viewYear, setViewYear] = useState(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth());

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const calDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function selectDay(day: number) {
    const iso = toISO(new Date(viewYear, viewMonth, day));
    if (minDate && iso < minDate) return; // bloquear datas passadas se minDate definido
    onChange(iso);
    setOpen(false);
  }

  function isDayDisabled(day: number) {
    if (!minDate) return false;
    const iso = toISO(new Date(viewYear, viewMonth, day));
    return iso < minDate;
  }

  return (
    <>
      {/* Trigger */}
      {label && (
        <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      )}
      <TouchableOpacity
        style={[styles.trigger, { borderColor: colors.border, backgroundColor: colors.surface }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
        <Text style={[styles.triggerText, { color: value ? colors.foreground : colors.muted }]}>
          {value ? formatDisplay(value) : "Selecionar data..."}
        </Text>
        <MaterialIcons name="expand-more" size={20} color={colors.muted} />
      </TouchableOpacity>

      {/* Modal calendário */}
      <Modal visible={open} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.calBox, { backgroundColor: colors.surface, shadowColor: "#000" }]}
            onPress={() => {}} // impede fechar ao clicar dentro
          >
            {/* Cabeçalho mês/ano */}
            <View style={[styles.calHeader, { backgroundColor: colors.primary }]}>
              <TouchableOpacity onPress={prevMonth} activeOpacity={0.7} style={styles.navBtn}>
                <MaterialIcons name="chevron-left" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.calMonthTitle}>
                {MESES[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} activeOpacity={0.7} style={styles.navBtn}>
                <MaterialIcons name="chevron-right" size={26} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Nomes dos dias */}
            <View style={styles.weekRow}>
              {DIAS_SEMANA.map((d, i) => (
                <Text key={i} style={[styles.weekDay, { color: colors.muted }]}>{d}</Text>
              ))}
            </View>

            {/* Grade de dias */}
            <View style={styles.grid}>
              {calDays.map((day, idx) => {
                if (!day) return <View key={idx} style={styles.cell} />;
                const iso = toISO(new Date(viewYear, viewMonth, day));
                const isSelected = iso === value;
                const isToday = iso === today;
                const disabled = isDayDisabled(day);

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.cell,
                      isSelected && { backgroundColor: colors.primary, borderRadius: 100 },
                      isToday && !isSelected && styles.todayCell,
                      disabled && styles.disabledCell,
                    ]}
                    onPress={() => !disabled && selectDay(day)}
                    activeOpacity={disabled ? 1 : 0.7}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        { color: colors.foreground },
                        isSelected && { color: "#fff", fontWeight: "700" },
                        isToday && !isSelected && { color: colors.primary, fontWeight: "700" },
                        disabled && { color: colors.border },
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Botão Hoje */}
            <TouchableOpacity
              style={[styles.todayBtn, { borderTopColor: colors.border }]}
              onPress={() => {
                onChange(today);
                setOpen(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.todayBtnText, { color: colors.primary }]}>Hoje</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  calBox: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  navBtn: {
    padding: 4,
  },
  calMonthTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  weekRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  todayCell: {
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: "#1A73E8",
  },
  disabledCell: {
    opacity: 0.35,
  },
  dayNum: {
    fontSize: 14,
  },
  todayBtn: {
    borderTopWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  todayBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
