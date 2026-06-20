import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/button";
import { useColors } from "@/hooks/use-colors";
import { getClientes, getAgendamentos, getOrcamentos } from "@/lib/store";

export default function BackupScreen() {
  const colors = useColors();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleExportData() {
    setSaving(true);
    try {
      // Coletar todos os dados
      const clientes = await getClientes();
      const agendamentos = await getAgendamentos();
      const orcamentos = await getOrcamentos();

      const backupData = {
        timestamp: new Date().toISOString(),
        clientes,
        agendamentos,
        orcamentos,
      };

      // Criar arquivo JSON
      const fileName = `backup-montador-${new Date().toISOString().slice(0, 10)}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(backupData, null, 2));

      // Compartilhar arquivo
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: "application/json",
          dialogTitle: "Salvar Backup",
        });
        Alert.alert("Sucesso!", "Backup exportado com sucesso. Você pode salvar no Google Drive ou dispositivo.");
      } else {
        Alert.alert("Sucesso!", "Arquivo de backup criado. Verifique a pasta de downloads.");
      }
    } catch (error) {
      console.error("Erro ao exportar:", error);
      Alert.alert("Erro", "Não foi possível exportar o backup.");
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
        <Text style={styles.headerTitle}>Backup de Dados</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Card de informação */}
        <View style={[styles.infoCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
          <View style={[styles.infoIcon, { backgroundColor: colors.primary + "25" }]}>
            <MaterialIcons name="backup" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.infoTitle, { color: colors.foreground }]}>Salvar Backup</Text>
          <Text style={[styles.infoDesc, { color: colors.muted }]}>
            Exporte seus dados (clientes, agendamentos e orçamentos) para um arquivo JSON. Você pode salvar no Google Drive, dispositivo ou compartilhar com segurança.
          </Text>
        </View>

        {/* Botão de salvar */}
        <View style={styles.actionSection}>
          <Button
            title={saving ? "Exportando..." : "Exportar Backup"}
            onPress={handleExportData}
            variant="primary"
            disabled={saving}
          />
        </View>

        {/* Instruções */}
        <View style={[styles.instructionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.instructionRow}>
            <View style={[styles.instructionNumber, { backgroundColor: colors.primary }]}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.instructionTitle, { color: colors.foreground }]}>Clique em Exportar Backup</Text>
              <Text style={[styles.instructionDesc, { color: colors.muted }]}>
                Um arquivo JSON será criado com todos os seus dados
              </Text>
            </View>
          </View>

          <View style={styles.instructionRow}>
            <View style={[styles.instructionNumber, { backgroundColor: colors.primary }]}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.instructionTitle, { color: colors.foreground }]}>Escolha o destino</Text>
              <Text style={[styles.instructionDesc, { color: colors.muted }]}>
                Salve no Google Drive, OneDrive, ou em outro local seguro
              </Text>
            </View>
          </View>

          <View style={styles.instructionRow}>
            <View style={[styles.instructionNumber, { backgroundColor: colors.primary }]}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.instructionTitle, { color: colors.foreground }]}>Backup seguro</Text>
              <Text style={[styles.instructionDesc, { color: colors.muted }]}>
                Seus dados estão protegidos e você pode restaurar quando precisar
              </Text>
            </View>
          </View>
        </View>

        {/* Aviso */}
        <View style={[styles.warningCard, { backgroundColor: colors.warning + "15", borderColor: colors.warning }]}>
          <View style={styles.warningRow}>
            <MaterialIcons name="info" size={20} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.muted }]}>
              Recomendamos fazer backup regularmente para proteger seus dados importantes.
            </Text>
          </View>
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
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  infoIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  infoDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  actionSection: {
    gap: 10,
  },
  instructionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  instructionRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  instructionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  warningCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
