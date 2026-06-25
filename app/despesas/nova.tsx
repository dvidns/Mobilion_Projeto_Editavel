import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
  FlatList,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { useColors } from "@/hooks/use-colors";
import { getClientes, type Cliente } from "@/lib/store";
import { confirmarDespesaProcessada } from "@/lib/despesas-api";
import type { TipoPessoa } from "@/shared/despesas";

export default function NovaDespesaScreen() {
  const colors = useColors();
  const router = useRouter();

  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("PF");
  const [conferidoIR, setConferidoIR] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [modalCliente, setModalCliente] = useState(false);
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorCnpj, setFornecedorCnpj] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getClientes().then(setClientes);
  }, []);

  const valorNumerico = useMemo(() => {
    const bruto = valorTotal.trim();
    if (!bruto) return 0;

    // Aceita formatos como 10, 10.00 e 10,00.
    const temVirgula = bruto.includes(",");
    const normalizado = temVirgula
      ? bruto.replace(/\./g, "").replace(",", ".")
      : bruto;

    const parsed = Number(normalizado);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [valorTotal]);

  async function salvarManual() {
    const nome = fornecedorNome.trim();
    const cnpj = fornecedorCnpj.trim();

    if (!nome) {
      Alert.alert("Atenção", "Informe o nome do fornecedor.");
      return;
    }

    if (valorNumerico <= 0) {
      Alert.alert("Atenção", "Informe um valor válido maior que zero.");
      return;
    }

    setLoading(true);
    try {
      await confirmarDespesaProcessada({
        tipoPessoa,
        clienteId: clienteSelecionado?.id ?? null,
        conferidoIR,
        imageUrl: "manual://sem-foto",
        imageStorageKey: null,
        extraido: {
          nomeEmpresa: nome,
          cnpj: cnpj || null,
          dataEmissao: dataEmissao || null,
          valorTotal: valorNumerico,
          itens: [],
        },
      });
      router.replace("/(tabs)/despesas" as any);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar despesa.";
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}> 
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Despesa</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.label, { color: colors.foreground }]}>Classificação</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[
              styles.chip,
              { borderColor: tipoPessoa === "PF" ? colors.warning : colors.border, backgroundColor: colors.surface },
            ]}
            onPress={() => setTipoPessoa("PF")}
          >
            <Text style={{ color: tipoPessoa === "PF" ? colors.warning : colors.foreground, fontWeight: "700" }}>PF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.chip,
              { borderColor: tipoPessoa === "PJ" ? colors.success : colors.border, backgroundColor: colors.surface },
            ]}
            onPress={() => setTipoPessoa("PJ")}
          >
            <Text style={{ color: tipoPessoa === "PJ" ? colors.success : colors.foreground, fontWeight: "700" }}>PJ</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Cliente (opcional)</Text>
        <TouchableOpacity
          style={[styles.selector, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => setModalCliente(true)}
          activeOpacity={0.75}
        >
          <Text style={{ color: clienteSelecionado ? colors.foreground : colors.muted, flex: 1 }} numberOfLines={1}>
            {clienteSelecionado ? clienteSelecionado.nome : "Selecionar cliente"}
          </Text>
          <MaterialIcons name="expand-more" size={20} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.switchRow, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <Text style={{ color: colors.foreground, fontWeight: "600" }}>Marcar como conferido no IR</Text>
          <Switch value={conferidoIR} onValueChange={setConferidoIR} />
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Fornecedor</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.surface }]}
          value={fornecedorNome}
          onChangeText={setFornecedorNome}
          placeholder="Nome do fornecedor"
          placeholderTextColor={colors.muted}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>CNPJ (opcional)</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.surface }]}
          value={fornecedorCnpj}
          onChangeText={setFornecedorCnpj}
          placeholder="00.000.000/0000-00"
          placeholderTextColor={colors.muted}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Data de emissão (opcional)</Text>
        <DatePicker
          value={dataEmissao}
          onChange={setDataEmissao}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Valor da despesa</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.surface }]}
          value={valorTotal}
          onChangeText={setValorTotal}
          placeholder="0,00"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
        />
        <Text style={[styles.inputHint, { color: colors.muted }]}>Aceita 10 ou 10,00</Text>

        <View style={{ marginTop: 20 }}>
          <Button
            title={loading ? "Salvando despesa..." : "Salvar despesa"}
            onPress={salvarManual}
            loading={loading}
            disabled={loading}
            icon={
              !loading ? (
                <MaterialIcons name="save" size={16} color="#fff" />
              ) : undefined
            }
          />
        </View>
      </ScrollView>

      <Modal visible={modalCliente} transparent animationType="fade" onRequestClose={() => setModalCliente(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Vincular Cliente</Text>
              <TouchableOpacity onPress={() => setModalCliente(false)}>
                <MaterialIcons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={clientes}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                <TouchableOpacity
                  style={[styles.modalItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setClienteSelecionado(null);
                    setModalCliente(false);
                  }}
                >
                  <Text style={{ color: colors.muted }}>Nenhum cliente</Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setClienteSelecionado(item);
                    setModalCliente(false);
                  }}
                >
                  <Text style={{ color: colors.foreground, fontWeight: "600" }}>{item.nome}</Text>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>{item.telefone}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  selector: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  inputHint: {
    fontSize: 12,
    marginTop: 4,
  },
  switchRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    borderRadius: 14,
    maxHeight: "70%",
    paddingBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalItem: {
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
