import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/button";
import { PhotoPicker } from "@/components/ui/photo-picker";
import { useColors } from "@/hooks/use-colors";
import { atualizarFotoDespesa, obterDespesaPorId } from "@/lib/despesas-api";
import type { DespesaRegistro } from "@/shared/despesas";

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hasValidImage(value: string | null | undefined) {
  if (!value) return false;
  if (value.startsWith("manual://sem-foto")) return false;
  return true;
}

export default function DespesaDetalheScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const despesaId = useMemo(() => {
    const value = params.id;
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }, [params.id]);

  const [despesa, setDespesa] = useState<DespesaRegistro | null>(null);
  const [fotoDraft, setFotoDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDespesa, setLoadingDespesa] = useState(true);

  const carregar = useCallback(async () => {
    if (!despesaId.trim()) {
      setDespesa(null);
      setLoadingDespesa(false);
      return;
    }

    setLoadingDespesa(true);
    try {
      const data = await obterDespesaPorId(despesaId);
      setDespesa(data);
      if (data && hasValidImage(data.imageUrl)) {
        setFotoDraft(data.imageUrl);
      }
    } finally {
      setLoadingDespesa(false);
    }
  }, [despesaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarFoto() {
    if (!despesa) return;
    const imageUri = fotoDraft.trim();
    if (!imageUri) {
      Alert.alert("Atenção", "Selecione ou tire uma foto da nota/recibo.");
      return;
    }

    setLoading(true);
    try {
      const atualizada = await atualizarFotoDespesa({
        despesaId: despesa.id,
        imageUri,
      });
      if (atualizada) {
        setDespesa(atualizada);
        setFotoDraft(atualizada.imageUrl);
      }
      Alert.alert("Foto anexada", "A foto da nota/recibo foi vinculada com sucesso.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao anexar foto da despesa.";
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  }

  if (loadingDespesa) {
    return (
      <ScreenContainer>
        <View style={styles.emptyContainer}>
          <Text style={{ color: colors.muted }}>Carregando despesa...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!despesa) {
    return (
      <ScreenContainer>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Despesa não encontrada</Text>
          <Text style={{ color: colors.muted, textAlign: "center" }}>
            Essa despesa pode ter sido removida ou ainda não foi sincronizada.
          </Text>
          <View style={{ marginTop: 16 }}>
            <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const currentPhotoUri = fotoDraft || (hasValidImage(despesa.imageUrl) ? despesa.imageUrl : undefined);

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}> 
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhe da Despesa</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <Text style={[styles.infoLabel, { color: colors.muted }]}>Fornecedor</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>{despesa.fornecedorNome}</Text>

          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Data</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {despesa.dataEmissao ?? despesa.createdAt.slice(0, 10)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Tipo</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{despesa.tipoPessoa}</Text>
            </View>
          </View>

          <Text style={[styles.infoLabel, { color: colors.muted }]}>Valor</Text>
          <Text style={[styles.valor, { color: colors.primary }]}>{formatMoney(despesa.valorTotal)}</Text>
        </View>

        <PhotoPicker
          label="Foto da nota/recibo"
          currentPhotoUri={currentPhotoUri}
          onPhotoSelected={setFotoDraft}
        />

        <View style={styles.actions}>
          <Button
            title={loading ? "Salvando foto..." : "Salvar foto da despesa"}
            onPress={salvarFoto}
            loading={loading}
            disabled={loading}
            icon={!loading ? <MaterialIcons name="photo-camera" size={16} color="#fff" /> : undefined}
          />
        </View>
      </ScrollView>
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
    gap: 12,
    paddingBottom: 32,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  infoRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  valor: {
    fontSize: 24,
    fontWeight: "700",
  },
  actions: {
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
});
