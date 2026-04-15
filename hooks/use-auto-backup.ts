import { useEffect, useCallback, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { performAutoBackup, getBackupStatus, type BackupStatus } from "@/lib/backup-service";
import { useAuth } from "@/hooks/use-auth";

/**
 * Hook para gerenciar backup automático
 * - Requer autenticação
 * - Faz backup quando o app entra em background
 * - Faz backup periodicamente (a cada 6 horas)
 * - Fornece status do backup
 */
export function useAutoBackup() {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<BackupStatus | null>(null);

  // Carregar status inicial
  useEffect(() => {
    if (!isAuthenticated) return;
    getBackupStatus().then(setStatus);
  }, [isAuthenticated]);

  // Fazer backup quando app entra em background
  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated]);

  const handleAppStateChange = useCallback(async (state: AppStateStatus) => {
    if (state === "background" && isAuthenticated) {
      console.log("📱 App em background, iniciando backup automático...");
      const success = await performAutoBackup();
      if (success) {
        const newStatus = await getBackupStatus();
        setStatus(newStatus);
      }
    }
  }, [isAuthenticated]);

  // Verificar backup periodicamente (a cada 30 minutos) - apenas se autenticado
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(async () => {
      const success = await performAutoBackup();
      if (success) {
        const newStatus = await getBackupStatus();
        setStatus(newStatus);
      }
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return { status, refresh: () => getBackupStatus().then(setStatus) };
}
