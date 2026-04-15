import { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal,
  ScrollView, Linking,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useColors } from "@/hooks/use-colors";
import { useWhatsApp } from "@/hooks/use-whatsapp";
import {
  getOrcamentos, addOrcamento, updateOrcamento, deleteOrcamento,
  getClientes, getServicos,
  type Orcamento, type Cliente, type Servico, type ItemOrcamento,
} from "@/lib/store";

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function OrcamentosScreen() {
  const colors = useColors();
  const router = useRouter();
  const { enviar: enviarWhatsApp } = useWhatsApp();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [obs, setObs] = useState("");
  const [modalCliente, setModalCliente] = useState(false);
  const [modalServico, setModalServico] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [ors, cls, svs] = await Promise.all([getOrcamentos(), getClientes(), getServicos()]);
    setOrcamentos(ors.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)));
    setClientes(cls);
    setServicos(svs);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openNew() {
    setClienteSel(null);
    setItens([]);
    setObs("");
    setShowModal(true);
  }

  function addItem(s: Servico) {
    const existing = itens.find((i) => i.servicoId === s.id);
    if (existing) {
      setItens(itens.map((i) => i.servicoId === s.id ? { ...i, quantidade: i.quantidade + 1 } : i));
    } else {
      setItens([...itens, { servicoId: s.id, servicoNome: s.nome, quantidade: 1, valor: s.valorSugerido }]);
    }
    setModalServico(false);
  }

  function removeItem(id: string) {
    setItens(itens.filter((i) => i.servicoId !== id));
  }

  const total = itens.reduce((s, i) => s + i.valor * i.quantidade, 0);

  async function salvarOrcamento() {
    if (!clienteSel) { Alert.alert("Atenção", "Selecione um cliente."); return; }
    if (itens.length === 0) { Alert.alert("Atenção", "Adicione pelo menos um serviço."); return; }
    setSaving(true);
    try {
      await addOrcamento({
        clienteId: clienteSel.id,
        clienteNome: clienteSel.nome,
        clienteTelefone: clienteSel.telefone,
        itens,
        total,
        status: "pendente",
        observacoes: obs,
      });
      setShowModal(false);
      load();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  function compartilharWhatsApp(o: Orcamento) {
    const linhas = o.itens.map(
      (i) => `• ${i.servicoNome} (x${i.quantidade}): ${formatMoney(i.valor * i.quantidade)}`
    ).join("\n");
    const msg = `Olá ${o.clienteNome}! Segue o orçamento:\n\n${linhas}\n\n*Total: ${formatMoney(o.total)}*\n\n${o.observacoes ? o.observacoes + "\n\n" : ""}Aguardo sua confirmação! 😊`;
    enviarWhatsApp(o.clienteTelefone, msg);
  }

  function changeStatus(o: Orcamento) {
    Alert.alert("Status do orçamento", undefined, [
      { text: "Pendente", onPress: () => { updateOrcamento(o.id, { status: "pendente" }); load(); } },
      { text: "Aprovado", onPress: () => { updateOrcamento(o.id, { status: "aprovado" }); load(); } },
      { text: "Recusado", onPress: () => { updateOrcamento(o.id, { status: "recusado" }); load(); } },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  function confirmDelete(id: string) {
    Alert.alert("Excluir orçamento?", undefined, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => { await deleteOrcamento(id); load(); } },
    ]);
  }

  return (
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orçamentos</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: "#fff" }]}
          onPress={openNew}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={orcamentos}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="description" size={52} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>Nenhum orçamento criado</Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={openNew}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyBtnText}>+ Novo orçamento</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.orcRow}>
              <View style={styles.orcInfo}>
                <Text style={[styles.orcCliente, { color: colors.foreground }]}>{item.clienteNome}</Text>
                <Text style={[styles.orcDate, { color: colors.muted }]}>
                  {new Date(item.criadoEm).toLocaleDateString("pt-BR")} · {item.itens.length} serviço(s)
                </Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={[styles.orcTotal, { color: colors.success }]}>{formatMoney(item.total)}</Text>
            </View>
            <View style={[styles.orcActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={styles.orcAction}
                onPress={() => compartilharWhatsApp(item)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="chat" size={18} color="#25D366" />
                <Text style={[styles.orcActionText, { color: "#25D366" }]}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.orcAction}
                onPress={() => changeStatus(item)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="edit" size={18} color={colors.primary} />
                <Text style={[styles.orcActionText, { color: colors.primary }]}>Status</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.orcAction}
                onPress={() => confirmDelete(item.id)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                <Text style={[styles.orcActionText, { color: colors.error }]}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      />

      {/* New budget modal */}
      <Modal visible={showModal} animationType="slide">
        <ScreenContainer edges={["top", "left", "right", "bottom"]}>
          <View style={[styles.header, { backgroundColor: colors.primary }]}>
            <TouchableOpacity onPress={() => setShowModal(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Novo Orçamento</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {/* Cliente */}
            <Text style={[styles.label, { color: colors.muted }]}>Cliente *</Text>
            <TouchableOpacity
              style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setModalCliente(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pickerText, { color: clienteSel ? colors.foreground : colors.muted }]}>
                {clienteSel ? clienteSel.nome : "Selecionar cliente..."}
              </Text>
              <MaterialIcons name="expand-more" size={22} color={colors.muted} />
            </TouchableOpacity>

            {/* Itens */}
            <View style={styles.itensHeader}>
              <Text style={[styles.label, { color: colors.muted, marginBottom: 0 }]}>Serviços *</Text>
              <TouchableOpacity
                style={[styles.addItemBtn, { backgroundColor: colors.primary }]}
                onPress={() => setModalServico(true)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="add" size={16} color="#fff" />
                <Text style={styles.addItemText}>Adicionar</Text>
              </TouchableOpacity>
            </View>

            {itens.length === 0 ? (
              <Text style={[styles.noItems, { color: colors.muted }]}>Nenhum serviço adicionado.</Text>
            ) : (
              itens.map((item) => (
                <View key={item.servicoId} style={[styles.itemRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colors.foreground }]}>{item.servicoNome}</Text>
                    <Text style={[styles.itemVal, { color: colors.success }]}>
                      {item.quantidade}x {formatMoney(item.valor)} = {formatMoney(item.valor * item.quantidade)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(item.servicoId)} activeOpacity={0.7}>
                    <MaterialIcons name="remove-circle-outline" size={22} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {itens.length > 0 && (
              <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
                <Text style={[styles.totalValue, { color: colors.success }]}>{formatMoney(total)}</Text>
              </View>
            )}

            <Input
              label="Observações"
              value={obs}
              onChangeText={setObs}
              placeholder="Prazo, condições de pagamento..."
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: "top" }}
            />

            <Button title="Salvar Orçamento" onPress={salvarOrcamento} loading={saving} />
          </ScrollView>
        </ScreenContainer>
      </Modal>

      {/* Modal: Clientes */}
      <Modal visible={modalCliente} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Selecionar Cliente</Text>
              <TouchableOpacity onPress={() => setModalCliente(false)}>
                <MaterialIcons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={clientes}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.mItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setClienteSel(item); setModalCliente(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.mItemText, { color: colors.foreground }]}>{item.nome}</Text>
                  <Text style={[styles.mItemSub, { color: colors.muted }]}>{item.telefone}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.mEmpty, { color: colors.muted }]}>
                  Nenhum cliente. Cadastre na aba Clientes.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal: Serviços */}
      <Modal visible={modalServico} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Adicionar Serviço</Text>
              <TouchableOpacity onPress={() => setModalServico(false)}>
                <MaterialIcons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={servicos}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.mItem, { borderBottomColor: colors.border }]}
                  onPress={() => addItem(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.mItemText, { color: colors.foreground }]}>{item.nome}</Text>
                  <Text style={[styles.mItemSub, { color: colors.muted }]}>
                    {item.categoria} · {formatMoney(item.valorSugerido)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  orcRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  orcInfo: {
    flex: 1,
    gap: 4,
  },
  orcCliente: {
    fontSize: 16,
    fontWeight: "600",
  },
  orcDate: {
    fontSize: 12,
  },
  orcTotal: {
    fontSize: 18,
    fontWeight: "700",
  },
  orcActions: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    paddingTop: 10,
    gap: 0,
  },
  orcAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
  },
  orcActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  form: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 5,
  },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  pickerText: {
    fontSize: 15,
    flex: 1,
  },
  itensHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addItemText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  noItems: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
  },
  itemVal: {
    fontSize: 13,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 12,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalBox: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  mItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  mItemText: {
    fontSize: 15,
    fontWeight: "500",
  },
  mItemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  mEmpty: {
    textAlign: "center",
    padding: 30,
    fontSize: 14,
  },
});
