import { useMemo, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/button";
import { useColors } from "@/hooks/use-colors";
import { confirmarDespesaProcessada } from "@/lib/despesas-api";
import { clearDespesaPreviewDraft, getDespesaPreviewDraft, toConfirmarPayload } from "@/lib/despesas-preview-draft";
import type { DespesaExtraida } from "@/shared/despesas";

export default function DespesaPreviewScreen() {
  const colors = useColors();
  const router = useRouter();
  const draft = useMemo(() => getDespesaPreviewDraft(), []);
  const [loading, setLoading] = useState(false);
  const [extraido, setExtraido] = useState<DespesaExtraida>(
    draft?.extraido ?? {
      nomeEmpresa: "",
      cnpj: null,
      dataEmissao: null,
      valorTotal: 0,
      itens: [],
    },
  );

  if (!draft) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}> 
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sem prévia disponível</Text>
          <Text style={{ color: colors.muted, textAlign: "center" }}>
            Volte para Nova Despesa e clique em Processar com IA novamente.
          </Text>
          <View style={{ marginTop: 16 }}>
            <Button title="Voltar" onPress={() => router.back()} variant="secondary" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const draftSafe = draft;

  function atualizarCampo<K extends keyof DespesaExtraida>(campo: K, valor: DespesaExtraida[K]) {
    setExtraido((current) => ({
      ...current,
      [campo]: valor,
    }));
  }

  function atualizarItem(index: number, campo: keyof DespesaExtraida["itens"][number], valor: string) {
    setExtraido((current) => {
      const itens = [...current.itens];
      const item = { ...itens[index] };

      if (campo === "nome") {
        item.nome = valor;
      } else {
        const numero = Number(valor.replace(",", "."));
        (item as any)[campo] = Number.isFinite(numero) ? numero : 0;
      }

      itens[index] = item;
      return {
        ...current,
        itens,
      };
    });
  }

  async function confirmar() {
    const nome = extraido.nomeEmpresa.trim();
    const temValor = extraido.valorTotal > 0;
    const temItens = extraido.itens.some((item) => item.valor_total > 0 && item.quantidade > 0);

    if (!nome || (!temValor && !temItens)) {
      Alert.alert("Dados incompletos", "Preencha fornecedor e valor para salvar a despesa.");
      return;
    }

    setLoading(true);
    try {
      await confirmarDespesaProcessada(
        toConfirmarPayload({
          ...draftSafe,
          extraido,
        }),
      );
      clearDespesaPreviewDraft();
      Alert.alert("Despesa salva", "Leitura confirmada e registrada com sucesso.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/despesas" as any) },
      ]);
    } catch (error) {
      const e = error as Error;
      Alert.alert("Erro", e.message || "Falha ao salvar despesa");
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
        <Text style={styles.headerTitle}>Prévia da IA</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.label, { color: colors.foreground }]}>Prévia da imagem</Text>
        <View style={[styles.imageBox, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <Image
            source={{ uri: draftSafe.imageUrl }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Fornecedor</Text>
        <TextInput
          value={extraido.nomeEmpresa}
          onChangeText={(value) => atualizarCampo("nomeEmpresa", value)}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
          placeholder="Nome do fornecedor"
          placeholderTextColor={colors.muted}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>CNPJ</Text>
        <TextInput
          value={extraido.cnpj ?? ""}
          onChangeText={(value) => atualizarCampo("cnpj", value.trim() ? value : null)}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
          placeholder="00.000.000/0000-00"
          placeholderTextColor={colors.muted}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Data de emissão</Text>
        <TextInput
          value={extraido.dataEmissao ?? ""}
          onChangeText={(value) => atualizarCampo("dataEmissao", value.trim() ? value : null)}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Valor total (R$)</Text>
        <TextInput
          value={String(extraido.valorTotal)}
          onChangeText={(value) => {
            const numero = Number(value.replace(",", "."));
            atualizarCampo("valorTotal", Number.isFinite(numero) ? numero : 0);
          }}
          keyboardType="decimal-pad"
          style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
          placeholder="0.00"
          placeholderTextColor={colors.muted}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Itens lidos ({extraido.itens.length})</Text>
        {extraido.itens.map((item, index) => (
          <View
            key={`${index}-${item.nome}`}
            style={[styles.itemBox, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <TextInput
              value={item.nome}
              onChangeText={(value) => atualizarItem(index, "nome", value)}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Nome do item"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.row}>
              <TextInput
                value={String(item.quantidade)}
                onChangeText={(value) => atualizarItem(index, "quantidade", value)}
                keyboardType="decimal-pad"
                style={[styles.inputSmall, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="Qtd"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                value={String(item.valor_unitario)}
                onChangeText={(value) => atualizarItem(index, "valor_unitario", value)}
                keyboardType="decimal-pad"
                style={[styles.inputSmall, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="Unit"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                value={String(item.valor_total)}
                onChangeText={(value) => atualizarItem(index, "valor_total", value)}
                keyboardType="decimal-pad"
                style={[styles.inputSmall, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="Total"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>
        ))}

        <View style={styles.actionRow}>
          <Button
            title={loading ? "Salvando..." : "Confirmar e salvar"}
            onPress={confirmar}
            loading={loading}
            disabled={loading}
            icon={!loading ? <MaterialIcons name="save" size={16} color="#fff" /> : undefined}
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
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  inputSmall: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  itemBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  imageBox: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  previewImage: {
    width: "100%",
    height: 260,
  },
  actionRow: {
    marginTop: 16,
    marginBottom: 24,
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
