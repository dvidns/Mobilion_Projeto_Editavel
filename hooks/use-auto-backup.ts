import { useEffect, useCallback, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { performAutoBackup, getBackupStatus, type BackupStatus } from "@/lib/backup-service";

/**
 * Hook para gerenciar backup automático diário
 * - Funciona sem autenticação (dados são locais)
 * - Faz backup quando o app entra em background (se passaram 24h)
 * - Verifica na montagem se o backup diário é necessário
 */
export function useAutoBackup() {
  const [status, setStatus] = useState<BackupStatus | null>(null);

  // Carregar status inicial e executar backup se necessário
  useEffect(() => {
    getBackupStatus().then(setStatus);
    performAutoBackup().then(async (success) => {
      if (success) {
        const newStatus = await getBackupStatus();
        setStatus(newStatus);
      }
    });
  }, []);

  // Fazer backup quando app entra em background (apenas se necessário)
  const handleAppStateChange = useCallback(async (state: AppStateStatus) => {
    if (state === "background") {
      const success = await performAutoBackup();
      if (success) {
        const newStatus = await getBackupStatus();
        setStatus(newStatus);
      }
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [handleAppStateChange]);

  return { status, refresh: () => getBackupStatus().then(setStatus) };
}
