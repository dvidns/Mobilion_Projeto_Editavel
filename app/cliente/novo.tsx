import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useColors } from "@/hooks/use-colors";
import { addCliente } from "@/lib/store";

export default function NovoClienteScreen() {
  const colors = useColors();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!nome.trim()) { Alert.alert("Atenção", "Informe o nome do cliente."); return; }
    if (!telefone.trim()) { Alert.alert("Atenção", "Informe o telefone."); return; }
    setSaving(true);
    try {
      await addCliente({ nome: nome.trim(), telefone: telefone.trim(), endereco, bairro, notas });
      router.back();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Cliente</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Input label="Nome *" value={nome} onChangeText={setNome} placeholder="Nome completo" />
        <Input
          label="Telefone *"
          value={telefone}
          onChangeText={setTelefone}
          placeholder="(11) 99999-9999"
          keyboardType="phone-pad"
        />
        <Input label="Endereço" value={endereco} onChangeText={setEndereco} placeholder="Rua, número" />
        <Input label="Bairro" value={bairro} onChangeText={setBairro} placeholder="Bairro" />
        <Input
          label="Observações"
          value={notas}
          onChangeText={setNotas}
          placeholder="Notas sobre o cliente..."
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top" }}
        />
        <Button title="Salvar Cliente" onPress={salvar} loading={saving} />
      </ScrollView>
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
  form: {
    padding: 20,
    paddingBottom: 40,
  },
});
