import { Platform, Linking, Alert } from "react-native";

/**
 * Abre o Google Maps para rota de navegação curva a curva até o endereço do cliente.
 * No Android, tenta abrir primeiro o app nativo do Google Maps com o intent de navegação direta (`google.navigation:q=...`).
 * Caso indisponível, usa o esquema geográfico (`geo:0,0?q=...`) ou a URL universal HTTPS.
 */
export async function openMaps(endereco: string, options?: { mode?: "driving" | "transit" | "walking" }): Promise<void> {
  const cleanAddress = (endereco || "").trim();
  if (!cleanAddress) {
    Alert.alert("Endereço não disponível", "Por favor, adicione ou selecione um endereço válido para abrir a rota no mapa.");
    return;
  }

  try {
    const encoded = encodeURIComponent(cleanAddress);

    if (Platform.OS === "android") {
      // 1. Tentar intent direto de navegação curva a curva do Google Maps
      const navUrl = `google.navigation:q=${encoded}&mode=${options?.mode ? options.mode[0] : "d"}`;
      const canNav = await Linking.canOpenURL(navUrl);
      if (canNav) {
        await Linking.openURL(navUrl);
        return;
      }

      // 2. Tentar geo search nativo
      const geoUrl = `geo:0,0?q=${encoded}`;
      const canGeo = await Linking.canOpenURL(geoUrl);
      if (canGeo) {
        await Linking.openURL(geoUrl);
        return;
      }
    }

    // 3. Fallback universal HTTPS para Web e iOS/Android
    const universalUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    await Linking.openURL(universalUrl);
  } catch (err) {
    console.error("[MapsService] Erro ao abrir mapa:", err);
    Alert.alert("Erro", "Não foi possível abrir o Google Maps. Verifique se o aplicativo está instalado.");
  }
}

/**
 * Abre uma rota entre um endereço de partida e um de chegada (ex: da oficina Mobilion até o cliente).
 */
export async function openRoute(destino: string, origem?: string): Promise<void> {
  const cleanDest = (destino || "").trim();
  if (!cleanDest) {
    Alert.alert("Destino não informado", "Endereço de destino não informado.");
    return;
  }

  const encodedDest = encodeURIComponent(cleanDest);
  let url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDest}`;

  if (origem && origem.trim()) {
    url += `&origin=${encodeURIComponent(origem.trim())}`;
  }

  try {
    await Linking.openURL(url);
  } catch (err) {
    console.error("[MapsService] Erro ao abrir rota:", err);
    Alert.alert("Erro", "Não foi possível abrir a rota.");
  }
}

/**
 * Retorna a URL universal do Google Maps para visualização no navegador.
 */
export function getMapsUrl(endereco: string): string {
  const encoded = encodeURIComponent((endereco || "").trim());
  return `https://maps.google.com/?q=${encoded}`;
}

/**
 * Avaliação e preparação para API Distance Matrix do Google Cloud.
 * NOTA DE CUSTOS E LIMITES:
 * A Google Maps Distance Matrix API possui custo por requisição (aprox. $0.005 a $0.01 por chamada após o crédito de $200/mês).
 * Para evitar custos desnecessários ao montador, o cálculo estimado pode ser feito via rota offline
 * ou habilitado sob demanda via backend seguro com chave restrita por IP.
 */
export interface DistanceEstimation {
  distanceKm: number;
  durationMinutes: number;
  isEstimate: boolean;
}

export function estimateDistanceRough(origem: string, destino: string): DistanceEstimation {
  // Estimativa baseada em contexto local para visualização prévia sem custo de API
  return {
    distanceKm: 0,
    durationMinutes: 0,
    isEstimate: true,
  };
}
