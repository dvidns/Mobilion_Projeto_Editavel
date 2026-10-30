import { Platform, Linking, Alert } from "react-native";

/**
 * Abrir Google Maps com endereço
 */
export async function openMaps(endereco: string): Promise<void> {
  if (!endereco || endereco.trim() === "") {
    Alert.alert("Endereço não disponível", "Por favor, adicione um endereço para abrir no mapa.");
    return;
  }

  try {
    const encodedEndereco = encodeURIComponent(endereco);
    
    if (Platform.OS === "android") {
      const googleUrl = `geo:0,0?q=${encodedEndereco}`;
      const canOpen = await Linking.canOpenURL(googleUrl);
      if (canOpen) {
        await Linking.openURL(googleUrl);
      } else {
        await Linking.openURL(`https://maps.google.com/?q=${encodedEndereco}`);
      }
    } else {
      await Linking.openURL(`https://maps.google.com/?q=${encodedEndereco}`);
    }
  } catch (err) {
    console.error("[Maps] Erro ao abrir mapa:", err);
    Alert.alert("Erro", "Não foi possível abrir o mapa. Tente novamente.");
  }
}

/**
 * Obter URL de visualização do mapa (para web)
 */
export function getMapsUrl(endereco: string): string {
  const encodedEndereco = encodeURIComponent(endereco);
  return `https://maps.google.com/?q=${encodedEndereco}`;
}

/**
 * Obter URL de visualização estática do mapa (para preview)
 */
export function getMapsStaticUrl(endereco: string, width: number = 400, height: number = 300): string {
  const encodedEndereco = encodeURIComponent(endereco);
  // Nota: Esta URL requer API key do Google Maps. Para produção, configure no backend.
  return `https://maps.googleapis.com/maps/api/staticmap?center=${encodedEndereco}&zoom=15&size=${width}x${height}&markers=color:red%7C${encodedEndereco}`;
}
