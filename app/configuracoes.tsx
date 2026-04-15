import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useColors } from "@/hooks/use-colors";
import { getAvaliacaoLink, saveAvaliacaoLink, getLembretePersonalizado, saveLembretePersonalizado } from "@/lib/store";

const KEY_PERFIL = "@montafacil:perfil";

interface Perfil {
  nome: string;
  telefone: string;
  cidade: string;
}

export default function ConfiguracoesScreen() {
  const colors = useColors();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [avaliacaoLink, setAvaliacaoLink] = useState("");
  const [lembrete, setLembrete] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(KEY_PERFIL),
      getAvaliacaoLink(),
      getLembretePersonalizado(),
    ]).then(([raw, link, lemb]) => {
      if (raw) {
        const p: Perfil = JSON.parse(raw);
        setNome(p.nome ?? "");
        setTelefone(p.telefone ?? "");
        setCidade(p.cidade ?? "");
      }
      setAvaliacaoLink(link);
      setLembrete(lemb);
    });
  }, []);

  async function salvar() {
    setSaving(true);
    try {
      await Promise.all([
        AsyncStorage.setItem(KEY_PERFIL, JSON.stringify({ nome, telefone, cidade })),
        saveAvaliacaoLink(avaliacaoLink),
        saveLembretePersonalizado(lembrete),
      ]);
      Alert.alert("Salvo!", "Suas informações foram atualizadas.");
    } catch {
      Alert.alert("Erro", "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function limparDados() {
    Alert.alert(
      "Limpar todos os dados",
      "Isso vai apagar TODOS os clientes, agendamentos e orçamentos. Tem certeza?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar tudo",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove([
              "@montafacil:clientes",
              "@montafacil:agendamentos",
              "@montafacil:servicos",
              "@montafacil:orcamentos",
            ]);
            Alert.alert("Pronto", "Todos os dados foram apagados.");
          },
        },
      ]
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurações</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>MEUS DADOS</Text>
          <Input label="Seu nome" value={nome} onChangeText={setNome} placeholder="Nome do montador" />
          <Input
            label="Telefone / WhatsApp"
            value={telefone}
            onChangeText={setTelefone}
            placeholder="(11) 99999-9999"
            keyboardType="phone-pad"
          />
          <Input label="Cidade" value={cidade} onChangeText={setCidade} placeholder="Sua cidade" />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>LINK DE AVALIAÇÃO</Text>
          <Text style={[styles.sectionDesc, { color: colors.muted }]}>Cole aqui seu link do Google Maps, Trustpilot ou outro avaliador. Será enviado automaticamente quando marcar um serviço como concluído.</Text>
          <Input
            label="Link de Avaliação"
            value={avaliacaoLink}
            onChangeText={setAvaliacaoLink}
            placeholder="https://google.com/maps/..."
            keyboardType="url"
            multiline
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>LEMBRETE PERSONALIZADO</Text>
          <Text style={[styles.sectionDesc, { color: colors.muted }]}>Personalize a mensagem de lembrete enviada aos clientes. Use placeholders como: cliente, servico, data, hora, valor.</Text>
          <Input
            label="Mensagem de Lembrete"
            value={lembrete}
            onChangeText={setLembrete}
            placeholder="Olá {{cliente}}! Confirmando o serviço de {{servico}}..."
            multiline
          />
        </View>

        <Button title="Salvar Tudo" onPress={salvar} loading={saving} />

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>SOBRE O APP</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Versão</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Desenvolvido para</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>Montadores de Móveis</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.dangerBtn, { borderColor: colors.error }]}
          onPress={limparDados}
          activeOpacity={0.8}
        >
          <MaterialIcons name="delete-forever" size={20} color={colors.error} />
          <Text style={[styles.dangerText, { color: colors.error }]}>Limpar todos os dados</Text>
        </TouchableOpacity>
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
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  dangerText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
