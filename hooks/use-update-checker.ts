import { useEffect, useState, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { checkForUpdates, downloadAndInstallUpdate, type UpdateStatus } from "@/lib/update-service";

/**
 * Hook para verificar atualizações automaticamente
 * - Verifica quando o app entra em foreground
 * - Verifica periodicamente (a cada 1 hora)
 * - Fornece estado de atualização
 */
export function useUpdateChecker() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Verificar atualizações
  const checkUpdates = useCallback(async () => {
    if (isChecking || isDownloading) return;

    setIsChecking(true);
    try {
      const status = await checkForUpdates();
      setUpdateStatus(status);
    } catch (err) {
      console.error("Erro ao verificar atualizações:", err);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, isDownloading]);

  // Baixar e instalar atualização
  const downloadUpdate = useCallback(async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      const success = await downloadAndInstallUpdate();
      if (success) {
        console.log("✅ App será recarregado com a nova versão");
      } else {
        console.error("❌ Falha ao baixar atualização");
      }
    } catch (err) {
      console.error("Erro ao baixar atualização:", err);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

  // Verificar quando app entra em foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = useCallback(
    async (state: AppStateStatus) => {
      if (state === "active") {
        console.log("📱 App em foreground, verificando atualizações...");
        await checkUpdates();
      }
    },
    [checkUpdates]
  );

  // Verificar na montagem
  useEffect(() => {
    checkUpdates();
  }, []);

  // Verificar periodicamente (a cada 1 hora)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("⏰ Verificação periódica de atualizações");
      checkUpdates();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkUpdates]);

  return {
    updateStatus,
    isChecking,
    isDownloading,
    checkUpdates,
    downloadUpdate,
  };
}
