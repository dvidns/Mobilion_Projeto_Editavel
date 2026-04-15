import { ScreenContainer } from "@/components/screen-container";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("[Login] Starting OAuth login...");
      // OAuth login handled by backend
      setError("OAuth login not yet implemented");
      return;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Login failed";
      console.error("[Login] Error:", errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center gap-8">
          {/* Header */}
          <View className="items-center gap-4">
            <Text className="text-4xl font-bold text-foreground">MontaFácil</Text>
            <Text className="text-base text-muted text-center">
              Sincronize sua agenda e faça backup dos seus dados
            </Text>
          </View>

          {/* Features */}
          <View className="gap-4">
            <View className="flex-row gap-3 items-start">
              <Text className="text-2xl">📅</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">Sincronize Agenda</Text>
                <Text className="text-sm text-muted">
                  Mantenha seus agendamentos sincronizados entre dispositivos
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3 items-start">
              <Text className="text-2xl">💾</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">Backup Automático</Text>
                <Text className="text-sm text-muted">
                  Seus dados estão sempre protegidos na nuvem
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3 items-start">
              <Text className="text-2xl">🔒</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">Seguro</Text>
                <Text className="text-sm text-muted">
                  Acesso seguro com autenticação
                </Text>
              </View>
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View className="bg-error/10 border border-error rounded-lg p-4">
              <Text className="text-error text-sm">{error}</Text>
            </View>
          )}

          {/* Login Button */}
          <Pressable
            onPress={handleLogin}
            disabled={isLoading}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            className="rounded-lg p-4 items-center justify-center"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className="text-base font-semibold text-background">
                Fazer Login para Sincronizar
              </Text>
            )}
          </Pressable>

          {/* Info */}
          <Text className="text-xs text-muted text-center">
            Você pode usar o app sem fazer login, mas a sincronização e backup automático requerem autenticação.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
