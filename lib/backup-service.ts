import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAgendamentos, getClientes, getOrcamentos, getAvaliacaoLink } from "@/lib/store";

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
}

const BACKUP_STATUS_KEY = "@montafacil:backup_status";
const BACKUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 horas

/**
 * Obter status atual do backup
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  try {
    const raw = await AsyncStorage.getItem(BACKUP_STATUS_KEY);
    if (!raw) {
      return {
        lastBackup: null,
        nextBackup: null,
        isBackingUp: false,
        error: null,
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      lastBackup: null,
      nextBackup: null,
      isBackingUp: false,
      error: null,
    };
  }
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
    version: "1.0.0",
    data: {
      clientes,
      agendamentos,
      orcamentos,
      avaliacaoLink,
    },
  };
}

/**
 * Fazer upload do backup para a nuvem (usando servidor local)
 */
export async function uploadBackupToCloud(backupData: BackupData): Promise<boolean> {
  try {
    // Atualizar status: iniciando backup
    await updateBackupStatus({ isBackingUp: true, error: null });

    // Enviar para o servidor (API local)
    const response = await fetch("http://127.0.0.1:3000/api/backup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backupData),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    // Atualizar status: backup concluído
    const nextBackup = Date.now() + BACKUP_INTERVAL;
    await updateBackupStatus({
      lastBackup: backupData.timestamp,
      nextBackup,
      isBackingUp: false,
      error: null,
    });

    console.log("✅ Backup enviado com sucesso para a nuvem");
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("❌ Erro ao fazer backup:", errorMsg);

    // Atualizar status com erro
    await updateBackupStatus({
      isBackingUp: false,
      error: errorMsg,
    });

    return false;
  }
}

/**
 * Fazer backup automático (se necessário)
 */
export async function performAutoBackup(): Promise<boolean> {
  const status = await getBackupStatus();

  // Se já está fazendo backup, não fazer novamente
  if (status.isBackingUp) {
    return false;
  }

  // Se o próximo backup ainda não chegou, não fazer
  const agora = Date.now();
  if (status.nextBackup && agora < status.nextBackup) {
    return false;
  }

  // Preparar e enviar backup
  const backupData = await prepareBackupData();
  return uploadBackupToCloud(backupData);
}

/**
 * Forçar backup imediato
 */
export async function forceBackupNow(): Promise<boolean> {
  const backupData = await prepareBackupData();
  return uploadBackupToCloud(backupData);
}

/**
 * Atualizar status do backup
 */
async function updateBackupStatus(partial: Partial<BackupStatus>): Promise<void> {
  const current = await getBackupStatus();
  const updated = { ...current, ...partial };
  await AsyncStorage.setItem(BACKUP_STATUS_KEY, JSON.stringify(updated));
}

/**
 * Restaurar dados do backup (simular download da nuvem)
 */
export async function restoreFromBackup(): Promise<BackupData | null> {
  try {
    const response = await fetch("http://127.0.0.1:3000/api/backup", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const backupData: BackupData = await response.json();
    console.log("✅ Backup restaurado da nuvem");
    return backupData;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("❌ Erro ao restaurar backup:", errorMsg);
    return null;
  }
}

/**
 * Formatar tempo relativo para exibição
 */
export function formatBackupTime(timestamp: number | null): string {
  if (!timestamp) return "Nunca";

  const agora = Date.now();
  const diff = agora - timestamp;

  const minutos = Math.floor(diff / 60000);
  const horas = Math.floor(diff / 3600000);
  const dias = Math.floor(diff / 86400000);

  if (minutos < 1) return "Agora";
  if (minutos < 60) return `${minutos}m atrás`;
  if (horas < 24) return `${horas}h atrás`;
  return `${dias}d atrás`;
}
