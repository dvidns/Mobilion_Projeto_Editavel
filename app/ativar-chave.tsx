import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/button";
import { useColors } from "@/hooks/use-colors";
import { useSubscription } from "@/hooks/use-subscription";

function maskCode(value: string) {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
  const groups = cleaned.match(/.{1,4}/g) ?? [];
  return groups.join("-");
}

export default function AtivarChaveScreen() {
  const colors = useColors();
  const router = useRouter();
  const { activateLicense, loading, refresh } = useSubscription();
  const [code, setCode] = useState("");

  async function handleActivate() {
    const normalized = code.trim();
    if (!normalized) {
      Alert.alert("Atenção", "Informe sua chave de ativação.");
      return;
    }

    try {
      await activateLicense(normalized);
      await refresh();
      Alert.alert("Sucesso", "Plano ativado com sucesso.", [
        {
          text: "OK",
          onPress: () => router.replace("/planos" as any),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao ativar chave.";
      Alert.alert("Erro", message);
    }
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ativar por Chave</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>Digite a chave recebida</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>A chave ativa o plano neste aparelho.</Text>

        <TextInput
          value={code}
          onChangeText={(value) => setCode(maskCode(value))}
          placeholder="XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            {
              borderColor: colors.border,
              color: colors.foreground,
              backgroundColor: colors.surface,
            },
          ]}
        />

        <Button
          title={loading ? "Ativando..." : "Ativar assinatura"}
          onPress={handleActivate}
          loading={loading}
          disabled={loading}
          icon={!loading ? <MaterialIcons name="verified" size={16} color="#fff" /> : undefined}
        />
      </View>
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
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
