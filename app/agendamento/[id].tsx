import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking, TextInput, Switch, Modal, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState, useEffect, useRef } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

import { ScreenContainer } from "@/components/screen-container";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { PhotoPicker } from "@/components/ui/photo-picker";
import { MultiPhotoPicker } from "@/components/ui/multi-photo-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { useColors } from "@/hooks/use-colors";
import { useWhatsApp } from "@/hooks/use-whatsapp";
import {
  getAgendamentos, updateAgendamento, deleteAgendamento, getClientes,
  atualizarEnderecoCliente, getItensEstoque, getMargemPecas, addItemEstoque,
  type Agendamento, type StatusAgendamento, type ItemEstoque,
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
  const [novoMovelObservacao, setNovoMovelObservacao] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<"hora" | "retorno">("hora");
  const orcamentoCaptureRef = useRef<View>(null);

  // Peças & Materiais (edição)
  const [itensEstoque, setItensEstoque] = useState<ItemEstoque[]>([]);
  const [margemPecas, setMargemPecas] = useState(30);
  const [pecasSelecionadas, setPecasSelecionadas] = useState<{ id: string; nome: string; preco: number; qtd: number }[]>([]);
  const [modalNovaPeca, setModalNovaPeca] = useState(false);
  const [novaPecaNome, setNovaPecaNome] = useState("");
  const [novaPecaPreco, setNovaPecaPreco] = useState("");
  const [novaPecaEstoque, setNovaPecaEstoque] = useState("1");
  const [salvandoPeca, setSalvandoPeca] = useState(false);

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

  useEffect(() => {
    if (!isEditing) return;
    getItensEstoque().then(setItensEstoque);
    getMargemPecas().then(setMargemPecas);
    setPecasSelecionadas([]);
  }, [isEditing]);

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
        observacao: novoMovelObservacao.trim() || undefined,
      },
    ];
    atualizarMoveisEdicao(next);
    setNovoMovelNome("");
    setNovoMovelValor("");
    setNovoMovelQuantidade("1");
    setNovoMovelObservacao("");
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

  async function salvarNovaPecaEdicao() {
    const nomeT = novaPecaNome.trim();
    if (!nomeT) { Alert.alert("Atenção", "Informe o nome da peça."); return; }
    const precoN = parseFloat(novaPecaPreco.replace(",", "."));
    if (isNaN(precoN) || precoN < 0) { Alert.alert("Atenção", "Informe um preço válido."); return; }
    const estN = Math.max(0, parseInt(novaPecaEstoque, 10) || 0);
    setSalvandoPeca(true);
    try {
      const novo = await addItemEstoque({ nome: nomeT, categoria: "peca", precoUnitario: precoN, estoque: estN, estoqueMinimo: 1 });
      const novosItens = await getItensEstoque();
      setItensEstoque(novosItens);
      setPecasSelecionadas((prev) => [...prev, { id: novo.id, nome: novo.nome, preco: novo.precoUnitario, qtd: 1 }]);
      setModalNovaPeca(false);
      setNovaPecaNome(""); setNovaPecaPreco(""); setNovaPecaEstoque("1");
    } catch {
      Alert.alert("Erro", "Não foi possível cadastrar a peça.");
    } finally {
      setSalvandoPeca(false);
    }
  }

  async function salvarEdicoes() {
    try {
      const payload: Partial<Agendamento> = { ...editData };
      let moveisAtualizados = getMoveisEdicao();

      // Adicionar peças selecionadas como itens
      for (const p of pecasSelecionadas) {
        if (p.qtd > 0) {
          moveisAtualizados = [
            ...moveisAtualizados,
            {
              id: Math.random().toString(36).slice(2),
              servicoNome: p.nome,
              valor: parseFloat((p.preco * (1 + margemPecas / 100)).toFixed(2)),
              quantidade: p.qtd,
            },
          ];
        }
      }

      if (moveisAtualizados.length > 0) {
        const valorTotal = moveisAtualizados.reduce(
          (sum, m) => sum + (Number(m.valor) || 0) * (Number(m.quantidade) || 1),
          0
        );
        const temRetornoAtivo = payload.temRetorno ?? item.temRetorno;
        payload.moveis = moveisAtualizados;
        payload.valor = temRetornoAtivo ? valorTotal / 2 : valorTotal;
        payload.tipoServico = moveisAtualizados[0].servicoNome;
      }

      await updateAgendamento(item!.id, payload);

      // Atualizar endereço do cliente quando há endereço de retorno definido
      const enderecoRetornoNovo = (payload.enderecoRetorno ?? item.enderecoRetorno ?? "").trim();
      if (enderecoRetornoNovo && (payload.temRetorno ?? item.temRetorno)) {
        await atualizarEnderecoCliente(item!.clienteId, enderecoRetornoNovo);
      }

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

    setValorRecebidoInput(String(item!.valor));
    setModalConcluidoVisible(true);
  }

  function abrirEdicao() {
    setIsEditing(true);
  }

  function montarServicosOrcamento(currentItem: Agendamento) {
    return (currentItem.moveis && currentItem.moveis.length > 0)
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
  }

  async function compartilharOrcamentoImagem() {
    if (Platform.OS === "web") {
      Alert.alert("Orçamento (IMG)", "No navegador, o compartilhamento de imagem não está disponível. Use o app Android para enviar a imagem direto no WhatsApp.");
      return;
    }

    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("Orçamento (IMG)", "Compartilhamento não disponível neste dispositivo.");
      return;
    }

    if (!orcamentoCaptureRef.current) {
      throw new Error("Referência da imagem do orçamento não disponível");
    }

    const imageUri = await captureRef(orcamentoCaptureRef, {
      format: "png",
      quality: 1,
      result: "tmpfile",
    });

    await Sharing.shareAsync(imageUri, {
      mimeType: "image/png",
      dialogTitle: "Compartilhar orçamento (imagem)",
      UTI: "public.png",
    });
  }

  async function gerarOrcamento(tipo: "pdf" | "img") {
    if (generatingPDF) return;
    try {
      setGeneratingPDF(true);
      const currentItem = item!;

      if (tipo === "img") {
        await compartilharOrcamentoImagem();
      } else {
        const filePath = await generateOrcamentoPDF({
          clienteNome: currentItem.clienteNome,
          clienteTel: currentItem.clienteTelefone,
          clienteEmail: "",
          data: currentItem.data,
          hora: currentItem.hora,
          endereco: currentItem.endereco || "",
          servicos: montarServicosOrcamento(currentItem),
          total: Number(currentItem.valor) || 0,
          descricao: currentItem.descricao,
        });

        await sharePDF(filePath, `orcamento_${currentItem.clienteNome}`);
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
            <TouchableOpacity
              style={[styles.timeBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => { setTimePickerMode("hora"); setShowTimePicker(true); }}
              activeOpacity={0.8}
            >
              <MaterialIcons name="access-time" size={18} color={colors.primary} />
              <Text style={[styles.timeBtnText, { color: colors.foreground }]}>
                {editData.hora || item.hora || "Selecionar horário"}
              </Text>
            </TouchableOpacity>
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
                    <TextInput
                      style={[styles.input, { borderColor: colors.border, color: colors.foreground, marginTop: 8, minHeight: 42 }]}
                      placeholder="Observação do item (opcional)"
                      placeholderTextColor={colors.muted}
                      value={movel.observacao || ""}
                      onChangeText={(text) => {
                        const base = getMoveisEdicao();
                        const next = [...base];
                        next[index] = { ...next[index], observacao: text || undefined };
                        atualizarMoveisEdicao(next);
                      }}
                      multiline
                    />
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
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, minHeight: 42 }]}
              placeholder="Observação do item (opcional)"
              placeholderTextColor={colors.muted}
              value={novoMovelObservacao}
              onChangeText={setNovoMovelObservacao}
              multiline
            />
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: colors.primary + "15" }]}
              onPress={adicionarNovoMovel}
              activeOpacity={0.8}
            >
              <MaterialIcons name="playlist-add" size={20} color={colors.primary} />
              <Text style={[styles.contactBtnText, { color: colors.primary }]}>Adicionar móvel</Text>
            </TouchableOpacity>
          </View>

          {/* Peças & Materiais */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 4 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={[styles.cardTitle, { color: colors.muted }]}>PEÇAS & MATERIAIS</Text>
              <TouchableOpacity
                onPress={() => setModalNovaPeca(true)}
                activeOpacity={0.8}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary + "15", borderColor: colors.primary + "50", borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 }}
              >
                <MaterialIcons name="add" size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "700" }}>Nova peça</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
              Selecione as peças utilizadas (opcional). Preço inclui {margemPecas}% de margem.
            </Text>
            {itensEstoque.filter((i) => i.categoria === "peca").length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 8 }}>
                Nenhuma peça cadastrada.
              </Text>
            ) : (
              itensEstoque.filter((i) => i.categoria === "peca").map((estItem) => {
                const sel = pecasSelecionadas.find((p) => p.id === estItem.id);
                const precoVenda = estItem.precoUnitario * (1 + margemPecas / 100);
                return (
                  <View
                    key={estItem.id}
                    style={[styles.movelItem, { borderColor: sel ? colors.primary : colors.border, marginBottom: 8 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, { color: colors.foreground }]}>{estItem.nome}</Text>
                      <Text style={{ fontSize: 12, color: "#34A853", fontWeight: "600" }}>R$ {precoVenda.toFixed(2)}</Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                      {sel ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => {
                              if (sel.qtd <= 1) setPecasSelecionadas((prev) => prev.filter((p) => p.id !== estItem.id));
                              else setPecasSelecionadas((prev) => prev.map((p) => p.id === estItem.id ? { ...p, qtd: p.qtd - 1 } : p));
                            }}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons name="remove-circle-outline" size={24} color={colors.primary} />
                          </TouchableOpacity>
                          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, minWidth: 20, textAlign: "center" }}>{sel.qtd}</Text>
                          <TouchableOpacity
                            onPress={() => setPecasSelecionadas((prev) => prev.map((p) => p.id === estItem.id ? { ...p, qtd: p.qtd + 1 } : p))}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons name="add-circle-outline" size={24} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setPecasSelecionadas((prev) => [...prev, { id: estItem.id, nome: estItem.nome, preco: estItem.precoUnitario, qtd: 1 }])}
                          activeOpacity={0.8}
                          style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                        >
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Adicionar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
            {pecasSelecionadas.length > 0 && (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.primary, fontWeight: "700" }}>Total Peças</Text>
                  <Text style={{ color: colors.primary, fontWeight: "700" }}>
                    R$ {pecasSelecionadas.reduce((s, p) => s + p.preco * (1 + margemPecas / 100) * p.qtd, 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
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
                  <TouchableOpacity
                    style={[styles.timeBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    onPress={() => { setTimePickerMode("retorno"); setShowTimePicker(true); }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="access-time" size={18} color={colors.primary} />
                    <Text style={[styles.timeBtnText, { color: colors.foreground }]}>
                      {editData.horaRetorno || item.horaRetorno || "Selecionar horário"}
                    </Text>
                  </TouchableOpacity>
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

          {/* Fotos dos Móveis */}
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <MultiPhotoPicker
              fotos={editData.fotos ?? item.fotos ?? []}
              onFotosChange={(fotos) => setEditData((prev) => ({ ...prev, fotos }))}
              label="Fotos dos Móveis"
            />
          </View>

          <Button title="Salvar Alterações" onPress={salvarEdicoes} />
        </ScrollView>

        {/* ── TIME PICKER nativo ── */}
        {showTimePicker && (
          <DateTimePicker
            value={(() => {
              const raw = timePickerMode === "hora"
                ? (editData.hora || item.hora || "08:00")
                : (editData.horaRetorno || item.horaRetorno || "08:00");
              return new Date(`2000-01-01T${raw}:00`);
            })()}
            mode="time"
            display={Platform.OS === "android" ? "clock" : "spinner"}
            onChange={(event, selectedDate) => {
              setShowTimePicker(false);
              if (event.type !== "dismissed" && selectedDate) {
                const h = String(selectedDate.getHours()).padStart(2, "0");
                const m = String(selectedDate.getMinutes()).padStart(2, "0");
                const timeStr = `${h}:${m}`;
                if (timePickerMode === "hora") {
                  setEditData((prev) => ({ ...prev, hora: timeStr }));
                } else {
                  setEditData((prev) => ({ ...prev, horaRetorno: timeStr }));
                }
              }
            }}
          />
        )}

        {/* ── MODAL: Cadastrar Nova Peça (edição) ── */}
        <Modal visible={modalNovaPeca} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Nova Peça / Material</Text>
                <TouchableOpacity onPress={() => setModalNovaPeca(false)}>
                  <MaterialIcons name="close" size={24} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.label, { color: colors.muted }]}>Nome *</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="Ex: Dobradiça, Parafuso, Trilho..."
                placeholderTextColor={colors.muted}
                value={novaPecaNome}
                onChangeText={setNovaPecaNome}
                autoFocus
              />
              <Text style={[styles.label, { color: colors.muted }]}>Preço de custo (R$) *</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="Ex: 5,50"
                placeholderTextColor={colors.muted}
                value={novaPecaPreco}
                onChangeText={setNovaPecaPreco}
                keyboardType="decimal-pad"
              />
              {!!novaPecaPreco && !isNaN(parseFloat(novaPecaPreco.replace(",", "."))) && (
                <Text style={{ color: "#34A853", fontSize: 12, marginBottom: 8, marginTop: -6 }}>
                  Venda sugerida (+{margemPecas}%): R$ {(parseFloat(novaPecaPreco.replace(",", ".")) * (1 + margemPecas / 100)).toFixed(2)}
                </Text>
              )}
              <Text style={[styles.label, { color: colors.muted }]}>Quantidade em estoque</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="1"
                placeholderTextColor={colors.muted}
                value={novaPecaEstoque}
                onChangeText={setNovaPecaEstoque}
                keyboardType="number-pad"
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.contactBtn, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => setModalNovaPeca(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.contactBtnText, { color: colors.foreground }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.contactBtn, { flex: 1, backgroundColor: salvandoPeca ? colors.border : colors.primary }]}
                  onPress={salvarNovaPecaEdicao}
                  disabled={salvandoPeca}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="check" size={16} color="#fff" />
                  <Text style={[styles.contactBtnText, { color: "#fff" }]}>{salvandoPeca ? "Salvando..." : "Salvar"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Text style={[styles.cardTitle, { color: colors.muted }]}>DETALHES</Text>
            <TouchableOpacity
              onPress={abrirEdicao}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primary + "15" }}
            >
              <MaterialIcons name="edit" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>Editar</Text>
            </TouchableOpacity>
          </View>
          <Row label="Data" value={formatDate(item.data)} />
          <Row label="Horário" value={item.hora} />
          <Row label="Serviço" value={item.tipoServico} />

          {/* Valor Total em destaque */}
          <View style={styles.valorRow}>
            <Text style={[styles.valorLabel, { color: colors.foreground }]}>Valor Total Orçado:</Text>
            <Text style={[styles.valorDestaque, { color: colors.success }]}>{formatMoney(item.valor)}</Text>
          </View>

          {/* Split de pagamento para retorno */}
          {item.temRetorno && (
            <View style={{ gap: 2, marginTop: 2 }}>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.muted }]}>Pagamento:</Text>
                <Text style={[styles.rowValue, { color: colors.foreground }]}>
                  {formatMoney(item.valor / 2)}{" "}
                  <Text style={{ color: colors.muted, fontWeight: "400" }}>(50%) na Entrada</Text>
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.rowValue, { color: colors.foreground }]}>
                  {formatMoney(item.valor / 2)}{" "}
                  <Text style={{ color: colors.muted, fontWeight: "400" }}>(50%) no Retorno</Text>
                </Text>
              </View>
            </View>
          )}

          {/* Valor recebido se concluído */}
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
        </View>

        {/* Fotos dos Móveis */}
        {(item.fotos?.length ?? 0) > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MultiPhotoPicker
              fotos={item.fotos ?? []}
              label="Fotos dos Móveis"
              readonly
            />
          </View>
        )}

        {/* Itens do Agendamento — card separado */}
        {!!item.moveis?.length && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={[styles.cardTitle, { color: colors.muted }]}>Itens do Agendamento:</Text>
              <TouchableOpacity
                onPress={abrirEdicao}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primary + "15" }}
              >
                <MaterialIcons name="edit" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>Editar</Text>
              </TouchableOpacity>
            </View>
            {item.moveis.map((movel) => {
              const subtotal = (Number(movel.valor) || 0) * (Number(movel.quantidade) || 1);
              return (
                <View key={movel.id} style={{ marginBottom: 4 }}>
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                      {movel.servicoNome} ({movel.quantidade}x)
                    </Text>
                    <Text style={[styles.rowValue, { color: colors.foreground }]}>R$ {subtotal.toFixed(2)}</Text>
                  </View>
                  {!!movel.observacao?.trim() && (
                    <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>📝 {movel.observacao}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Endereço standalone */}
        {item.endereco && (
          <TouchableOpacity
            onPress={() => {
              const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(item.endereco || "")}`;
              Linking.openURL(mapsUrl).catch(() => Linking.openURL("https://www.google.com/maps"));
            }}
            activeOpacity={0.7}
            style={styles.enderecoRow}
          >
            <MaterialIcons name="location-on" size={18} color="#E53935" />
            <Text style={styles.enderecoText}>{item.endereco}</Text>
          </TouchableOpacity>
        )}

        {/* Observações standalone */}
        {item.descricao && (
          <View style={styles.obsRow}>
            <Text style={[styles.obsLabel, { color: colors.muted }]}>Observações: </Text>
            <Text style={[styles.obsValue, { color: colors.foreground }]}>{item.descricao}</Text>
          </View>
        )}

        {/* Próximo Compromisso */}
        {item.temRetorno && item.dataRetorno && (
          <View style={[styles.retornoBlock, { borderColor: colors.border }]}>
            <View style={styles.row}>
              <Text style={[styles.retornoLabel, { color: colors.muted }]}>Próximo Compromisso:</Text>
              <Text style={[styles.retornoValue, { color: colors.foreground }]}>
                {new Date(item.dataRetorno + "T12:00:00").toLocaleDateString("pt-BR", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.retornoLabel, { color: colors.muted }]}>Horário:</Text>
              <Text style={[styles.retornoValue, { color: colors.foreground }]}>{item.horaRetorno || "—"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.retornoLabel, { color: colors.muted }]}>Valor Retorno:</Text>
              <Text style={[styles.retornoValue, { color: colors.success }]}>
                {formatMoney(item.valor)}{" "}
                <Text style={{ color: colors.success, fontWeight: "400" }}>(50%)</Text>
              </Text>
            </View>
            {item.enderecoRetorno && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(item.enderecoRetorno || "")}`)}
                activeOpacity={0.7}
                style={styles.enderecoRow}
              >
                <MaterialIcons name="location-on" size={18} color="#E53935" />
                <Text style={styles.enderecoText}>{item.enderecoRetorno}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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

      <View style={styles.captureContainer} pointerEvents="none">
        <View ref={orcamentoCaptureRef} collapsable={false} style={styles.captureCard}>
          <Text style={styles.captureTitle}>ORÇAMENTO</Text>
          <Text style={styles.captureSubtitle}>MontaFácil</Text>

          <Text style={styles.captureLine}>Cliente: {item.clienteNome}</Text>
          <Text style={styles.captureLine}>Telefone: {item.clienteTelefone}</Text>
          <Text style={styles.captureLine}>Data: {formatDate(item.data)}</Text>
          <Text style={styles.captureLine}>Hora: {item.hora}</Text>
          {!!item.endereco && <Text style={styles.captureLine}>Endereço: {item.endereco}</Text>}

          <View style={styles.captureDivider} />
          <Text style={styles.captureSectionTitle}>Itens</Text>
          {montarServicosOrcamento(item).map((s, idx) => (
            <View key={`${s.nome}-${idx}`} style={styles.captureItemRow}>
              <Text style={styles.captureItemName}>{s.nome}</Text>
              <Text style={styles.captureItemValue}>{`${s.quantidade}x ${formatMoney(s.valor)}`}</Text>
            </View>
          ))}

          <View style={styles.captureDivider} />
          <Text style={styles.captureTotal}>{`Total: ${formatMoney(item.valor)}`}</Text>
          {!!item.descricao && <Text style={styles.captureObs}>{`Obs: ${item.descricao}`}</Text>}
        </View>
      </View>

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
  valorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  valorLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  valorDestaque: {
    fontSize: 20,
    fontWeight: "700",
  },
  enderecoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  enderecoText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E53935",
    textDecorationLine: "underline",
  },
  obsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  obsLabel: {
    fontSize: 14,
  },
  obsValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  retornoBlock: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  retornoLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  retornoValue: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 1,
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
  timeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
  },
  timeBtnText: {
    fontSize: 14,
    fontWeight: "500",
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
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  captureContainer: {
    position: "absolute",
    left: -9999,
    top: -9999,
    width: 1080,
  },
  captureCard: {
    backgroundColor: "#FFFFFF",
    padding: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  captureTitle: {
    fontSize: 52,
    fontWeight: "800",
    color: "#0A7EA4",
  },
  captureSubtitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
  },
  captureLine: {
    fontSize: 24,
    color: "#111827",
    marginBottom: 6,
  },
  captureDivider: {
    height: 1,
    backgroundColor: "#D1D5DB",
    marginVertical: 16,
  },
  captureSectionTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  captureItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  captureItemName: {
    flex: 1,
    fontSize: 22,
    color: "#111827",
    fontWeight: "600",
  },
  captureItemValue: {
    fontSize: 22,
    color: "#111827",
    fontWeight: "700",
  },
  captureTotal: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0A7EA4",
  },
  captureObs: {
    fontSize: 20,
    color: "#374151",
    marginTop: 12,
  },
});
