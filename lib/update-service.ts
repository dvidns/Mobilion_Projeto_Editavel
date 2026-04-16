import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const UPDATE_AVAILABLE_KEY = "@montafacil:update_available";

// URL da API pública do EAS que retorna o build mais recente do projeto
const EAS_PROJECT_ID = "232068b3-acba-4de1-b633-dd491f53b984";
const EAS_API_URL = `https://api.expo.dev/v2/projects/${EAS_PROJECT_ID}/builds?platform=android&distribution=internal&limit=1`;

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

function getCurrentVersion(): string {
  return (Constants.expoConfig?.version ?? Constants.manifest?.version ?? "1.0.0") as string;
}

/**
 * Verifica se há uma versão mais recente disponível consultando a API do EAS.
 * Compara o versionCode (appBuildVersion) do build mais recente com o atual.
 */
export async function checkForUpdates(): Promise<UpdateStatus> {
  const currentVersion = getCurrentVersion();
  const currentBuildVersion = String(Constants.expoConfig?.android?.versionCode ?? 0);
  try {
    const resp = await fetch(EAS_API_URL, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const builds: any[] = json?.data ?? json?.builds ?? [];

    if (!builds.length) {
      return {
        isAvailable: false,
        isDownloading: false,
        isReady: false,
        currentVersion,
        currentBuildVersion,
      };
    }

    const latest = builds[0];
    const latestAppBuildVersion = String(latest?.appBuildVersion ?? "");
    const downloadUrl: string | undefined = latest?.artifacts?.applicationArchiveUrl ?? undefined;

    // Considera disponível se há build mais novo e existe URL de download
    const isAvailable =
      !!latestAppBuildVersion &&
      !!currentBuildVersion &&
      Number(latestAppBuildVersion) > Number(currentBuildVersion) &&
      !!downloadUrl;

    const status: UpdateStatus = {
      isAvailable,
      isDownloading: false,
      isReady: false,
      currentVersion,
      currentBuildVersion,
      newVersion: isAvailable ? latestAppBuildVersion : undefined,
      downloadUrl: isAvailable ? downloadUrl : undefined,
    };

    await AsyncStorage.setItem(UPDATE_AVAILABLE_KEY, JSON.stringify(status));
    return status;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      isAvailable: false,
      isDownloading: false,
      isReady: false,
      currentVersion,
      currentBuildVersion,
      error: errorMsg,
    };
  }
}

/**
 * Abre o link de download da atualização no navegador.
 */
export async function downloadAndInstallUpdate(downloadUrl?: string): Promise<boolean> {
  try {
    const { Linking } = await import("react-native");
    const url = downloadUrl ?? "https://expo.dev/accounts/dvidns/projects/montador_moveis_app";
    await Linking.openURL(url);
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
