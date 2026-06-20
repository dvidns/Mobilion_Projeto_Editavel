import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

// 🔒 Manter false até ativar assinaturas na Play Store
const PLANOS_ENABLED = false;

interface MenuItem {
  icon: string;
  label: string;
  desc: string;
  route: string;
  color: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    icon: "dashboard",
    label: "Painel de Controle",
    desc: "Veja resumo visual da semana",
    route: "/painel",
    color: "#8B5CF6",
  },

  {
    icon: "bar-chart",
    label: "Relatório de Faturamento",
    desc: "Veja seu faturamento e serviços realizados",
    route: "/relatorio",
    color: "#EA4335",
  },
  {
    icon: "summarize",
    label: "Relatórios Fiscais IR",
    desc: "Totais PF/PJ e exportação CSV para contabilidade",
    route: "/relatorios-fiscais",
    color: "#0EA5E9",
  },
  {
    icon: "request-quote",
    label: "Orçamentos",
    desc: "Crie e envie orçamentos pelo WhatsApp",
    route: "/orcamentos",
    color: "#1A73E8",
  },
  {
    icon: "inventory-2",
    label: "Estoque & Materiais",
    desc: "Móveis, peças e controle de estoque",
    route: "/tabela-precos",
    color: "#F59E0B",
  },
  {
    icon: "settings",
    label: "Configurações",
    desc: "Seus dados e preferências",
    route: "/configuracoes",
    color: "#5F6368",
  },
];

export default function MaisScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>Mais</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>FERRAMENTAS</Text>

        {/* Planos / Assinatura — visível apenas quando PLANOS_ENABLED = true */}
        {PLANOS_ENABLED && (
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: "#FFF7ED", borderColor: "#FB923C", borderWidth: 1.5 }]}
            onPress={() => router.push("/planos" as any)}
            activeOpacity={0.75}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#FB923C18" }]}>
              <MaterialIcons name="workspace-premium" size={26} color="#FB923C" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>Planos e Assinatura</Text>
              <Text style={[styles.menuDesc, { color: colors.muted }]}>Desbloqueie todos os recursos Pro</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
          </TouchableOpacity>
        )}

        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.75}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.color + "18" }]}>
              <MaterialIcons name={item.icon as any} size={26} color={item.color} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Text style={[styles.menuDesc, { color: colors.muted }]}>{item.desc}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 8 }]}>SUPORTE</Text>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push("/ajuda" as any)}
          activeOpacity={0.75}
        >
          <View style={[styles.menuIcon, { backgroundColor: "#0EA5E918" }]}>
            <MaterialIcons name="help-outline" size={26} color="#0EA5E9" />
          </View>
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>Ajuda e Suporte</Text>
            <Text style={[styles.menuDesc, { color: colors.muted }]}>FAQ, contato e política de privacidade</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
        </TouchableOpacity>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    elevation: 1,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuInfo: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  menuDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
});
