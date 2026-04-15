import { useEffect, useState } from "react";
import {
  startOfflineSyncMonitor,
  startPeriodicSync,
  getSyncStatus,
  syncWithServer,
  type SyncItem,
} from "@/lib/offline-sync-service";
import { useAuth } from "@/hooks/use-auth";

export interface OfflineSyncStatus {
  pendingItems: number;
  lastSync: Date | null;
  isOnline: boolean;
  isSyncing: boolean;
}

/**
 * Hook para gerenciar sincronização offline
 * - Requer autenticação
 * - Monitora conexão de internet
 * - Sincroniza automaticamente quando volta online
 * - Sincroniza periodicamente se online
 */
export function useOfflineSync() {
  const { isAuthenticated } = useAuth();
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>({
    pendingItems: 0,
    lastSync: null,
    isOnline: false,
    isSyncing: false,
  });

  // Inicializar monitoramento de conexão e sincronização periódica
  useEffect(() => {
    if (!isAuthenticated) {
      console.log("ℹ️ Sincronização desabilitada - usuário não autenticado");
      return;
    }

    console.log("📡 Inicializando sincronização offline...");

    // Monitorar conexão
    const unsubscribeMonitor = startOfflineSyncMonitor();

    // Sincronizar periodicamente
    const unsubscribePeriodic = startPeriodicSync();

    // Atualizar status inicial
    updateStatus();

    return () => {
      unsubscribeMonitor?.();
      unsubscribePeriodic?.();
    };
  }, [isAuthenticated]);

  // Atualizar status de sincronização
  const updateStatus = async () => {
    if (!isAuthenticated) return;
    const status = await getSyncStatus();
    setSyncStatus(status);
  };

  // Sincronizar manualmente
  const manualSync = async () => {
    if (!isAuthenticated) {
      console.log("❌ Sincronização requer autenticação");
      return;
    }

    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
    try {
      await syncWithServer();
      await updateStatus();
    } finally {
      setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
    }
  };

  return {
    syncStatus,
    updateStatus,
    manualSync,
  };
}
