import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking, FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useColors } from "@/hooks/use-colors";
import {
  getClientes, getAgendamentos, deleteCliente,
  type Cliente, type Agendamento,
} from "@/lib/store";

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ClienteDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [historico, setHistorico] = useState<Agendamento[]>([]);

  useEffect(() => {
    Promise.all([getClientes(), getAgendamentos()]).then(([clientes, ags]) => {
      setCliente(clientes.find((c) => c.id === id) ?? null);
      setHistorico(
        ags
          .filter((a) => a.clienteId === id)
          .sort((a, b) => b.data.localeCompare(a.data))
      );
    });
  }, [id]);

  if (!cliente) return null;

  const totalGasto = historico
    .filter((a) => a.status === "concluido")
    .reduce((s, a) => s + a.valor, 0);

  function ligar() { Linking.openURL(`tel:${cliente!.telefone}`); }
  function whatsapp() {
    const tel = cliente!.telefone.replace(/\D/g, "");
    Linking.openURL(`https://wa.me/55${tel}`);
  }

  function confirmDelete() {
    Alert.alert("Excluir cliente", `Excluir ${cliente!.nome}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await deleteCliente(cliente!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{cliente.nome}</Text>
        <TouchableOpacity onPress={confirmDelete} activeOpacity={0.7}>
          <MaterialIcons name="delete-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar + info */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {cliente.nome.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.nome, { color: colors.foreground }]}>{cliente.nome}</Text>
          <Text style={[styles.phone, { color: colors.muted }]}>{cliente.telefone}</Text>
          {cliente.bairro && (
            <Text style={[styles.addr, { color: colors.muted }]}>📍 {cliente.bairro}</Text>
          )}
          {cliente.notas && (
            <Text style={[styles.notas, { color: colors.muted }]}>{cliente.notas}</Text>
          )}

          <View style={styles.contactBtns}>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: colors.primary + "15" }]}
              onPress={ligar}
              activeOpacity={0.8}
            >
              <MaterialIcons name="phone" size={20} color={colors.primary} />
              <Text style={[styles.contactBtnText, { color: colors.primary }]}>Ligar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: "#25D36615" }]}
              onPress={whatsapp}
              activeOpacity={0.8}
            >
              <MaterialIcons name="chat" size={20} color="#25D366" />
              <Text style={[styles.contactBtnText, { color: "#25D366" }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{historico.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Serviços</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: colors.success }]}>{formatMoney(totalGasto)}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Total pago</Text>
          </View>
        </View>

        {/* Histórico */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>HISTÓRICO DE SERVIÇOS</Text>
        {historico.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.muted }]}>Nenhum serviço registrado.</Text>
        ) : (
          historico.map((a) => (
            <Card key={a.id} onPress={() => router.push(`/agendamento/${a.id}` as any)}>
              <View style={styles.histRow}>
                <View style={styles.histInfo}>
                  <Text style={[styles.histService, { color: colors.foreground }]}>{a.tipoServico}</Text>
                  <Text style={[styles.histDate, { color: colors.muted }]}>
                    {new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR")} · {a.hora}
                  </Text>
                </View>
                <View style={styles.histRight}>
                  <Text style={[styles.histValue, { color: colors.success }]}>{formatMoney(a.valor)}</Text>
                  <StatusBadge status={a.status} />
                </View>
              </View>
            </Card>
          ))
        )}
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
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  profileCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    gap: 6,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
  },
  nome: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  phone: {
    fontSize: 15,
  },
  addr: {
    fontSize: 13,
  },
  notas: {
    fontSize: 13,
    textAlign: "center",
    fontStyle: "italic",
  },
  contactBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    width: "100%",
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  contactBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  statNum: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  histInfo: {
    flex: 1,
    gap: 2,
  },
  histService: {
    fontSize: 14,
    fontWeight: "600",
  },
  histDate: {
    fontSize: 12,
  },
  histRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  histValue: {
    fontSize: 14,
    fontWeight: "700",
  },
});
