import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { startOAuthLogin, type OAuthProviderHint } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";

export default function LoginScreen() {
  const colors = useColors();
  const { user, loading: authLoading, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (provider?: OAuthProviderHint) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("[Login] Starting OAuth login...", provider ?? "default");
      await startOAuthLogin(provider);
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

          {authLoading ? (
            <View className="rounded-lg p-4 items-center justify-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : user ? (
            <View className="gap-3">
              <View className="rounded-lg p-4 border border-border bg-surface">
                <Text className="text-sm text-muted">Conectado como</Text>
                <Text className="text-base font-semibold text-foreground">
                  {user.name || user.email || user.openId}
                </Text>
              </View>
              <Pressable
                onPress={logout}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.error,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="rounded-lg p-4 items-center justify-center"
              >
                <Text className="text-base font-semibold text-background">Sair</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              <Pressable
                onPress={() => handleLogin("google")}
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
                    Continuar com Google
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => handleLogin("facebook")}
                disabled={isLoading}
                style={({ pressed }) => [
                  {
                    backgroundColor: "#1877F2",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="rounded-lg p-4 items-center justify-center"
              >
                <Text className="text-base font-semibold text-background">
                  Continuar com Facebook
                </Text>
              </Pressable>
            </View>
          )}

          {/* Info */}
          <Text className="text-xs text-muted text-center">
            Você pode usar o app sem fazer login, mas a sincronização e backup automático requerem autenticação.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
