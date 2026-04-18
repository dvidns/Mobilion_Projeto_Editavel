import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

const UPDATE_AVAILABLE_KEY = "@montafacil:update_available";

export interface UpdateStatus {
  isAvailable: boolean;
  isDownloading: boolean;
  isReady: boolean;
  currentVersion: string;
  currentBuildVersion: string;
  newVersion?: string;
  downloadUrl?: string;
  error?: string;
}

function getConfiguredApkUrl(): string | undefined {
  const value = (Constants.expoConfig?.extra as { apkDownloadUrl?: string } | undefined)?.apkDownloadUrl;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getCurrentVersion(): string {
  return (Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "1.0.0") as string;
}

/**
 * Verifica se há update OTA disponível via expo-updates.
 * Em ambientes sem suporte (dev/Expo Go), retorna estado sem erro crítico.
 */
export async function checkForUpdates(): Promise<UpdateStatus> {
  const currentVersion = getCurrentVersion();
  const currentBuildVersion = String(Constants.nativeBuildVersion ?? Constants.expoConfig?.android?.versionCode ?? 0);
  const apkUrl = getConfiguredApkUrl();

  const baseStatus: UpdateStatus = {
    isAvailable: false,
    isDownloading: false,
    isReady: false,
    currentVersion,
    currentBuildVersion,
    downloadUrl: apkUrl,
  };

  try {
    if (__DEV__) {
      return baseStatus;
    }

    const result = await Updates.checkForUpdateAsync();
    const runtimeVersion = String(Updates.runtimeVersion ?? currentBuildVersion ?? currentVersion);

    const status: UpdateStatus = {
      ...baseStatus,
      isAvailable: result.isAvailable,
      newVersion: result.isAvailable ? runtimeVersion : undefined,
    };

    await AsyncStorage.setItem(UPDATE_AVAILABLE_KEY, JSON.stringify(status));
    return status;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      ...baseStatus,
      error: errorMsg,
    };
  }
}

/**
 * Abre o link de download da atualização no navegador.
 */
export async function downloadAndInstallUpdate(downloadUrl?: string): Promise<boolean> {
  try {
    if (downloadUrl) {
      const { Linking } = await import("react-native");
      await Linking.openURL(downloadUrl);
      return true;
    }

    if (__DEV__) {
      return false;
    }

    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
      return true;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Limpar status de atualização armazenado
 */
export async function clearUpdateStatus(): Promise<void> {
  await AsyncStorage.removeItem(UPDATE_AVAILABLE_KEY);
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
