import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert,
} from "react-native";
import React from "react";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Constants from "expo-constants";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

// ─── FAQ ────────────────────────────────────────────────────────────────────

const FAQ: { q: string; a: string }[] = [
  {
    q: "Como adicionar um novo agendamento?",
    a: 'Na aba "Hoje", toque no botão "+" no canto superior direito ou no botão "+ Novo agendamento" quando não há serviços no dia.',
  },
  {
    q: "Como enviar lembrete pelo WhatsApp?",
    a: "Abra o detalhe do agendamento e toque em \"WhatsApp\". A mensagem é gerada automaticamente com os dados do cliente e do serviço.",
  },
  {
    q: "Como gerar um orçamento em PDF?",
    a: 'No detalhe do agendamento, toque em "Orçamento PDF/IMG". Escolha PDF para compartilhar o arquivo ou IMG para enviar como imagem pelo WhatsApp.',
  },
  {
    q: "Como registrar o valor recebido diferente do orçado?",
    a: 'Toque em "Marcar como Concluído". Uma janela aparecerá perguntando o valor realmente recebido — você pode alterar antes de confirmar.',
  },
  {
    q: "Como cadastrar um agendamento com retorno?",
    a: 'Ao criar ou editar um agendamento, ative o toggle "Tem retorno" e preencha a data, horário e endereço do retorno. O valor será dividido automaticamente em 50% na entrada e 50% no retorno.',
  },
  {
    q: "Como fazer backup dos meus dados?",
    a: 'Acesse "Mais" → "Configurações" → seção "Backup". Você pode salvar localmente ou exportar para compartilhar.',
  },
  {
    q: "Como alterar o texto do lembrete de WhatsApp?",
    a: 'Acesse "Mais" → "Configurações" → seção "Lembrete WhatsApp". Você pode personalizar a mensagem usando variáveis como {cliente}, {servico}, {data}, {hora} e {valor}.',
  },
  {
    q: "O app funciona sem internet?",
    a: "Sim. Todos os dados são armazenados localmente no seu celular. A internet é usada apenas para envio de WhatsApp e geração de links externos.",
  },
  {
    q: "Como excluir um agendamento?",
    a: "Abra o detalhe do agendamento e role até o final. Toque em \"Excluir Agendamento\" (vermelho) e confirme.",
  },
  {
    q: "Como ver o relatório de faturamento?",
    a: 'Acesse "Mais" → "Relatório de Faturamento". Você pode filtrar por período e exportar em PDF ou Excel.',
  },
];

// ─── Contato ─────────────────────────────────────────────────────────────────

const SUPORTE_EMAIL = "contato@montafacil.app";
const PRIVACIDADE_URL = "https://dvidns.github.io/appmontafacil1/";

function getVersion() {
  return Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "1.0.0";
}

// ─── Componentes internos ─────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const colors = useColors();
  const [open, setOpen] = React.useState(false);

  return (
    <TouchableOpacity
      style={[styles.faqItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => setOpen((v) => !v)}
      activeOpacity={0.8}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQ, { color: colors.foreground, flex: 1 }]}>{q}</Text>
        <MaterialIcons
          name={open ? "expand-less" : "expand-more"}
          size={22}
          color={colors.muted}
        />
      </View>
      {open && (
        <Text style={[styles.faqA, { color: colors.muted }]}>{a}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function AjudaScreen() {
  const colors = useColors();
  const router = useRouter();

  function abrirEmail() {
    Linking.openURL(
      `mailto:${SUPORTE_EMAIL}?subject=Suporte%20MontaFácil&body=Olá,%20preciso%20de%20ajuda%20com...`
    ).catch(() => Alert.alert("Erro", "Não foi possível abrir o e-mail."));
  }

  function abrirPrivacidade() {
    Linking.openURL(PRIVACIDADE_URL).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir a página.")
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajuda e Suporte</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Contato direto */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>FALAR COM SUPORTE</Text>

        <TouchableOpacity
          style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={abrirEmail}
          activeOpacity={0.8}
        >
          <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
            <MaterialIcons name="email" size={26} color={colors.primary} />
          </View>
          <View style={styles.contactInfo}>
            <Text style={[styles.contactLabel, { color: colors.foreground }]}>E-mail</Text>
            <Text style={[styles.contactDesc, { color: colors.muted }]}>{SUPORTE_EMAIL}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
        </TouchableOpacity>

        {/* FAQ */}
        <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 8 }]}>PERGUNTAS FREQUENTES</Text>

        {FAQ.map((item, i) => (
          <FaqItem key={i} q={item.q} a={item.a} />
        ))}

        {/* Links legais */}
        <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 8 }]}>INFORMAÇÕES</Text>

        <TouchableOpacity
          style={[styles.infoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={abrirPrivacidade}
          activeOpacity={0.8}
        >
          <MaterialIcons name="privacy-tip" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.foreground }]}>Política de Privacidade</Text>
          <MaterialIcons name="open-in-new" size={18} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.infoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="info-outline" size={20} color={colors.muted} />
          <Text style={[styles.infoText, { color: colors.muted }]}>Versão do app</Text>
          <Text style={[styles.infoValue, { color: colors.muted }]}>{getVersion()}</Text>
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
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  content: {
    padding: 16,
    paddingBottom: 60,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 2,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  contactDesc: {
    fontSize: 13,
  },
  faqItem: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  faqQ: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  faqA: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
  },
});
