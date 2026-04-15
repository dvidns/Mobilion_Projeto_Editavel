import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking, TextInput, Switch, Modal, Platform,
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
  getAgendamentos, updateAgendamento, deleteAgendamento, getClientes,
  type Agendamento, type StatusAgendamento,
} from "@/lib/store";
import { generateOrcamentoPDF, generateOrdemServiçoPDF, sharePDF } from "@/lib/pdf-service";

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

  // Modal para valor recebido (Android não suporta Alert.prompt)
  const [modalConcluidoVisible, setModalConcluidoVisible] = useState(false);
  const [valorRecebidoInput, setValorRecebidoInput] = useState("");
  const [novoMovelNome, setNovoMovelNome] = useState("");
  const [novoMovelValor, setNovoMovelValor] = useState("");
  const [novoMovelQuantidade, setNovoMovelQuantidade] = useState("1");

  type MovelAgendamento = NonNullable<Agendamento["moveis"]>[number];

  useEffect(() => {
    getAgendamentos().then((all) => {
      const found = all.find((a) => a.id === id);
      setItem(found ?? null);
      if (found) setEditData(found);
    });
  }, [id]);

  useEffect(() => {
    if (!isEditing || !item) return;

    const enderecoAtual = (editData.endereco ?? item.endereco ?? "").trim();
    if (enderecoAtual) return;

    getClientes().then((allClientes) => {
      const cliente = allClientes.find((c) => c.id === item.clienteId);
      const enderecoCliente = cliente?.endereco?.trim();
      if (enderecoCliente) {
        setEditData((prev) => ({ ...prev, endereco: enderecoCliente }));
      }
    });
  }, [isEditing, item, editData.endereco]);

  if (!item) return null;

  const getMoveisEdicao = (): MovelAgendamento[] => {
    const source = (editData.moveis ?? item.moveis ?? []) as MovelAgendamento[];
    return source.map((m) => ({
      ...m,
      valor: Number(m.valor) || 0,
      quantidade: Math.max(1, Number(m.quantidade) || 1),
    }));
  };

  const atualizarMoveisEdicao = (next: MovelAgendamento[]) => {
    setEditData((prev) => ({ ...prev, moveis: next }));
  };

  const atualizarQuantidadeMovel = (index: number, delta: number) => {
    const base = getMoveisEdicao();
    const next = [...base];
    const qtd = Math.max(1, (next[index]?.quantidade || 1) + delta);
    next[index] = { ...next[index], quantidade: qtd };
    atualizarMoveisEdicao(next);
  };

  const removerMovel = (index: number) => {
    const base = getMoveisEdicao();
    const next = base.filter((_, i) => i !== index);
    atualizarMoveisEdicao(next);
  };

  const adicionarNovoMovel = () => {
    const nome = novoMovelNome.trim();
    const valor = parseFloat(novoMovelValor.replace(",", ".")) || 0;
    const quantidade = Math.max(1, parseInt(novoMovelQuantidade, 10) || 1);

    if (!nome) {
      Alert.alert("Atenção", "Informe o nome do móvel/serviço.");
      return;
    }
    if (valor <= 0) {
      Alert.alert("Atenção", "Informe um valor válido maior que zero.");
      return;
    }

    const base = getMoveisEdicao();
    const next: MovelAgendamento[] = [
      ...base,
      {
        id: Math.random().toString(36).slice(2),
        servicoNome: nome,
        valor,
        quantidade,
      },
    ];
    atualizarMoveisEdicao(next);
    setNovoMovelNome("");
    setNovoMovelValor("");
    setNovoMovelQuantidade("1");
  };

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
      const payload: Partial<Agendamento> = { ...editData };
      const moveisAtualizados = getMoveisEdicao();

      if (moveisAtualizados.length > 0) {
        const valorTotal = moveisAtualizados.reduce(
          (sum, m) => sum + (Number(m.valor) || 0) * (Number(m.quantidade) || 1),
          0
        );
        payload.moveis = moveisAtualizados;
        payload.valor = valorTotal;
        payload.tipoServico = moveisAtualizados[0].servicoNome;
      }

      await updateAgendamento(item!.id, payload);
      setItem({ ...item!, ...payload });
      setIsEditing(false);
      Alert.alert("Sucesso", "Agendamento atualizado com sucesso!");
    } catch (err) {
      Alert.alert("Erro", "Falha ao atualizar agendamento");
    }
  }

  async function confirmarConclusao(valorText: string) {
    const valorRecebido = parseFloat(valorText.replace(",", ".")) || item!.valor;
    const dataConclusao = new Date().toISOString();
    await updateAgendamento(item!.id, { status: "concluido", valorRecebido, dataConclusao });
    setItem({ ...item!, status: "concluido", valorRecebido, dataConclusao });
    setModalConcluidoVisible(false);
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
  }

  function marcarComoConcluido() {
    if (item!.status === "concluido") return;

    if (Platform.OS === "ios") {
      Alert.prompt(
        "Valor Recebido",
        `Qual foi o valor realmente recebido?\n\nValor orçado: ${formatMoney(item!.valor)}`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Confirmar", onPress: async (valorText?: string) => confirmarConclusao(valorText ?? "") },
        ],
        "plain-text",
        String(item!.valor),
        "decimal-pad"
      );
    } else {
      // Android: usar modal próprio
      setValorRecebidoInput(String(item!.valor));
      setModalConcluidoVisible(true);
    }
  }

  function abrirEdicao() {
    setIsEditing(true);
  }

  async function gerarOrcamento(tipo: "pdf" | "img") {
    if (generatingPDF) return;
    try {
      setGeneratingPDF(true);
      const currentItem = item!;

      const servicos = (currentItem.moveis && currentItem.moveis.length > 0)
        ? currentItem.moveis.map((m) => ({
            nome: m.servicoNome,
            quantidade: Number(m.quantidade) || 1,
            valorUnitario: Number(m.valor) || 0,
            valor: (Number(m.valor) || 0) * (Number(m.quantidade) || 1),
          }))
        : [{
            nome: currentItem.tipoServico || "Serviço",
            quantidade: 1,
            valorUnitario: Number(currentItem.valor) || 0,
            valor: Number(currentItem.valor) || 0,
          }];

      const filePath = await generateOrcamentoPDF({
        clienteNome: currentItem.clienteNome,
        clienteTel: currentItem.clienteTelefone,
        clienteEmail: "",
        data: currentItem.data,
        hora: currentItem.hora,
        endereco: currentItem.endereco || "",
        servicos,
        total: Number(currentItem.valor) || 0,
        descricao: currentItem.descricao,
      });

      await sharePDF(filePath, `orcamento_${currentItem.clienteNome}`);

      if (tipo === "img") {
        Alert.alert(
          "Orçamento (IMG)",
          "A versão atual abre um arquivo compartilhável. Se preferir imagem, abra e salve/capture como imagem."
        );
      }
    } catch (err) {
      Alert.alert("Erro", "Não foi possível gerar o orçamento.");
    } finally {
      setGeneratingPDF(false);
    }
  }

  function abrirAcoesOrcamento() {
    Alert.alert("Orçamento", "Escolha o formato", [
      { text: "PDF", onPress: () => gerarOrcamento("pdf") },
      { text: "IMG", onPress: () => gerarOrcamento("img") },
      { text: "Cancelar", style: "cancel" },
    ]);
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

          {/* Móveis e Quantidade */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.muted }]}>MÓVEIS / SERVIÇOS</Text>

            {getMoveisEdicao().map((movel, index) => {
              const subtotal = (Number(movel.valor) || 0) * (Number(movel.quantidade) || 1);
              return (
                <View key={movel.id || String(index)} style={[styles.movelItem, { borderColor: colors.border }]}> 
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>{movel.servicoNome}</Text>
                    <Text style={[styles.rowValue, { color: colors.muted }]}>R$ {subtotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.movelControls}>
                    <TouchableOpacity style={styles.movelQtyBtn} onPress={() => atualizarQuantidadeMovel(index, -1)}>
                      <MaterialIcons name="remove" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.rowValue, { color: colors.foreground }]}>{movel.quantidade}x</Text>
                    <TouchableOpacity style={styles.movelQtyBtn} onPress={() => atualizarQuantidadeMovel(index, 1)}>
                      <MaterialIcons name="add" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.movelQtyBtn} onPress={() => removerMovel(index)}>
                      <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Nome do móvel/serviço"
              placeholderTextColor={colors.muted}
              value={novoMovelNome}
              onChangeText={setNovoMovelNome}
            />
            <View style={styles.movelAddRow}>
              <TextInput
                style={[styles.input, styles.movelAddValue, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="Valor"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={novoMovelValor}
                onChangeText={setNovoMovelValor}
              />
              <TextInput
                style={[styles.input, styles.movelAddQty, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="Qtd"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={novoMovelQuantidade}
                onChangeText={(t) => setNovoMovelQuantidade(t.replace(/\D/g, ""))}
              />
            </View>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: colors.primary + "15" }]}
              onPress={adicionarNovoMovel}
              activeOpacity={0.8}
            >
              <MaterialIcons name="playlist-add" size={20} color={colors.primary} />
              <Text style={[styles.contactBtnText, { color: colors.primary }]}>Adicionar móvel</Text>
            </TouchableOpacity>
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
        <TouchableOpacity onPress={abrirEdicao} activeOpacity={0.7}>
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

          {!!item.moveis?.length && (
            <View style={{ marginTop: 10, gap: 6 }}>
              <Text style={[styles.cardTitle, { color: colors.muted }]}>Itens do Agendamento</Text>
              {item.moveis.map((movel) => {
                const subtotal = (Number(movel.valor) || 0) * (Number(movel.quantidade) || 1);
                return (
                  <View key={movel.id} style={styles.row}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                      {movel.servicoNome} ({movel.quantidade}x)
                    </Text>
                    <Text style={[styles.rowValue, { color: colors.muted }]}>R$ {subtotal.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>
          )}
          
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

          <View style={styles.miniActionRow}>
            <TouchableOpacity
              style={[styles.miniActionBtn, { backgroundColor: colors.primary + "15" }]}
              onPress={abrirAcoesOrcamento}
              activeOpacity={0.8}
              disabled={generatingPDF}
            >
              <MaterialIcons name="description" size={16} color={colors.primary} />
              <Text style={[styles.miniActionText, { color: colors.primary }]}>
                {generatingPDF ? "Gerando..." : "Orçamento PDF/IMG"}
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

      {/* Modal para valor recebido (Android) */}
      <Modal
        visible={modalConcluidoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalConcluidoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Valor Recebido</Text>
            <Text style={[styles.modalSub, { color: colors.muted }]}>
              Qual foi o valor realmente recebido?{"\n"}Valor orçado: {item ? formatMoney(item.valor) : ""}
            </Text>
            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.foreground }]}
              keyboardType="decimal-pad"
              value={valorRecebidoInput}
              onChangeText={setValorRecebidoInput}
              placeholder="0,00"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => setModalConcluidoVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.muted }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={() => confirmarConclusao(valorRecebidoInput)}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  miniActionRow: {
    marginTop: 10,
  },
  miniActionBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  miniActionText: {
    fontSize: 12,
    fontWeight: "700",
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
  movelItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 8,
  },
  movelControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  movelQtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  movelAddRow: {
    flexDirection: "row",
    gap: 8,
  },
  movelAddValue: {
    flex: 2,
  },
  movelAddQty: {
    flex: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    borderRadius: 12,
    padding: 24,
    width: "100%",
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
