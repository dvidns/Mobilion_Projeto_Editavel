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
  getMargemMoveis, saveMargemMoveis, getMargemPecas, saveMargemPecas,
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
  const [margemMoveis, setMargemMoveis] = useState(50);
  const [margemPecas, setMargemPecas] = useState(30);

  // margem ativa com base na aba
  const margem = aba === "movel" ? margemMoveis : margemPecas;

  // Modal de adição/edição
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<ItemEstoque | null>(null);
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [estoque, setEstoque] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState(String(ESTOQUE_MINIMO_PADRAO));

  const precoNum = parseFloat(preco.replace(",", ".")) || 0;
  const sugestaoForm = precoNum > 0 ? precoNum * (1 + margem / 100) : 0;

  // Modal de margem
  const [modalMargem, setModalMargem] = useState(false);
  const [margemMovInput, setMargemMovInput] = useState("");
  const [margemPecInput, setMargemPecInput] = useState("");

  const load = useCallback(async () => {
    const [data, mm, mp] = await Promise.all([getItensEstoque(), getMargemMoveis(), getMargemPecas()]);
    setItens(data);
    setMargemMoveis(mm);
    setMargemPecas(mp);
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
    const mm = parseFloat(margemMovInput.replace(",", "."));
    const mp = parseFloat(margemPecInput.replace(",", "."));
    if (isNaN(mm) || mm < 0) { Alert.alert("Atenção", "Informe uma margem válida para Móveis."); return; }
    if (isNaN(mp) || mp < 0) { Alert.alert("Atenção", "Informe uma margem válida para Peças."); return; }
    await Promise.all([saveMargemMoveis(mm), saveMargemPecas(mp)]);
    setMargemMoveis(mm);
    setMargemPecas(mp);
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
          <TouchableOpacity onPress={() => abrirEditar(item)} activeOpacity={0.7} style={styles.cardEditBtn}>
            <MaterialIcons name="edit" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.cardPrecos}>
          <View style={styles.cardPrecoCol}>
            <Text style={[styles.cardPrecoLabel, { color: colors.muted }]}>Custo</Text>
            <Text style={[styles.cardPreco, { color: colors.foreground }]}>{fmtMoney(item.precoUnitario)}</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={14} color={colors.muted} style={{ marginTop: 14 }} />
          <View style={styles.cardPrecoCol}>
            <Text style={[styles.cardPrecoLabel, { color: colors.muted }]}>Sugestão +{item.categoria === "movel" ? margemMoveis : margemPecas}%</Text>
            <Text style={[styles.cardPreco, { color: "#34A853" }]}>{fmtMoney(item.precoUnitario * (1 + (item.categoria === "movel" ? margemMoveis : margemPecas) / 100))}</Text>
          </View>
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
        onPress={() => { setMargemMovInput(String(margemMoveis)); setMargemPecInput(String(margemPecas)); setModalMargem(true); }}
        activeOpacity={0.85}
      >
        <MaterialIcons name="trending-up" size={18} color="#fff" />
        <Text style={styles.margemBannerText}>
          {"  "}Móveis: {margemMoveis}%{"  │  "}Peças: {margemPecas}%
        </Text>
        <MaterialIcons name="edit" size={15} color="rgba(255,255,255,0.8)" />
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

            <Text style={[styles.label, { color: colors.muted }]}>Preço de custo (R$) *</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="Ex: 20"
              placeholderTextColor={colors.muted}
              value={preco}
              onChangeText={setPreco}
              keyboardType="decimal-pad"
            />
            {sugestaoForm > 0 && (
              <View style={[styles.sugestaoChip, { backgroundColor: "#34A85315", borderColor: "#34A85350" }]}>
                <MaterialIcons name="trending-up" size={14} color="#34A853" />
                <Text style={[styles.sugestaoChipText, { color: "#34A853" }]}>
                  {" "}Sugestão de venda (+{margem}%): <Text style={{ fontWeight: "800" }}>{fmtMoney(sugestaoForm)}</Text>
                </Text>
              </View>
            )}

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
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>
              Defina margens separadas para cada categoria.
            </Text>

            <Text style={[styles.label, { color: colors.muted }]}>Móveis & Serviços (%)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="Ex: 50"
              placeholderTextColor={colors.muted}
              value={margemMovInput}
              onChangeText={setMargemMovInput}
              keyboardType="decimal-pad"
              autoFocus
            />
            {!!margemMovInput && (
              <Text style={{ color: "#34A853", fontSize: 12, marginBottom: 8 }}>
                Item de R$ 100 → R$ {(100 * (1 + (parseFloat(margemMovInput.replace(",",".")) || 0) / 100)).toFixed(0)}
              </Text>
            )}

            <Text style={[styles.label, { color: colors.muted }]}>Peças & Materiais (%)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="Ex: 30"
              placeholderTextColor={colors.muted}
              value={margemPecInput}
              onChangeText={setMargemPecInput}
              keyboardType="decimal-pad"
            />
            {!!margemPecInput && (
              <Text style={{ color: "#34A853", fontSize: 12, marginBottom: 8 }}>
                Item de R$ 100 → R$ {(100 * (1 + (parseFloat(margemPecInput.replace(",",".")) || 0) / 100)).toFixed(0)}
              </Text>
            )}

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
  cardNome: { fontSize: 15, fontWeight: "700", flex: 1 },
  cardEditBtn: { padding: 6 },
  cardPrecos: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 },
  cardPrecoCol: { flex: 1 },
  cardPrecoLabel: { fontSize: 10, fontWeight: "600", marginBottom: 2, textTransform: "uppercase" },
  cardPreco: { fontSize: 15, fontWeight: "700" },
  cardMid: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  sugestaoChip: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6, marginBottom: 2 },
  sugestaoChipText: { fontSize: 13, fontWeight: "600" },
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
