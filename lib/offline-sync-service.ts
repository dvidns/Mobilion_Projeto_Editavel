import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

const SYNC_QUEUE_KEY = "@montafacil:sync_queue";
const LAST_SYNC_KEY = "@montafacil:last_sync";

export interface SyncItem {
  id: string;
  type: "agendamento" | "cliente" | "orcamento";
  action: "create" | "update" | "delete";
  data: any;
  timestamp: number;
}

/**
 * Adicionar item à fila de sincronização
 */
export async function addToSyncQueue(item: SyncItem) {
  try {
    const queue = await getSyncQueue();
    queue.push(item);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    console.log("📝 Item adicionado à fila de sincronização:", item.type);
  } catch (err) {
    console.error("❌ Erro ao adicionar à fila:", err);
  }
}

/**
 * Obter fila de sincronização
 */
export async function getSyncQueue(): Promise<SyncItem[]> {
  try {
    const queue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch {
    return [];
  }
}

/**
 * Sincronizar dados com servidor
 */
export async function syncWithServer() {
  try {
    // Verificar conexão
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      console.log("📴 Sem conexão. Dados serão sincronizados quando voltar.");
      return false;
    }

    console.log("🔄 Iniciando sincronização com servidor...");

    const queue = await getSyncQueue();
    if (queue.length === 0) {
      console.log("✓ Nada para sincronizar");
      return true;
    }

    // Simular envio para servidor
    // Em produção, isso faria requisições HTTP reais
    for (const item of queue) {
      console.log(`📤 Sincronizando ${item.type}:`, item.action);

      // Simular delay de rede
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Aqui você faria a requisição HTTP real
      // await api.post('/sync', item);
    }

    // Limpar fila após sincronização bem-sucedida
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]));
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

    console.log("✅ Sincronização concluída com sucesso");
    return true;
  } catch (err) {
    console.error("❌ Erro ao sincronizar:", err);
    return false;
  }
}

/**
 * Obter status de sincronização
 */
export async function getSyncStatus() {
  try {
    const queue = await getSyncQueue();
    const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
    const state = await NetInfo.fetch();

    return {
      pendingItems: queue.length,
      lastSync: lastSync ? new Date(lastSync) : null,
      isOnline: state.isConnected ?? false,
      isSyncing: false,
    };
  } catch {
    return {
      pendingItems: 0,
      lastSync: null,
      isOnline: false,
      isSyncing: false,
    };
  }
}

/**
 * Monitorar conexão e sincronizar quando voltar online
 */
export function startOfflineSyncMonitor() {
  const unsubscribe = NetInfo.addEventListener(async (state: any) => {
    if (state.isConnected && state.isConnected === true) {
      console.log("🌐 Conexão restaurada! Sincronizando dados...");
      await syncWithServer();
    } else {
      console.log("📴 Conexão perdida. Modo offline ativado.");
    }
  });

  return unsubscribe;
}

/**
 * Sincronizar periodicamente (a cada 5 minutos se online)
 */
export function startPeriodicSync() {
  const interval = setInterval(async () => {
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      console.log("⏰ Sincronização periódica");
      await syncWithServer();
    }
  }, 5 * 60 * 1000);

  return () => clearInterval(interval);
}
