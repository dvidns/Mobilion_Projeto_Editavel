import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const UPDATE_AVAILABLE_KEY = "@montafacil:update_available";

export interface UpdateStatus {
  isAvailable: boolean;
  isDownloading: boolean;
  isReady: boolean;
  currentVersion: string;
  currentBuildVersion: string;
  newVersion?: string;
  latestVersion?: string;
  downloadUrl?: string;
  error?: string;
}

type ExtraConfig = {
  githubBuildNumber?: string;
  githubRepo?: string;
};

function getCurrentVersion(): string {
  return (Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "1.0.0") as string;
}

function getExtra(): ExtraConfig {
  return (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const currentVersion = getCurrentVersion();
  const currentBuildVersion = String(Constants.nativeBuildVersion ?? Constants.expoConfig?.android?.versionCode ?? 0);
  const extra = getExtra();
  const currentBuildNumber = Number(extra.githubBuildNumber ?? 0);
  const githubRepo = extra.githubRepo ?? "dvidns/appmontafacil1";

  const baseStatus: UpdateStatus = {
    isAvailable: false,
    isDownloading: false,
    isReady: false,
    currentVersion,
    currentBuildVersion,
  };

  try {
    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/releases/latest`,
      { headers: { Accept: "application/vnd.github+json" } }
    );

    if (!response.ok) return baseStatus;

    const release = await response.json();
    const tagName: string = release.tag_name ?? "";
    const latestBuildNumber = Number(tagName.replace("build-", "")) || 0;

    const apkAsset = (release.assets as { name: string; browser_download_url: string }[] | undefined)
      ?.find((a) => a.name.endsWith(".apk"));
    const downloadUrl = apkAsset?.browser_download_url;

    const isAvailable = latestBuildNumber > currentBuildNumber;

    const status: UpdateStatus = {
      ...baseStatus,
      isAvailable,
      newVersion: isAvailable ? tagName : undefined,
      latestVersion: tagName ? tagName : undefined,
      downloadUrl,
    };

    await AsyncStorage.setItem(UPDATE_AVAILABLE_KEY, JSON.stringify(status));
    return status;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    return { ...baseStatus, error: errorMsg };
  }
}

export async function downloadAndInstallUpdate(downloadUrl?: string): Promise<boolean> {
  try {
    const urlToOpen = downloadUrl ?? (await getStoredUpdateStatus())?.downloadUrl;
    if (urlToOpen) {
      const { Linking } = await import("react-native");
      await Linking.openURL(urlToOpen);
      return true;
    }
    return false;
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
