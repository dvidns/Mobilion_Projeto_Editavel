import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking, TextInput, Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState, useEffect } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { PhotoPicker } from "@/components/ui/photo-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { useColors } from "@/hooks/use-colors";
import { useWhatsApp } from "@/hooks/use-whatsapp";
import {
  getAgendamentos, updateAgendamento, deleteAgendamento,
  type Agendamento, type StatusAgendamento,
} from "@/lib/store";
import { generateOrdemServiçoPDF, sharePDF } from "@/lib/pdf-service";

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

const STATUS_OPCOES: { label: string; value: StatusAgendamento }[] = [
  { label: "Pendente", value: "pendente" },
  { label: "Confirmado", value: "confirmado" },
  { label: "Concluído", value: "concluido" },
  { label: "Cancelado", value: "cancelado" },
];

export default function AgendamentoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const [item, setItem] = useState<Agendamento | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Agendamento>>({});
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const { enviar: enviarWhatsApp, loading: whatsappLoading } = useWhatsApp();

  useEffect(() => {
    getAgendamentos().then((all) => {
      const found = all.find((a) => a.id === id);
      setItem(found ?? null);
      if (found) setEditData(found);
    });
  }, [id]);

  if (!item) return null;

  function changeStatus() {
    Alert.alert("Alterar Status", undefined, [
      ...STATUS_OPCOES.map((o) => ({
        text: o.label,
        onPress: async () => {
          await updateAgendamento(item!.id, { status: o.value });
          setItem({ ...item!, status: o.value });
        },
      })),
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  function confirmDelete() {
    Alert.alert("Excluir", "Excluir este agendamento?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await deleteAgendamento(item!.id);
          router.back();
        },
      },
    ]);
  }

  function ligarCliente() {
    Linking.openURL(`tel:${item!.clienteTelefone}`);
  }

  async function whatsappCliente() {
    let msg = "";
    if (item!.status === "concluido") {
      const { getAvaliacaoLink } = await import("@/lib/store");
      const link = await getAvaliacaoLink();
      msg = `Olá ${item!.clienteNome}! 😊\n\nServiço de ${item!.tipoServico} concluído com sucesso!\n\nGostaríamos de sua avaliação:\n${link}\n\nObrigado pela confiança! 🙏`;
    } else {
      const { getLembretePersonalizado } = await import("@/lib/store");
      let lembrete = await getLembretePersonalizado();
      lembrete = lembrete
        .replace("{cliente}", item!.clienteNome)
        .replace("{servico}", item!.tipoServico)
        .replace("{data}", formatDate(item!.data))
        .replace("{hora}", item!.hora)
        .replace("{valor}", formatMoney(item!.valor));
      msg = lembrete;
    }
    enviarWhatsApp(item!.clienteTelefone, msg);
  }

  async function salvarEdicoes() {
    try {
      await updateAgendamento(item!.id, editData);
      setItem({ ...item!, ...editData });
      setIsEditing(false);
      Alert.alert("Sucesso", "Agendamento atualizado com sucesso!");
    } catch (err) {
      Alert.alert("Erro", "Falha ao atualizar agendamento");
    }
  }

  function marcarComoConcluido() {
    if (item!.status === "concluido") return;

        Alert.prompt(
      "Valor Recebido",
      `Qual foi o valor realmente recebido?\n\nValor orçado: ${formatMoney(item!.valor)}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async (valorText?: string) => {
            const valorRecebido = parseFloat(valorText || "") || item!.valor;
            const dataConclusao = new Date().toISOString();
            
            await updateAgendamento(item!.id, {
              status: "concluido",
              valorRecebido,
              dataConclusao,
            });
            
            setItem({
              ...item!,
              status: "concluido",
              valorRecebido,
              dataConclusao,
            });
            
            const diferenca = valorRecebido - item!.valor;
            const mensagemDiferenca = diferenca > 0
              ? `\n\n✅ Adicional recebido: +${formatMoney(diferenca)}`
              : diferenca < 0
              ? `\n\n⚠️ Diferença: ${formatMoney(diferenca)}`
              : "";
            
            Alert.alert(
              "Sucesso",
              `Agendamento concluído!\n\nValor orçado: ${formatMoney(item!.valor)}\nValor recebido: ${formatMoney(valorRecebido)}${mensagemDiferenca}`
            );
          },
        },
      ],
      "plain-text",
      String(item!.valor),
      "decimal-pad"
    );
  }

  if (isEditing) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => setIsEditing(false)} activeOpacity={0.7}>
            <MaterialIcons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar Agendamento</Text>
          <TouchableOpacity onPress={salvarEdicoes} activeOpacity={0.7}>
            <MaterialIcons name="check" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Data */}
          <View>
            <Text style={[styles.label, { color: colors.muted }]}>Data</Text>
            <DatePicker
              value={editData.data || item.data}
              onChange={(date: string) => setEditData({ ...editData, data: date })}
            />
          </View>

          {/* Hora */}
          <View>
            <Text style={[styles.label, { color: colors.muted }]}>Horário</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="HH:MM"
              placeholderTextColor={colors.muted}
              value={editData.hora || item.hora}
              onChangeText={(text) => setEditData({ ...editData, hora: text })}
            />
          </View>

          {/* Tipo de Serviço */}
          <View>
            <Text style={[styles.label, { color: colors.muted }]}>Tipo de Serviço</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Ex: Montagem de Guarda-roupa"
              placeholderTextColor={colors.muted}
              value={editData.tipoServico || item.tipoServico}
              onChangeText={(text) => setEditData({ ...editData, tipoServico: text })}
            />
          </View>

          {/* Valor */}
          <View>
            <Text style={[styles.label, { color: colors.muted }]}>Valor (R$)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={String(editData.valor || item.valor)}
              onChangeText={(text) => setEditData({ ...editData, valor: parseFloat(text) || 0 })}
            />
          </View>

          {/* Endereço */}
          <View>
            <Text style={[styles.label, { color: colors.muted }]}>Endereço</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Rua, número, bairro"
              placeholderTextColor={colors.muted}
              value={editData.endereco || item.endereco || ""}
              onChangeText={(text) => setEditData({ ...editData, endereco: text })}
            />
          </View>

          {/* Descrição */}
          <View>
            <Text style={[styles.label, { color: colors.muted }]}>Observações</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, height: 100 }]}
              placeholder="Adicione observações importantes"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              value={editData.descricao || item.descricao || ""}
              onChangeText={(text) => setEditData({ ...editData, descricao: text })}
            />
          </View>

          {/* Retorno */}
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setEditData({ ...editData, temRetorno: !editData.temRetorno })}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: editData.temRetorno ? colors.primary : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {editData.temRetorno && <MaterialIcons name="check" size={16} color="#fff" />}
                </View>
                <Text style={[styles.label, { color: colors.foreground }]}>
                  Agendar retorno para finalizar
                </Text>
              </TouchableOpacity>
            </View>

            {editData.temRetorno && (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={[styles.label, { color: colors.muted }]}>Data do Retorno</Text>
                  <DatePicker
                    value={editData.dataRetorno || item.dataRetorno || ""}
                    onChange={(date: string) => setEditData({ ...editData, dataRetorno: date })}
                  />
                </View>

                <View>
                  <Text style={[styles.label, { color: colors.muted }]}>Horário do Retorno</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.muted}
                    value={editData.horaRetorno || item.horaRetorno || ""}
                    onChangeText={(text) => setEditData({ ...editData, horaRetorno: text })}
                  />
                </View>

                <View>
                  <Text style={[styles.label, { color: colors.muted }]}>Endereço do Retorno</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                    placeholder="Endereço (opcional)"
                    placeholderTextColor={colors.muted}
                    value={editData.enderecoRetorno || item.enderecoRetorno || ""}
                    onChangeText={(text) => setEditData({ ...editData, enderecoRetorno: text })}
                  />
                </View>
              </View>
            )}
          </View>

          <Button title="Salvar Alterações" onPress={salvarEdicoes} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agendamento</Text>
        <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.7}>
          <MaterialIcons name="edit" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status */}
        <TouchableOpacity
          style={[styles.statusRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={changeStatus}
          activeOpacity={0.8}
        >
          <StatusBadge status={item.status} />
          <Text style={[styles.statusChange, { color: colors.primary }]}>Alterar →</Text>
        </TouchableOpacity>

        {/* Info card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Row label="Data" value={formatDate(item.data)} />
          <Row label="Horário" value={item.hora} />
          <Row label="Serviço" value={item.tipoServico} />
          <Row label="Valor Orçado" value={formatMoney(item.valor)} highlight />
          
          {/* Mostrar valor recebido se agendamento foi concluído */}
          {item.status === "concluido" && item.valorRecebido !== undefined && (
            <>
              <Row label="Valor Recebido" value={formatMoney(item.valorRecebido)} highlight />
              {item.valorRecebido !== item.valor && (
                <Row
                  label="Diferença"
                  value={formatMoney(item.valorRecebido - item.valor)}
                  highlight={item.valorRecebido > item.valor}
                />
              )}
            </>
          )}
          
          {item.endereco && (
            <TouchableOpacity
              onPress={() => {
                const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(item.endereco || "")}`;
                Linking.openURL(mapsUrl).catch(() => {
                  Linking.openURL("https://www.google.com/maps");
                });
              }}
              activeOpacity={0.7}
            >
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.muted }]}>Endereço</Text>
                <Text style={[styles.rowValue, { color: colors.primary, textDecorationLine: "underline" }]}>
                  📍 {item.endereco}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          {item.descricao && <Row label="Observações" value={item.descricao} />}
          {item.temRetorno && item.dataRetorno && (
            <>
              <Row label="Retorno - Data" value={new Date(item.dataRetorno + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
              <Row label="Retorno - Horário" value={item.horaRetorno || "—"} />
              {item.enderecoRetorno && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(item.enderecoRetorno || "")}`)}  
                  activeOpacity={0.7}
                >
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, { color: colors.muted }]}>Retorno - Endereço</Text>
                    <Text style={[styles.rowValue, { color: colors.primary, textDecorationLine: "underline" }]}>
                      📍 {item.enderecoRetorno}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              <Row label="Valor Retorno (50%)" value={formatMoney(item.valor)} highlight />
            </>
          )}
        </View>

        {/* Foto do Móvel */}
        {/* Photo picker removed - not yet implemented */}

        {/* Cliente card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.muted }]}>CLIENTE</Text>
          <Text style={[styles.clientName, { color: colors.foreground }]}>{item.clienteNome}</Text>
          <Text style={[styles.clientPhone, { color: colors.muted }]}>{item.clienteTelefone}</Text>

          <View style={styles.contactBtns}>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: colors.primary + "15" }]}
              onPress={ligarCliente}
              activeOpacity={0.8}
            >
              <MaterialIcons name="phone" size={20} color={colors.primary} />
              <Text style={[styles.contactBtnText, { color: colors.primary }]}>Ligar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: "#25D36615" }]}
              onPress={whatsappCliente}
              activeOpacity={0.8}
              disabled={whatsappLoading}
            >
              <MaterialIcons name="chat" size={20} color="#25D366" />
              <Text style={[styles.contactBtnText, { color: "#25D366" }]}>
                {whatsappLoading ? "Enviando..." : "WhatsApp"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Button
          title={item.status === "concluido" ? "Concluído" : "Marcar como Concluído"}
          onPress={marcarComoConcluido}
          variant={item.status === "concluido" ? "secondary" : "primary"}
          disabled={item.status === "concluido"}
        />

        {/* Botão Deletar */}
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: colors.error + "15" }]}
          onPress={confirmDelete}
          activeOpacity={0.8}
        >
          <MaterialIcons name="delete-outline" size={20} color={colors.error} />
          <Text style={[styles.deleteBtnText, { color: colors.error }]}>Excluir Agendamento</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: highlight ? colors.success : colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusChange: {
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  clientName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  clientPhone: {
    fontSize: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  contactBtns: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  contactBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  deleteBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
