import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import Constants from "expo-constants";
import { Alert } from "react-native";
import {
  getAgendamentos,
  getClientes,
  getOrcamentos,
  getAvaliacaoLink,
  saveClientes,
  saveAgendamentos,
  saveOrcamentos,
  saveAvaliacaoLink,
} from "@/lib/store";

export interface BackupData {
  timestamp: number;
  version: string;
  data: {
    clientes: any[];
    agendamentos: any[];
    orcamentos: any[];
    avaliacaoLink: string;
  };
}

export interface BackupStatus {
  lastBackup: number | null;
  nextBackup: number | null;
  isBackingUp: boolean;
  error: string | null;
  lastBackupPath?: string;
}

const BACKUP_STATUS_KEY = "@montafacil:backup_status";
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas
const BACKUP_DIR = (FileSystem.documentDirectory ?? "") + "backups/";

function getInstalledVersion(): string {
  return (
    Constants.nativeAppVersion ??
    Constants.expoConfig?.version ??
    "1.0.0"
  );
}

/**
 * Obter status atual do backup
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  try {
    const raw = await AsyncStorage.getItem(BACKUP_STATUS_KEY);
    if (!raw) return { lastBackup: null, nextBackup: null, isBackingUp: false, error: null };
    return JSON.parse(raw);
  } catch {
    return { lastBackup: null, nextBackup: null, isBackingUp: false, error: null };
  }
}

/**
 * Atualizar status do backup
 */
async function updateBackupStatus(partial: Partial<BackupStatus>): Promise<void> {
  const current = await getBackupStatus();
  await AsyncStorage.setItem(BACKUP_STATUS_KEY, JSON.stringify({ ...current, ...partial }));
}

/**
 * Preparar dados para backup
 */
export async function prepareBackupData(): Promise<BackupData> {
  const [clientes, agendamentos, orcamentos, avaliacaoLink] = await Promise.all([
    getClientes(),
    getAgendamentos(),
    getOrcamentos(),
    getAvaliacaoLink(),
  ]);
  return {
    timestamp: Date.now(),
    version: getInstalledVersion(),
    data: { clientes, agendamentos, orcamentos, avaliacaoLink },
  };
}

/**
 * Salvar backup como arquivo JSON local em documentDirectory/backups/
 * Retorna o caminho do arquivo salvo ou null em caso de erro
 */
export async function saveBackupLocally(backupData?: BackupData): Promise<string | null> {
  try {
    await updateBackupStatus({ isBackingUp: true, error: null });

    const data = backupData ?? (await prepareBackupData());

    const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
    }

    const date = new Date(data.timestamp);
    const dateStr = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("");
    const filePath = BACKUP_DIR + `backup_${dateStr}.json`;

    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await updateBackupStatus({
      lastBackup: data.timestamp,
      nextBackup: Date.now() + BACKUP_INTERVAL,
      isBackingUp: false,
      error: null,
      lastBackupPath: filePath,
    });

    return filePath;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    await updateBackupStatus({ isBackingUp: false, error: errorMsg });
    return null;
  }
}

/**
 * Exportar backup via share sheet nativo — pergunta ao usuário onde salvar
 * (Google Drive, Downloads, WhatsApp, e-mail, etc.)
 */
export async function exportBackupToShare(): Promise<boolean> {
  try {
    const data = await prepareBackupData();
    const filePath = await saveBackupLocally(data);

    if (!filePath) {
      Alert.alert("Erro", "Não foi possível gerar o arquivo de backup.");
      return false;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("Indisponível", "Compartilhamento não disponível neste dispositivo.");
      return false;
    }

    await Sharing.shareAsync(filePath, {
      mimeType: "application/json",
      dialogTitle: "Salvar backup em...",
      UTI: "public.json",
    });

    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    Alert.alert("Erro ao exportar", errorMsg);
    return false;
  }
}

/**
 * Restaurar dados a partir de um arquivo .json escolhido pelo usuário
 */
export async function restoreFromFile(): Promise<boolean> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return false;

    const content = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const backupData: BackupData = JSON.parse(content);

    if (!backupData?.data || !Array.isArray(backupData.data.clientes)) {
      Alert.alert("Arquivo inválido", "Este arquivo não é um backup do MontaFácil.");
      return false;
    }

    await Promise.all([
      saveClientes(backupData.data.clientes),
      saveAgendamentos(backupData.data.agendamentos),
      saveOrcamentos(backupData.data.orcamentos),
      saveAvaliacaoLink(backupData.data.avaliacaoLink ?? ""),
    ]);

    const backupDate = new Date(backupData.timestamp).toLocaleDateString("pt-BR");
    Alert.alert("Restaurado!", `Dados do backup de ${backupDate} restaurados com sucesso.`);
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    Alert.alert("Erro ao restaurar", errorMsg);
    return false;
  }
}

/**
 * Fazer backup automático se passaram 24 horas desde o último
 */
export async function performAutoBackup(): Promise<boolean> {
  const status = await getBackupStatus();
  if (status.isBackingUp) return false;
  if (status.nextBackup && Date.now() < status.nextBackup) return false;
  const filePath = await saveBackupLocally();
  return filePath !== null;
}

/**
 * Formatar data/hora do último backup para exibição
 */
export function formatBackupTime(timestamp: number | null): string {
  if (!timestamp) return "Nenhum backup ainda";
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
