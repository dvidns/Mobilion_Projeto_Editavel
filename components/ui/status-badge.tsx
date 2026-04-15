import { View, Text, StyleSheet } from "react-native";

type Status = "pendente" | "confirmado" | "concluido" | "cancelado" | "aprovado" | "recusado" | "retorno";

const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string }> = {
  pendente: { label: "Pendente", bg: "#FEF3C7", text: "#92400E" },
  confirmado: { label: "Confirmado", bg: "#DCFCE7", text: "#166534" },
  concluido: { label: "Concluído", bg: "#DBEAFE", text: "#1E40AF" },
  cancelado: { label: "Cancelado", bg: "#FEE2E2", text: "#991B1B" },
  aprovado: { label: "Aprovado", bg: "#DCFCE7", text: "#166534" },
  recusado: { label: "Recusado", bg: "#FEE2E2", text: "#991B1B" },
  retorno: { label: "Retorno", bg: "#FED7AA", text: "#9A3412" },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendente;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
});
