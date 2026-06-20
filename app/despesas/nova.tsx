import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/button";
import { useColors } from "@/hooks/use-colors";
import { getClientes, type Cliente } from "@/lib/store";
import { processarDespesaComImagem } from "@/lib/despesas-api";
import type { TipoPessoa } from "@/shared/despesas";

export default function NovaDespesaScreen() {
  const colors = useColors();
  const router = useRouter();

  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("PF");
  const [conferidoIR, setConferidoIR] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [modalCliente, setModalCliente] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getClientes().then(setClientes);
  }, []);

  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert("Permissão necessária", "Permita acesso à câmera para capturar o recibo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
      setImageMimeType(result.assets[0].mimeType ?? "image/jpeg");
    }
  }

  async function escolherDaGaleria() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert("Permissão necessária", "Permita acesso à galeria para enviar o recibo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: false,
      mediaTypes: ["images"],
    });

    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
      setImageMimeType(result.assets[0].mimeType ?? "image/jpeg");
    }
  }

  async function processar() {
    if (!imageUri) {
      Alert.alert("Atenção", "Selecione ou capture uma imagem da nota/recibo.");
      return;
    }

    setLoading(true);
    try {
      const result = await processarDespesaComImagem({
        tipoPessoa,
        clienteId: clienteSelecionado?.id,
        conferidoIR,
        imageUri,
        imageMimeType,
      });

      Alert.alert(
        "Despesa processada",
        `Fornecedor: ${result.extraido.nomeEmpresa}\nValor: R$ ${result.extraido.valorTotal.toFixed(2)}\nItens: ${result.extraido.itens.length}`,
        [{ text: "OK", onPress: () => router.replace("/(tabs)/despesas" as any) }],
      );
    } catch (error) {
      Alert.alert("Erro", `Falha ao processar despesa: ${String(error)}`);
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

      <View style={styles.content}>
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

        <Text style={[styles.label, { color: colors.foreground }]}>Imagem da nota/recibo</Text>
        <View style={styles.row}>
          <Button title="Câmera" onPress={tirarFoto} variant="secondary" icon={<MaterialIcons name="photo-camera" size={16} color={colors.foreground} />} style={{ flex: 1 }} />
          <Button title="Galeria" onPress={escolherDaGaleria} variant="secondary" icon={<MaterialIcons name="photo-library" size={16} color={colors.foreground} />} style={{ flex: 1 }} />
        </View>

        {imageUri ? (
          <View style={[styles.previewBox, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
            <MaterialIcons name="check-circle" size={20} color={colors.success} />
            <Text style={{ color: colors.foreground, flex: 1 }} numberOfLines={1}>Imagem selecionada</Text>
            <TouchableOpacity onPress={() => setImageUri(null)}>
              <MaterialIcons name="close" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ marginTop: 20 }}>
          <Button
            title={loading ? "Processando IA..." : "Processar com IA"}
            onPress={processar}
            loading={loading}
            disabled={loading}
            icon={!loading ? <MaterialIcons name="auto-awesome" size={16} color="#fff" /> : undefined}
          />
        </View>
      </View>

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
  previewBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
