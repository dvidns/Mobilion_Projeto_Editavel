import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, Image } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";
import { useGoogleAuth } from "@/hooks/use-google-auth";

export default function LoginScreen() {
  const colors = useColors();
  const {
    isAuthenticated: isGoogleAuth,
    user: googleUser,
    loading: googleLoading,
    signIn: signInGoogle,
    signOut: signOutGoogle,
    error: googleError,
  } = useGoogleAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const success = await signInGoogle();
      if (!success && googleError) {
        setErrorMessage(googleError);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao conectar com o Google";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const activeError = errorMessage || googleError;

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center gap-8 py-6">
          {/* Header */}
          <View className="items-center gap-2">
            <Text className="text-4xl font-bold text-foreground">Mobilion</Text>
            <Text className="text-base font-medium text-primary">Assistente do Montador</Text>
            <Text className="text-sm text-muted text-center max-w-xs mt-1">
              Conecte sua conta Google corporativa para sincronizar Agenda, Contatos e Backups.
            </Text>
          </View>

          {/* Features integradas com Google */}
          <View className="gap-4 bg-surface p-4 rounded-xl border border-border">
            <View className="flex-row gap-3 items-center">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                <MaterialIcons name="event" size={22} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">Google Agenda</Text>
                <Text className="text-xs text-muted">
                  Calendário "Mobilion — Atendimentos" com montagem e retorno
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3 items-center">
              <View className="w-10 h-10 rounded-full bg-success/10 items-center justify-center">
                <MaterialIcons name="contacts" size={22} color="#34A853" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">Google Contatos</Text>
                <Text className="text-xs text-muted">
                  Importação direta de clientes sem duplicidades
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3 items-center">
              <View className="w-10 h-10 rounded-full bg-accent/10 items-center justify-center">
                <MaterialIcons name="cloud-upload" size={22} color="#FBBC04" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">Google Drive</Text>
                <Text className="text-xs text-muted">
                  Armazenamento seguro de backups JSON e PDFs de ordens
                </Text>
              </View>
            </View>
          </View>

          {/* Erro */}
          {activeError && (
            <View className="bg-error/10 border border-error rounded-lg p-3">
              <Text className="text-error text-xs">{activeError}</Text>
            </View>
          )}

          {/* Card de Sessão ou Ação */}
          {googleLoading ? (
            <View className="rounded-lg p-4 items-center justify-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : isGoogleAuth && googleUser ? (
            <View className="gap-4">
              <View className="rounded-xl p-4 border border-border bg-surface flex-row items-center gap-3">
                {googleUser.picture ? (
                  <Image
                    source={{ uri: googleUser.picture }}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                    <Text className="text-lg font-bold text-primary">
                      {googleUser.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-xs text-success font-semibold">Conta Google Conectada</Text>
                  <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                    {googleUser.name}
                  </Text>
                  <Text className="text-xs text-muted" numberOfLines={1}>
                    {googleUser.email}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={signOutGoogle}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.error,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="rounded-lg p-3.5 items-center justify-center"
              >
                <Text className="text-sm font-semibold text-background">Desconectar do Google</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              <Pressable
                onPress={handleGoogleLogin}
                disabled={isLoading}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                className="rounded-xl p-4 flex-row items-center justify-center gap-3 shadow-sm"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="login" size={22} color="#FFFFFF" />
                    <Text className="text-base font-semibold text-white">
                      Conectar com Conta Google
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Rodapé informativo */}
          <Text className="text-xs text-muted text-center px-4">
            A conta recomendada para este app é <Text className="font-semibold text-foreground">atendimento.mobilio@gmail.com</Text>. O app continuará funcionando normalmente em modo offline mesmo se não estiver conectado.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
