import AsyncStorage from "@react-native-async-storage/async-storage";

const UPDATE_CHECK_KEY = "@montafacil:last_update_check";
const UPDATE_AVAILABLE_KEY = "@montafacil:update_available";
const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hora

export interface UpdateStatus {
  isAvailable: boolean;
  isDownloading: boolean;
  isReady: boolean;
  currentVersion: string;
  newVersion?: string;
  error?: string;
}

/**
 * Verificar se há atualizações disponíveis
 * Nota: Atualizações OTA desabilitadas para compatibilidade com build Android
 */
export async function checkForUpdates(): Promise<UpdateStatus> {
  try {
    console.log("ℹ️ Verificação de atualizações desabilitada (OTA não suportado)");
    
    const status: UpdateStatus = {
      isAvailable: false,
      isDownloading: false,
      isReady: false,
      currentVersion: "1.0.0",
    };

    return status;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("❌ Erro ao verificar atualizações:", errorMsg);

    return {
      isAvailable: false,
      isDownloading: false,
      isReady: false,
      currentVersion: "1.0.0",
      error: errorMsg,
    };
  }
}

/**
 * Baixar e instalar atualização
 * Nota: Atualizações OTA desabilitadas para compatibilidade com build Android
 */
export async function downloadAndInstallUpdate(): Promise<boolean> {
  try {
    console.log("ℹ️ Atualizações OTA não suportadas nesta versão");
    return false;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("❌ Erro ao baixar atualização:", errorMsg);
    return false;
  }
}

/**
 * Limpar status de atualização armazenado
 */
export async function clearUpdateStatus(): Promise<void> {
  await AsyncStorage.removeItem(UPDATE_AVAILABLE_KEY);
  await AsyncStorage.removeItem(UPDATE_CHECK_KEY);
}

/**
 * Obter status armazenado de atualização
 */
export async function getStoredUpdateStatus(): Promise<UpdateStatus | null> {
  try {
    const stored = await AsyncStorage.getItem(UPDATE_AVAILABLE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
