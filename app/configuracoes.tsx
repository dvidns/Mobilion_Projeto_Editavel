import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Constants from "expo-constants";

import { ScreenContainer } from "@/components/screen-container";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useColors } from "@/hooks/use-colors";
import { getAvaliacaoLink, saveAvaliacaoLink, getLembretePersonalizado, saveLembretePersonalizado } from "@/lib/store";
import { checkForUpdates, downloadAndInstallUpdate, type UpdateStatus } from "@/lib/update-service";
import {
  getBackupStatus, saveBackupLocally, exportBackupToShare, restoreFromFile,
  formatBackupTime, type BackupStatus,
} from "@/lib/backup-service";

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
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const verificarAtualizacao = useCallback(async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus(null);
    try {
      const status = await checkForUpdates();
      setUpdateStatus(status);
    } catch {
      setUpdateStatus({ isAvailable: false, isDownloading: false, isReady: false, currentVersion: "1.0.0", error: "Falha ao verificar" });
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const baixarAtualizacao = useCallback(async () => {
    setIsDownloadingUpdate(true);
    await downloadAndInstallUpdate(updateStatus?.downloadUrl);
    setIsDownloadingUpdate(false);
  }, [updateStatus]);

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
    getBackupStatus().then(setBackupStatus);
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
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {Constants.expoConfig?.version ?? "1.0.0"} (build {Constants.expoConfig?.android?.versionCode ?? 1})
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Desenvolvido para</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>Montadores de Móveis</Text>
          </View>
        </View>

        {/* ── Backup ── */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>BACKUP</Text>

          <Text style={[styles.backupInfo, { color: colors.muted }]}>
            {backupStatus?.lastBackupTime
              ? `Último backup: ${formatBackupTime(backupStatus.lastBackupTime)}`
              : "Nenhum backup realizado ainda"}
          </Text>

          <TouchableOpacity
            style={[styles.updateCheckBtn, { borderColor: colors.primary }]}
            onPress={async () => {
              setIsBackingUp(true);
              const path = await saveBackupLocally();
              setIsBackingUp(false);
              if (path) {
                getBackupStatus().then(setBackupStatus);
                Alert.alert("Backup salvo!", "Dados salvos localmente com sucesso.");
              }
            }}
            disabled={isBackingUp}
            activeOpacity={0.75}
          >
            {isBackingUp
              ? <ActivityIndicator size={18} color={colors.primary} />
              : <MaterialIcons name="save" size={18} color={colors.primary} />}
            <Text style={[styles.updateCheckText, { color: colors.primary }]}>
              {isBackingUp ? "Salvando..." : "Fazer backup agora"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.updateCheckBtn, { borderColor: colors.primary, marginTop: 8 }]}
            onPress={async () => {
              setIsExporting(true);
              await exportBackupToShare();
              setIsExporting(false);
              getBackupStatus().then(setBackupStatus);
            }}
            disabled={isExporting}
            activeOpacity={0.75}
          >
            {isExporting
              ? <ActivityIndicator size={18} color={colors.primary} />
              : <MaterialIcons name="share" size={18} color={colors.primary} />}
            <Text style={[styles.updateCheckText, { color: colors.primary }]}>
              {isExporting ? "Preparando..." : "Exportar (Drive / Pasta...)"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.updateCheckBtn, { borderColor: colors.warning ?? "#f59e0b", marginTop: 8 }]}
            onPress={async () => {
              setIsRestoring(true);
              await restoreFromFile();
              setIsRestoring(false);
            }}
            disabled={isRestoring}
            activeOpacity={0.75}
          >
            {isRestoring
              ? <ActivityIndicator size={18} color={colors.warning ?? "#f59e0b"} />
              : <MaterialIcons name="restore" size={18} color={colors.warning ?? "#f59e0b"} />}
            <Text style={[styles.updateCheckText, { color: colors.warning ?? "#f59e0b" }]}>
              {isRestoring ? "Restaurando..." : "Restaurar backup"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Verificar Atualização ── */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>ATUALIZAÇÃO</Text>

          {/* Versão instalada */}
          <View style={[styles.infoRow, { marginBottom: 12 }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Versão instalada</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {Constants.expoConfig?.version ?? "1.0.0"} (build {Constants.expoConfig?.android?.versionCode ?? 1})
            </Text>
          </View>

          {/* Botão verificar */}
          <TouchableOpacity
            style={[styles.updateCheckBtn, { borderColor: colors.primary }]}
            onPress={verificarAtualizacao}
            disabled={isCheckingUpdate || isDownloadingUpdate}
            activeOpacity={0.75}
          >
            {isCheckingUpdate ? (
              <ActivityIndicator size={18} color={colors.primary} />
            ) : (
              <MaterialIcons name="system-update" size={18} color={colors.primary} />
            )}
            <Text style={[styles.updateCheckText, { color: colors.primary }]}>
              {isCheckingUpdate ? "Verificando..." : "Verificar atualização"}
            </Text>
          </TouchableOpacity>

          {/* Resultado da verificação */}
          {!isCheckingUpdate && updateStatus && (
            <View style={[styles.updateResultBox,
              updateStatus.isAvailable
                ? { backgroundColor: colors.primary + "18", borderColor: colors.primary }
                : updateStatus.error
                  ? { backgroundColor: colors.error + "18", borderColor: colors.error }
                  : { backgroundColor: colors.success + "18", borderColor: colors.success },
            ]}>
              {updateStatus.isAvailable ? (
                <>
                  <View style={styles.updateResultRow}>
                    <MaterialIcons name="new-releases" size={20} color={colors.primary} />
                    <Text style={[styles.updateResultTitle, { color: colors.primary }]}>
                      Nova versão disponível!
                    </Text>
                  </View>
                  <Text style={[styles.updateResultDesc, { color: colors.muted }]}>
                    Build {updateStatus.newVersion} pronto para instalar.
                  </Text>
                  <TouchableOpacity
                    style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
                    onPress={baixarAtualizacao}
                    disabled={isDownloadingUpdate}
                    activeOpacity={0.8}
                  >
                    {isDownloadingUpdate ? (
                      <ActivityIndicator size={16} color="#fff" />
                    ) : (
                      <MaterialIcons name="cloud-download" size={16} color="#fff" />
                    )}
                    <Text style={styles.downloadBtnText}>
                      {isDownloadingUpdate ? "Abrindo..." : "Baixar e instalar"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : updateStatus.error ? (
                <View style={styles.updateResultRow}>
                  <MaterialIcons name="wifi-off" size={20} color={colors.error} />
                  <Text style={[styles.updateResultTitle, { color: colors.error }]}>
                    Sem conexão ou erro na verificação
                  </Text>
                </View>
              ) : (
                <View style={styles.updateResultRow}>
                  <MaterialIcons name="check-circle" size={20} color={colors.success} />
                  <Text style={[styles.updateResultTitle, { color: colors.success }]}>
                    Você já tem a versão mais recente
                  </Text>
                </View>
              )}
            </View>
          )}
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
  backupInfo: {
    fontSize: 13,
    marginBottom: 10,
  },
  updateCheckBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  updateCheckText: {
    fontSize: 14,
    fontWeight: "600",
  },
  updateResultBox: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  updateResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  updateResultTitle: {
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  updateResultDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  downloadBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
