import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ScrollView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState, useCallback, useEffect } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getServicos, updateServico, getValorHora, saveValorHora, type Servico } from "@/lib/store";
import { sugerirValorServico, type SugestaoServico } from "@/lib/service-suggester";

const CATEGORIAS = ["Todos", "Quarto", "Cozinha", "Sala", "Escritório", "Desmontagem", "Outros", "Customizado"];

function formatMoney(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export default function ServicosScreen() {
  const colors = useColors();
  const router = useRouter();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [categoria, setCategoria] = useState("Todos");
  const [editando, setEditando] = useState<Servico | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novoTempo, setNovoTempo] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("Customizado");
  const [valorHora, setValorHora] = useState("0");
  const [mostraConfigValorHora, setMostraConfigValorHora] = useState(false);
  const [sugestaoModalIA, setSugestaoModalIA] = useState<SugestaoServico | null>(null);

  const load = useCallback(async () => {
    const all = await getServicos();
    setServicos(all);
    const vh = await getValorHora();
    setValorHora(String(vh));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Compute suggestion when typing a new service name in the modal
  useEffect(() => {
    if (!editando || editando.id !== "new" || !novoNome.trim()) {
      setSugestaoModalIA(null);
      return;
    }
    const vh = parseFloat(valorHora) || 0;
    setSugestaoModalIA(sugerirValorServico(novoNome, servicos, vh));
  }, [novoNome, editando, servicos, valorHora]);

  const filtrados = categoria === "Todos"
    ? servicos
    : servicos.filter((s) => s.categoria === categoria);

  function abrirEdicao(s: Servico) {
    setEditando(s);
    setNovoNome(s.nome);
    setNovoValor(String(s.valorSugerido));
    setNovoTempo(String(s.tempoEstimadoHoras || ""));
    setNovaCategoria(s.categoria || "Customizado");
  }

  function abrirNovoServico() {
    setEditando({ id: "new", nome: "", categoria: "Customizado", valorMin: 0, valorMax: 0, valorSugerido: 0 });
    setNovoNome("");
    setNovoValor("");
    setNovoTempo("");
    setNovaCategoria("Customizado");
  }

  async function salvarEdicao() {
    if (!editando) return;

    // Validar nome
    if (!novoNome.trim()) {
      Alert.alert("Nome inválido", "Informe um nome para o serviço.");
      return;
    }

    // Validar preço
    const v = parseFloat(novoValor.replace(",", "."));
    if (isNaN(v) || v <= 0) {
      Alert.alert("Valor inválido", "Informe um valor maior que zero.");
      return;
    }

    // Validar tempo (opcional, mas se informado deve ser positivo)
    let tempo: number | undefined;
    if (novoTempo.trim()) {
      tempo = parseFloat(novoTempo.replace(",", "."));
      if (isNaN(tempo) || tempo <= 0) {
        Alert.alert("Tempo inválido", "Informe um tempo maior que zero ou deixe em branco.");
        return;
      }
    }

    // Se for novo serviço (id === "new"), criar novo ao invés de atualizar
    if (editando.id === "new") {
      const novoServico: Servico = {
        id: Date.now().toString(),
        nome: novoNome.trim(),
        categoria: novaCategoria,
        valorMin: v,
        valorMax: v,
        valorSugerido: v,
        tempoEstimadoHoras: tempo,
      };
      // Adicionar novo serviço à lista
      setServicos([...servicos, novoServico]);
      // Salvar no store
      try {
        const { addServico } = await import("@/lib/store");
        await addServico(novoServico);
      } catch {
        console.log("Serviço adicionado localmente");
      }
      Alert.alert("Sucesso", "Novo serviço adicionado!");
    } else {
      await updateServico(editando.id, {
        nome: novoNome.trim(),
        categoria: novaCategoria,
        valorSugerido: v,
        tempoEstimadoHoras: tempo,
      });
      Alert.alert("Sucesso", "Serviço atualizado!");
    }
    setEditando(null);
    load();
  }

  async function salvarValorHora() {
    const vh = parseFloat(valorHora.replace(",", "."));
    if (isNaN(vh) || vh <= 0) {
      Alert.alert("Valor inválido", "Informe um valor/hora maior que zero.");
      return;
    }
    await saveValorHora(vh);
    setMostraConfigValorHora(false);
    Alert.alert("Sucesso", "Valor/hora atualizado!");
  }

  // Calcular preço baseado em valor/hora
  function calcularPreco(tempoHoras: number): number {
    return parseFloat(valorHora) * tempoHoras;
  }

  return (
    <ScreenContainer>
      <View style={{ flex: 1, position: "relative" }}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tabela de Preços</Text>
        <TouchableOpacity onPress={() => setMostraConfigValorHora(true)} activeOpacity={0.7}>
          <MaterialIcons name="settings" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Valor/Hora Card */}
      <View style={[styles.valorHoraCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary }]}>
        <View style={styles.valorHoraContent}>
          <MaterialIcons name="schedule" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.valorHoraLabel, { color: colors.muted }]}>Seu valor/hora</Text>
            <Text style={[styles.valorHoraValue, { color: colors.primary }]}>
              {formatMoney(parseFloat(valorHora) || 0)}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setMostraConfigValorHora(true)} activeOpacity={0.7}>
          <MaterialIcons name="edit" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Info banner */}
      <View style={[styles.banner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
        <MaterialIcons name="info-outline" size={16} color={colors.primary} />
        <Text style={[styles.bannerText, { color: colors.primary }]}>
          Edite nome, preço e tempo estimado. Configure seu valor/hora para cálculos automáticos. Toque para editar.
        </Text>
      </View>

      {/* Category filter */}
      <FlatList
        horizontal
        data={CATEGORIAS}
        keyExtractor={(i) => i}
        contentContainerStyle={styles.catList}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.catBtn,
              item === categoria
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => setCategoria(item)}
            activeOpacity={0.8}
          >
            <Text style={[styles.catText, { color: item === categoria ? "#fff" : colors.muted }]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filtrados}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => abrirEdicao(item)}
            activeOpacity={0.8}
          >
            <View style={styles.rowInfo}>
              <Text style={[styles.rowName, { color: colors.foreground }]}>{item.nome}</Text>
              <Text style={[styles.rowCat, { color: colors.muted }]}>{item.categoria}</Text>
              <Text style={[styles.rowRange, { color: colors.muted }]}>
                Mercado: {formatMoney(item.valorMin)} – {formatMoney(item.valorMax)}
              </Text>
              {item.tempoEstimadoHoras && (
                <Text style={[styles.rowTime, { color: colors.primary }]}>
                  ⏱ {item.tempoEstimadoHoras}h = {formatMoney(calcularPreco(item.tempoEstimadoHoras))}
                </Text>
              )}
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.success }]}>
                {formatMoney(item.valorSugerido)}
              </Text>
              <Text style={[styles.rowEdit, { color: colors.primary }]}>editar</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* FAB: Adicionar novo serviço */}
      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: colors.primary }]}
        onPress={abrirNovoServico}
        activeOpacity={0.85}
        accessibilityLabel="Adicionar novo serviço"
        accessibilityRole="button"
      >
        <MaterialIcons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Edit / New modal */}
      <Modal visible={!!editando} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContainer} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editando?.id === "new" ? "Novo Móvel/Serviço" : "Editar Serviço"}
              </Text>
              {editando?.id !== "new" && (
                <Text style={[styles.modalSub, { color: colors.muted }]}>
                  Referência: {editando ? formatMoney(editando.valorMin) : ""} – {editando ? formatMoney(editando.valorMax) : ""}
                </Text>
              )}

              {/* Nome */}
              <Text style={[styles.modalLabel, { color: colors.muted }]}>Nome do serviço:</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={novoNome}
                onChangeText={setNovoNome}
                placeholder="Ex: Montagem de Guarda-roupa"
                placeholderTextColor={colors.muted}
                autoFocus={editando?.id === "new"}
              />

              {/* Sugestão de IA (somente para novo serviço) */}
              {sugestaoModalIA && editando?.id === "new" && (
                <View style={[styles.iaCard, { backgroundColor: colors.primary + "0D", borderColor: colors.primary + "40" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <MaterialIcons name="auto-awesome" size={14} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>Sugestão de Preço</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6, lineHeight: 15 }}>{sugestaoModalIA.razao}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ color: colors.success, fontSize: 16, fontWeight: "800" }}>
                      R$ {sugestaoModalIA.valor.toFixed(2)}
                    </Text>
                    <TouchableOpacity
                      style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 7 }}
                      onPress={() => setNovoValor(sugestaoModalIA.valor.toFixed(2))}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Aceitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Categoria */}
              <Text style={[styles.modalLabel, { color: colors.muted }]}>Categoria:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 4 }}
                contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
              >
                {["Quarto", "Cozinha", "Sala", "Escritório", "Desmontagem", "Outros", "Customizado"].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catBtn,
                      novaCategoria === cat
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 },
                    ]}
                    onPress={() => setNovaCategoria(cat)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.catText, { color: novaCategoria === cat ? "#fff" : colors.muted }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Preço */}
              <Text style={[styles.modalLabel, { color: colors.muted }]}>Preço (R$):</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={novoValor}
                onChangeText={setNovoValor}
                keyboardType="decimal-pad"
                placeholder="Ex: 150"
                placeholderTextColor={colors.muted}
              />

              {/* Tempo estimado */}
              <Text style={[styles.modalLabel, { color: colors.muted }]}>Tempo estimado (horas):</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={novoTempo}
                onChangeText={setNovoTempo}
                keyboardType="decimal-pad"
                placeholder="Ex: 2.5 (deixe em branco se não aplicável)"
                placeholderTextColor={colors.muted}
              />

              {/* Preço calculado */}
              {novoTempo.trim() && (
                <View style={[styles.calcBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary }]}>
                  <Text style={[styles.calcLabel, { color: colors.muted }]}>Preço baseado em valor/hora:</Text>
                  <Text style={[styles.calcValue, { color: colors.primary }]}>
                    {formatMoney(calcularPreco(parseFloat(novoTempo) || 0))}
                  </Text>
                </View>
              )}

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.border }]}
                  onPress={() => setEditando(null)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  onPress={salvarEdicao}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Config Valor/Hora Modal */}
      <Modal visible={mostraConfigValorHora} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Configurar Valor/Hora
            </Text>
            <Text style={[styles.modalSub, { color: colors.muted }]}>
              Este valor será usado para calcular preços automaticamente
            </Text>
            <Text style={[styles.modalLabel, { color: colors.muted }]}>Valor por hora (R$):</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={valorHora}
              onChangeText={setValorHora}
              keyboardType="decimal-pad"
              returnKeyType="done"
              autoFocus
              placeholderTextColor={colors.muted}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.border }]}
                onPress={() => setMostraConfigValorHora(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={salvarValorHora}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      </View>
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
  valorHoraCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    margin: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  valorHoraContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  valorHoraLabel: {
    fontSize: 12,
  },
  valorHoraValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    margin: 12,
    marginBottom: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  catList: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  catBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  catText: {
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 40,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  rowInfo: {
    flex: 1,
    gap: 4,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "700",
  },
  rowCat: {
    fontSize: 12,
  },
  rowRange: {
    fontSize: 11,
  },
  rowTime: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  rowRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  rowEdit: {
    fontSize: 11,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  modalBox: {
    borderRadius: 16,
    padding: 20,
    width: "85%",
    maxWidth: 400,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  iaCard: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  calcBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  calcLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  calcValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalBtns: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  fabButton: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
