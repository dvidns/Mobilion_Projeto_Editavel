import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal,
  TextInput, ScrollView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getItensEstoque, addItemEstoque, updateItemEstoque, deleteItemEstoque,
  getMargemLucro, saveMargemLucro,
  type ItemEstoque, type CategoriaItem,
} from "@/lib/store";

function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

type Aba = "movel" | "peca";

const ESTOQUE_MINIMO_PADRAO = 5;

export default function TabelaPrecosScreen() {
  const colors = useColors();
  const router = useRouter();

  const [aba, setAba] = useState<Aba>("movel");
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [margem, setMargem] = useState(50);

  // Modal de adição/edição
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<ItemEstoque | null>(null);
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [estoque, setEstoque] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState(String(ESTOQUE_MINIMO_PADRAO));

  // Modal de margem
  const [modalMargem, setModalMargem] = useState(false);
  const [margemInput, setMargemInput] = useState("");

  const load = useCallback(async () => {
    const [data, m] = await Promise.all([getItensEstoque(), getMargemLucro()]);
    setItens(data);
    setMargem(m);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtrados = itens.filter((i) => i.categoria === aba);

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const totalCusto = filtrados.reduce((s, i) => s + i.precoUnitario * i.estoque, 0);
  const sugestaoVenda = totalCusto * (1 + margem / 100);

  // ── Modal form ────────────────────────────────────────────────────────────
  function abrirNovo() {
    setEditItem(null);
    setNome("");
    setPreco("");
    setEstoque("");
    setEstoqueMinimo(String(ESTOQUE_MINIMO_PADRAO));
    setModalVisible(true);
  }

  function abrirEditar(item: ItemEstoque) {
    setEditItem(item);
    setNome(item.nome);
    setPreco(String(item.precoUnitario));
    setEstoque(String(item.estoque));
    setEstoqueMinimo(String(item.estoqueMinimo));
    setModalVisible(true);
  }

  async function salvar() {
    const nomeT = nome.trim();
    if (!nomeT) { Alert.alert("Atenção", "Informe o nome do item."); return; }
    const precoN = parseFloat(preco.replace(",", "."));
    if (isNaN(precoN) || precoN < 0) { Alert.alert("Atenção", "Informe um preço válido."); return; }
    const estN = parseInt(estoque, 10);
    if (isNaN(estN) || estN < 0) { Alert.alert("Atenção", "Informe uma quantidade válida."); return; }
    const estMinN = parseInt(estoqueMinimo, 10) || 0;

    if (editItem) {
      await updateItemEstoque(editItem.id, {
        nome: nomeT, precoUnitario: precoN, estoque: estN, estoqueMinimo: estMinN,
      });
    } else {
      await addItemEstoque({
        nome: nomeT, categoria: aba, precoUnitario: precoN,
        estoque: estN, estoqueMinimo: estMinN,
      });
    }
    setModalVisible(false);
    load();
  }

  function confirmarDelete(item: ItemEstoque) {
    Alert.alert(
      "Excluir item",
      `Deseja excluir "${item.nome}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir", style: "destructive",
          onPress: async () => { await deleteItemEstoque(item.id); load(); },
        },
      ],
    );
  }

  async function salvarMargem() {
    const m = parseFloat(margemInput.replace(",", "."));
    if (isNaN(m) || m < 0) { Alert.alert("Atenção", "Informe uma margem válida (ex: 50)."); return; }
    await saveMargemLucro(m);
    setMargem(m);
    setModalMargem(false);
  }

  // ── Render item ───────────────────────────────────────────────────────────
  function renderItem({ item }: { item: ItemEstoque }) {
    const baixo = item.estoque <= item.estoqueMinimo;
    const poucas = item.estoque > item.estoqueMinimo && item.estoque <= item.estoqueMinimo * 2;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => abrirEditar(item)}
        onLongPress={() => confirmarDelete(item)}
        activeOpacity={0.75}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.cardNome, { color: colors.foreground }]} numberOfLines={1}>
            {item.nome}
          </Text>
          <Text style={[styles.cardPreco, { color: colors.primary }]}>
            {fmtMoney(item.precoUnitario)}
          </Text>
        </View>
        <View style={styles.cardMid}>
          <MaterialIcons name="check-circle" size={15} color="#34A853" />
          <Text style={[styles.cardEstoque, { color: colors.muted }]}>
            {" "}Em Estoque:{" "}
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>
              {item.estoque} disponíveis
            </Text>
          </Text>
        </View>
        <View style={styles.cardBadges}>
          {baixo && (
            <View style={[styles.badge, { backgroundColor: "#FEF9C3" }]}>
              <MaterialIcons name="warning" size={12} color="#CA8A04" />
              <Text style={[styles.badgeText, { color: "#854D0E" }]}> Baixo Estoque!</Text>
            </View>
          )}
          {poucas && (
            <View style={[styles.badge, { backgroundColor: "#FEF9C3" }]}>
              <MaterialIcons name="warning" size={12} color="#CA8A04" />
              <Text style={[styles.badgeText, { color: "#854D0E" }]}> Poucas Unidades!</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  const categoriaLabel = aba === "movel" ? "Móvel" : "Peça/Material";

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tabela de Preços</Text>
        <TouchableOpacity onPress={() => { setMargemInput(String(margem)); setModalMargem(true); }} activeOpacity={0.7}>
          <MaterialIcons name="settings" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Abas */}
      <View style={[styles.abas, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {(["movel", "peca"] as Aba[]).map((a) => {
          const active = aba === a;
          return (
            <TouchableOpacity
              key={a}
              style={[styles.aba, active && { backgroundColor: colors.primary, borderRadius: 20 }]}
              onPress={() => setAba(a)}
              activeOpacity={0.8}
            >
              {a === "peca" && <MaterialIcons name="category" size={16} color={active ? "#fff" : colors.muted} />}
              <Text style={[styles.abaText, { color: active ? "#fff" : colors.muted }]}>
                {a === "movel" ? "Móveis" : "Peças & Acessórios"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Banner de margem */}
      <TouchableOpacity
        style={styles.margemBanner}
        onPress={() => { setMargemInput(String(margem)); setModalMargem(true); }}
        activeOpacity={0.85}
      >
        <MaterialIcons name="trending-up" size={18} color="#fff" />
        <Text style={styles.margemBannerText}>  Margem de Lucro: Sugerido: {margem}%</Text>
      </TouchableOpacity>

      {/* Botão adicionar */}
      <TouchableOpacity
        style={[styles.btnAdd, { backgroundColor: colors.primary }]}
        onPress={abrirNovo}
        activeOpacity={0.85}
      >
        <MaterialIcons name="add" size={20} color="#fff" />
        <Text style={styles.btnAddText}>  Adicionar {categoriaLabel}</Text>
      </TouchableOpacity>

      {/* Lista */}
      <FlatList
        data={filtrados}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <MaterialIcons name="inventory-2" size={42} color={colors.muted} />
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: 8 }}>
              {"Nenhum item cadastrado\nToque em \"Adicionar\" para começar"}
            </Text>
          </View>
        }
      />

      {/* Rodapé de totais */}
      {filtrados.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.muted }]}>
            Total em Estoque:{" "}
            <Text style={{ color: colors.primary, fontWeight: "700" }}>{fmtMoney(totalCusto)}</Text>
          </Text>
          <Text style={[styles.footerText, { color: colors.muted }]}>
            Sugestão de Venda:{" "}
            <Text style={{ color: "#34A853", fontWeight: "700" }}>{fmtMoney(sugestaoVenda)}</Text>
          </Text>
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={abrirNovo}
        activeOpacity={0.85}
      >
        <MaterialIcons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Modal Formulário ────────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {editItem ? `Editar ${categoriaLabel}` : `Novo ${categoriaLabel}`}
            </Text>

            <Text style={[styles.label, { color: colors.muted }]}>Nome *</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder={`Ex: ${aba === "movel" ? "Guarda-roupa" : "Porta Branca"}`}
              placeholderTextColor={colors.muted}
              value={nome}
              onChangeText={setNome}
            />

            <Text style={[styles.label, { color: colors.muted }]}>Preço unitário (R$) *</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="Ex: 20"
              placeholderTextColor={colors.muted}
              value={preco}
              onChangeText={setPreco}
              keyboardType="decimal-pad"
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.muted }]}>Estoque atual</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={estoque}
                  onChangeText={setEstoque}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.muted }]}>Estoque mínimo</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder={String(ESTOQUE_MINIMO_PADRAO)}
                  placeholderTextColor={colors.muted}
                  value={estoqueMinimo}
                  onChangeText={setEstoqueMinimo}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.sheetBtnCancel, { borderColor: colors.border }]}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtnSave, { backgroundColor: colors.primary }]}
                onPress={salvar}
                activeOpacity={0.8}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Margem ────────────────────────────────────────────────── */}
      <Modal visible={modalMargem} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Margem de Lucro</Text>
            <Text style={[styles.label, { color: colors.muted }]}>Percentual sugerido (%)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="Ex: 50"
              placeholderTextColor={colors.muted}
              value={margemInput}
              onChangeText={setMargemInput}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>
              Com {margemInput || margem}% de margem, um item de R$ 100 será vendido por R$ {(100 * (1 + (parseFloat(margemInput || String(margem)) || 0) / 100)).toFixed(0)}.
            </Text>
            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.sheetBtnCancel, { borderColor: colors.border }]}
                onPress={() => setModalMargem(false)}
                activeOpacity={0.8}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtnSave, { backgroundColor: colors.primary }]}
                onPress={salvarMargem}
                activeOpacity={0.8}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  abas: {
    flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8,
    gap: 8, borderBottomWidth: 1,
  },
  aba: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  abaText: { fontSize: 14, fontWeight: "600" },

  margemBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#34A853", paddingVertical: 10, marginHorizontal: 12, marginTop: 10,
    borderRadius: 8,
  },
  margemBannerText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  btnAdd: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, marginHorizontal: 12, marginTop: 10, borderRadius: 8,
  },
  btnAddText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  card: {
    borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 10, gap: 4,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardNome: { fontSize: 16, fontWeight: "700", flex: 1 },
  cardPreco: { fontSize: 16, fontWeight: "700", marginLeft: 8 },
  cardMid: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  cardEstoque: { fontSize: 13 },
  cardBadges: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  badge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  badgeText: { fontSize: 12, fontWeight: "600" },

  empty: {
    alignItems: "center", justifyContent: "center", gap: 8,
    padding: 40, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", marginTop: 20,
  },

  footer: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1,
  },
  footerText: { fontSize: 13 },

  fab: {
    position: "absolute", bottom: 24, right: 20,
    width: 54, height: 54, borderRadius: 27,
    alignItems: "center", justifyContent: "center",
    elevation: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },

  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, marginBottom: 4,
  },
  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  sheetBtnCancel: {
    flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  sheetBtnSave: {
    flex: 2, paddingVertical: 13, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
});
