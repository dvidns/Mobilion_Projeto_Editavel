import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { useColors } from "@/hooks/use-colors";
import { useEffect } from "react";

export default function OfflineStatusScreen() {
  const colors = useColors();
  const { syncStatus, updateStatus, manualSync } = useOfflineSync();

  // Atualizar status a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, [updateStatus]);

  const getStatusColor = () => {
    if (syncStatus.isSyncing) return colors.warning;
    if (syncStatus.isOnline) return colors.success;
    return colors.error;
  };

  const getStatusIcon = () => {
    if (syncStatus.isSyncing) return "cloud-sync";
    if (syncStatus.isOnline) return "cloud-done";
    return "cloud-off";
  };

  const getStatusText = () => {
    if (syncStatus.isSyncing) return "Sincronizando...";
    if (syncStatus.isOnline) return "Online";
    return "Offline";
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">
            Status de Sincronização
          </Text>
          <Text className="text-base text-muted">
            Visualize o status da sincronização de dados
          </Text>
        </View>

        {/* Status Card */}
        <View
          className="bg-surface rounded-2xl p-6 mb-6 border"
          style={{ borderColor: getStatusColor() }}
        >
          <View className="flex-row items-center gap-4 mb-4">
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: getStatusColor() + "20" }}
            >
              <MaterialIcons
                name={getStatusIcon() as any}
                size={32}
                color={getStatusColor()}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-muted mb-1">Conexão</Text>
              <Text className="text-2xl font-bold text-foreground">
                {getStatusText()}
              </Text>
            </View>
          </View>

          {syncStatus.lastSync && (
            <Text className="text-xs text-muted">
              Última sincronização: {syncStatus.lastSync.toLocaleString("pt-BR")}
            </Text>
          )}
        </View>

        {/* Pending Items */}
        <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                <MaterialIcons name="schedule" size={20} color={colors.primary} />
              </View>
              <View>
                <Text className="text-sm text-muted">Pendentes</Text>
                <Text className="text-2xl font-bold text-foreground">
                  {syncStatus.pendingItems}
                </Text>
              </View>
            </View>
            {syncStatus.pendingItems > 0 && (
              <View className="bg-warning px-3 py-1 rounded-full">
                <Text className="text-xs font-bold text-white">
                  Aguardando
                </Text>
              </View>
            )}
          </View>

          {syncStatus.pendingItems > 0 && (
            <Text className="text-xs text-muted">
              Esses itens serão sincronizados quando a conexão voltar
            </Text>
          )}
        </View>

        {/* Manual Sync Button */}
        <TouchableOpacity
          className="bg-primary rounded-2xl p-4 mb-6 flex-row items-center justify-center gap-3"
          onPress={manualSync}
          disabled={syncStatus.isSyncing || !syncStatus.isOnline}
          activeOpacity={0.8}
        >
          {syncStatus.isSyncing ? (
            <>
              <ActivityIndicator size={20} color="#fff" />
              <Text className="text-white font-bold">Sincronizando...</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="cloud-upload" size={20} color="#fff" />
              <Text className="text-white font-bold">Sincronizar Agora</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info Box */}
        <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
          <View className="flex-row gap-3 mb-3">
            <MaterialIcons name="info" size={20} color={colors.primary} />
            <Text className="flex-1 text-sm font-bold text-foreground">
              Como funciona
            </Text>
          </View>
          <Text className="text-xs text-muted leading-relaxed">
            • Todos os dados são salvos localmente no celular{"\n"}
            • Quando offline, mudanças ficam na fila{"\n"}
            • Ao voltar online, sincroniza automaticamente{"\n"}
            • Você pode sincronizar manualmente a qualquer hora
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
