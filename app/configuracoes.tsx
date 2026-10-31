import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Constants from "expo-constants";

import { ScreenContainer } from "@/components/screen-container";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { syncAllAgendamentosToGoogleCalendar, MOBILION_CALENDAR_NAME } from "@/lib/google-calendar-service";
import { uploadBackupToGoogleDrive } from "@/lib/google-drive-service";
import { syncLocalDataToFirestore } from "@/lib/firestore-sync-service";
import {
  getAvaliacaoLink, saveAvaliacaoLink,
  getLembretePersonalizado, saveLembretePersonalizado,
  getWhatsAppTipo, saveWhatsAppTipo,
  getLinkPagamento, saveLinkPagamento,
} from "@/lib/store";
import { checkForUpdates, downloadAndInstallUpdate, getInstalledBuildVersion, type UpdateStatus } from "@/lib/update-service";
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

function getInstalledVersion(): string {
  return Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "1.0.0";
}

export default function ConfiguracoesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [avaliacaoLink, setAvaliacaoLink] = useState("");
  const [lembrete, setLembrete] = useState("");
  const [whatsappBusiness, setWhatsappBusiness] = useState(false);
  const [linkPagamento, setLinkPagamento] = useState("");
  const [saving, setSaving] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);

  const {
    isAuthenticated: isGoogleAuth,
    user: googleUser,
    signIn: signInGoogle,
    signOut: signOutGoogle,
  } = useGoogleAuth();
  const [syncingGoogleCalendar, setSyncingGoogleCalendar] = useState(false);
  const [uploadingGoogleDrive, setUploadingGoogleDrive] = useState(false);
  const [syncingFirestore, setSyncingFirestore] = useState(false);

  const sincronizarGoogleCalendar = async () => {
    if (!isGoogleAuth) {
      Alert.alert("Google Desconectado", "Conecte sua conta Google antes de sincronizar.");
      return;
    }
    setSyncingGoogleCalendar(true);
    try {
      const res = await syncAllAgendamentosToGoogleCalendar();
      Alert.alert(
        "Sincronização Concluída",
        `${res.syncedCount} de ${res.totalAgendamentos} agendamentos sincronizados com sucesso no calendário '${MOBILION_CALENDAR_NAME}'.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro na sincronização";
      Alert.alert("Erro", msg);
    } finally {
      setSyncingGoogleCalendar(false);
    }
  };

  const fazerBackupGoogleDrive = async () => {
    if (!isGoogleAuth) {
      Alert.alert("Google Desconectado", "Conecte sua conta Google antes de salvar no Drive.");
      return;
    }
    setUploadingGoogleDrive(true);
    try {
      const res = await uploadBackupToGoogleDrive();
      Alert.alert("Backup no Google Drive", `Backup '${res.fileName}' enviado com sucesso para a pasta 'Mobilion Backup' no seu Drive!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro no upload";
      Alert.alert("Erro", msg);
    } finally {
      setUploadingGoogleDrive(false);
    }
  };

  const sincronizarFirestore = async () => {
    if (!isGoogleAuth) {
      Alert.alert("Google Desconectado", "Conecte sua conta Google antes de espelhar dados.");
      return;
    }
    setSyncingFirestore(true);
    try {
      const res = await syncLocalDataToFirestore();
      if (res.success) {
        Alert.alert(
          "Cloud Firestore",
          `Sincronização concluída com sucesso!\n• Clientes: ${res.clientesSynced}\n• Atendimentos: ${res.agendamentosSynced}\n• Orçamentos: ${res.orcamentosSynced}`
        );
      } else {
        Alert.alert("Aviso Firestore", res.error || "Não foi possível concluir a sincronização.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro no Firestore";
      Alert.alert("Erro", msg);
    } finally {
      setSyncingFirestore(false);
    }
  };

  const verificarAtualizacao = useCallback(async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus(null);
    try {
      const status = await checkForUpdates();
      setUpdateStatus(status);
    } catch {
      setUpdateStatus({
        isAvailable: false,
        isDownloading: false,
        isReady: false,
        currentVersion: getInstalledVersion(),
        currentBuildVersion: getInstalledBuildVersion(),
        error: "Falha ao verificar",
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const baixarAtualizacao = useCallback(async () => {
    setIsDownloadingUpdate(true);
    const ok = await downloadAndInstallUpdate(updateStatus?.downloadUrl);
    if (!ok) {
      Alert.alert("Atualização", "Não foi possível abrir o download do APK agora.");
    }
    setIsDownloadingUpdate(false);
  }, [updateStatus]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(KEY_PERFIL),
      getAvaliacaoLink(),
      getLembretePersonalizado(),
      getWhatsAppTipo(),
      getLinkPagamento(),
    ]).then(([raw, link, lemb, tipo, pix]) => {
      if (raw) {
        const p: Perfil = JSON.parse(raw);
        setNome(p.nome ?? "");
        setTelefone(p.telefone ?? "");
        setCidade(p.cidade ?? "");
      }
      setAvaliacaoLink(link);
      setLembrete(lemb);
      setWhatsappBusiness(tipo === "business");
      setLinkPagamento(pix ?? "");
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
        saveWhatsAppTipo(whatsappBusiness ? "business" : "normal"),
        saveLinkPagamento(linkPagamento),
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

  async function fazerBackupAgora() {
    setBackupModalOpen(false);
    try {
      setIsBackingUp(true);
      const path = await saveBackupLocally();
      if (path) {
        getBackupStatus().then(setBackupStatus);
        Alert.alert("Backup salvo!", "Dados salvos localmente com sucesso.");
      } else {
        Alert.alert("Erro", "Não foi possível salvar o backup agora.");
      }
    } catch {
      Alert.alert("Erro", "Falha inesperada ao salvar backup.");
    } finally {
      setIsBackingUp(false);
    }
  }

  async function exportarBackup() {
    setBackupModalOpen(false);
    try {
      setIsExporting(true);
      const exported = await exportBackupToShare();
      if (!exported) {
        Alert.alert("Exportação", "Não foi possível exportar o backup agora.");
      }
    } catch {
      Alert.alert("Erro", "Falha inesperada ao exportar backup.");
    } finally {
      setIsExporting(false);
      getBackupStatus().then(setBackupStatus);
    }
  }

  async function restaurarBackup() {
    setBackupModalOpen(false);
    setIsRestoring(true);
    const restored = await restoreFromFile();
    setIsRestoring(false);
    if (restored) {
      getBackupStatus().then(setBackupStatus);
    }
  }

  function abrirOpcoesBackup() {
    setBackupModalOpen(true);
  }

  function sairDaConta() {
    Alert.alert(
      "Sair da conta",
      "Deseja sair para entrar com outra conta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.push("/login" as any);
          },
        },
      ],
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

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>WHATSAPP</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>Usar WhatsApp Business</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
                Ao enviar mensagens, abre o app WhatsApp Business (se instalado)
              </Text>
            </View>
            <Switch
              value={whatsappBusiness}
              onValueChange={setWhatsappBusiness}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
          <Input
            label="Chave PIX / Link de pagamento (opcional)"
            value={linkPagamento}
            onChangeText={setLinkPagamento}
            placeholder="sua-chave@pix.com ou https://pagamento..."
            keyboardType="url"
          />
          <Text style={[styles.sectionDesc, { color: colors.muted, marginTop: 4 }]}>
            Se preenchido, será incluído automaticamente nas mensagens de lembrete enviadas ao cliente.
          </Text>
        </View>

        <Button title="Salvar Tudo" onPress={salvar} loading={saving} />

        {/* Integração Google Oficial (Mobilion Móveis) */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>INTEGRAÇÃO GOOGLE (MOBILION)</Text>
          <Text style={[styles.sectionDesc, { color: colors.muted }]}>
            Conecte a conta da Mobilion Móveis (atendimento.mobilio@gmail.com) para sincronizar Google Agenda, Google Contatos e Google Drive.
          </Text>

          {isGoogleAuth && googleUser ? (
            <View style={{ gap: 12, marginTop: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, backgroundColor: "#E6F4EA", borderRadius: 8 }}>
                <MaterialIcons name="check-circle" size={24} color="#34A853" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "bold", color: "#137333" }}>Conectado ao Google</Text>
                  <Text style={{ fontSize: 13, color: "#137333" }}>{googleUser.email}</Text>
                </View>
                <TouchableOpacity
                  onPress={signOutGoogle}
                  style={{ paddingVertical: 4, paddingHorizontal: 8, backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: "#34A853" }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#137333" }}>Sair</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.updateCheckBtn, { borderColor: "#1A73E8" }]}
                onPress={sincronizarGoogleCalendar}
                disabled={syncingGoogleCalendar}
                activeOpacity={0.75}
              >
                {syncingGoogleCalendar ? (
                  <ActivityIndicator size={18} color="#1A73E8" />
                ) : (
                  <MaterialIcons name="calendar-month" size={18} color="#1A73E8" />
                )}
                <Text style={[styles.updateCheckText, { color: "#1A73E8" }]}>
                  {syncingGoogleCalendar ? "Sincronizando..." : "Sincronizar Google Agenda ('Mobilion — Atendimentos')"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.updateCheckBtn, { borderColor: "#FBBC04" }]}
                onPress={fazerBackupGoogleDrive}
                disabled={uploadingGoogleDrive}
                activeOpacity={0.75}
              >
                {uploadingGoogleDrive ? (
                  <ActivityIndicator size={18} color="#FBBC04" />
                ) : (
                  <MaterialIcons name="cloud-upload" size={18} color="#EA8600" />
                )}
                <Text style={[styles.updateCheckText, { color: "#EA8600" }]}>
                  {uploadingGoogleDrive ? "Enviando ao Drive..." : "Salvar Backup no Google Drive"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.updateCheckBtn, { borderColor: "#FF6D00" }]}
                onPress={sincronizarFirestore}
                disabled={syncingFirestore}
                activeOpacity={0.75}
              >
                {syncingFirestore ? (
                  <ActivityIndicator size={18} color="#FF6D00" />
                ) : (
                  <MaterialIcons name="sync" size={18} color="#FF6D00" />
                )}
                <Text style={[styles.updateCheckText, { color: "#FF6D00" }]}>
                  {syncingFirestore ? "Espelhando..." : "Sincronizar Nuvem (Cloud Firestore)"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.updateCheckBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "10" }]}
                onPress={signInGoogle}
                activeOpacity={0.75}
              >
                <MaterialIcons name="login" size={18} color={colors.primary} />
                <Text style={[styles.updateCheckText, { color: colors.primary, fontWeight: "bold" }]}>
                  Conectar Conta Google
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>CONTA</Text>

          {authLoading ? (
            <View style={styles.accountRow}>
              <ActivityIndicator size={18} color={colors.primary} />
              <Text style={{ color: colors.muted, fontSize: 13 }}>Verificando conta...</Text>
            </View>
          ) : user ? (
            <>
              <Text style={[styles.accountName, { color: colors.foreground }]}>
                {user.name || user.email || user.openId}
              </Text>
              <Text style={[styles.accountSub, { color: colors.muted }]}>
                Método: {user.loginMethod || "oauth"} · Perfil: {user.role}
              </Text>

              <TouchableOpacity
                style={[styles.logoutBtn, { borderColor: colors.error }]}
                onPress={sairDaConta}
                activeOpacity={0.8}
              >
                <MaterialIcons name="logout" size={18} color={colors.error} />
                <Text style={[styles.logoutBtnText, { color: colors.error }]}>Sair e trocar conta</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.updateCheckBtn, { borderColor: colors.primary, marginBottom: 0 }]}
              onPress={() => router.push("/login" as any)}
              activeOpacity={0.75}
            >
              <MaterialIcons name="login" size={18} color={colors.primary} />
              <Text style={[styles.updateCheckText, { color: colors.primary }]}>Entrar na conta</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>ATUALIZAÇÃO E SOBRE O APP</Text>

          <View style={[styles.infoRow, { marginBottom: 12 }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Versão instalada</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {getInstalledVersion()} (build {getInstalledBuildVersion()})
            </Text>
          </View>

          <View style={[styles.infoRow, { marginBottom: 12 }]}> 
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Desenvolvido para</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>Montadores de Móveis</Text>
          </View>

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
                    Versão atual: {updateStatus.currentVersion} (build {updateStatus.currentBuildVersion})
                  </Text>
                  <Text style={[styles.updateResultDesc, { color: colors.muted }]}>
                    Nova versão: {updateStatus.newVersion}
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
                      {isDownloadingUpdate ? "Abrindo..." : "Baixar APK"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : updateStatus.error ? (
                <>
                  <View style={styles.updateResultRow}>
                    <MaterialIcons name="wifi-off" size={20} color={colors.error} />
                    <Text style={[styles.updateResultTitle, { color: colors.error }]}> 
                      Não foi possível verificar atualizações
                    </Text>
                  </View>
                  <Text style={[styles.updateResultDesc, { color: colors.muted }]}>
                    Versão instalada: {updateStatus.currentVersion} (build {updateStatus.currentBuildVersion})
                  </Text>
                  <Text style={[styles.updateResultDesc, { color: colors.muted }]}>
                    {updateStatus.error}
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.updateResultRow}>
                    <MaterialIcons name="check-circle" size={20} color={colors.success} />
                    <Text style={[styles.updateResultTitle, { color: colors.success }]}> 
                      Você já tem a versão mais recente
                    </Text>
                  </View>
                  <Text style={[styles.updateResultDesc, { color: colors.muted }]}>
                    Versão instalada: {updateStatus.currentVersion} (build {updateStatus.currentBuildVersion})
                  </Text>
                  {!!updateStatus.latestVersion && (
                    <Text style={[styles.updateResultDesc, { color: colors.muted }]}>
                      Versão do GitHub: {updateStatus.latestVersion}
                    </Text>
                  )}
                  {!!updateStatus.downloadUrl && (
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
                        {isDownloadingUpdate ? "Abrindo..." : "Abrir link do APK"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => setBackupOpen((value) => !value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.sectionTitle, styles.cardTitle, { color: colors.muted }]}>BACKUP</Text>
            <MaterialIcons
              name={backupOpen ? "expand-less" : "expand-more"}
              size={22}
              color={colors.muted}
            />
          </TouchableOpacity>

          {backupOpen && (
            <View style={styles.cardContent}>
              <Text style={[styles.backupInfo, { color: colors.muted }]}> 
                {backupStatus?.lastBackup
                  ? `Último backup: ${formatBackupTime(backupStatus.lastBackup)}`
                  : "Nenhum backup realizado ainda"}
              </Text>

              {!!backupStatus?.lastBackupPath && (
                <Text style={[styles.backupInfo, { color: colors.muted }]}> 
                  Arquivo: {backupStatus.lastBackupPath}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.updateCheckBtn, { borderColor: colors.primary }]}
                onPress={abrirOpcoesBackup}
                disabled={isBackingUp || isExporting || isRestoring}
                activeOpacity={0.75}
              >
                {isBackingUp || isExporting || isRestoring
                  ? <ActivityIndicator size={18} color={colors.primary} />
                  : <MaterialIcons name="save" size={18} color={colors.primary} />}
                <Text style={[styles.updateCheckText, { color: colors.primary }]}> 
                  {isBackingUp
                    ? "Salvando..."
                    : isExporting
                      ? "Preparando..."
                      : isRestoring
                        ? "Restaurando..."
                        : "Gerenciar backup"}
                </Text>
              </TouchableOpacity>
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

      <Modal
        visible={backupModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBackupModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Gerenciar backup</Text>
            <Text style={[styles.modalDescription, { color: colors.muted }]}>Escolha o que deseja fazer com seus dados.</Text>

            <TouchableOpacity
              style={[styles.modalAction, { borderColor: colors.border }]}
              onPress={fazerBackupAgora}
              disabled={isBackingUp || isExporting || isRestoring}
              activeOpacity={0.75}
            >
              <MaterialIcons name="save" size={18} color={colors.primary} />
              <View style={styles.modalActionContent}>
                <Text style={[styles.modalActionTitle, { color: colors.foreground }]}>Fazer backup agora</Text>
                <Text style={[styles.modalActionSubtitle, { color: colors.muted }]}>Salva uma cópia local no aparelho.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalAction, { borderColor: colors.border }]}
              onPress={exportarBackup}
              disabled={isBackingUp || isExporting || isRestoring}
              activeOpacity={0.75}
            >
              <MaterialIcons name="ios-share" size={18} color={colors.primary} />
              <View style={styles.modalActionContent}>
                <Text style={[styles.modalActionTitle, { color: colors.foreground }]}>Exportar backup</Text>
                <Text style={[styles.modalActionSubtitle, { color: colors.muted }]}>Compartilha o arquivo para outro app ou local.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalAction, { borderColor: colors.border }]}
              onPress={restaurarBackup}
              disabled={isBackingUp || isExporting || isRestoring}
              activeOpacity={0.75}
            >
              <MaterialIcons name="restore" size={18} color={colors.primary} />
              <View style={styles.modalActionContent}>
                <Text style={[styles.modalActionTitle, { color: colors.foreground }]}>Restaurar backup</Text>
                <Text style={[styles.modalActionSubtitle, { color: colors.muted }]}>Importa um arquivo salvo anteriormente.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              onPress={() => setBackupModalOpen(false)}
              activeOpacity={0.75}
            >
              <Text style={[styles.modalCancelText, { color: colors.foreground }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    marginBottom: 0,
  },
  cardContent: {
    marginTop: 12,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accountName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  accountSub: {
    fontSize: 13,
    marginBottom: 10,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: "700",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  modalActionContent: {
    flex: 1,
    gap: 2,
  },
  modalActionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  modalActionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalCancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
