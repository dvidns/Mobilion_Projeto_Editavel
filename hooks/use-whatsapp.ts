import { useCallback, useState } from "react";
import { Alert, Linking, Platform } from "react-native";

/**
 * Hook para gerenciar envios de WhatsApp.
 * No Android, prioriza o esquema nativo do WhatsApp para permitir
 * que o sistema pergunte qual app abrir (quando houver mais de um).
 * Se falhar, usa wa.me como fallback.
 */
export function useWhatsApp() {
  const [loading, setLoading] = useState(false);

  // Enviar mensagem via WhatsApp
  const enviar = useCallback(async (clienteTelefone: string, mensagem: string) => {
    setLoading(true);
    try {
      if (!clienteTelefone) {
        Alert.alert("Erro", "Número do cliente não disponível.");
        setLoading(false);
        return;
      }

      // Usar o número do cliente
      const tel = clienteTelefone.replace(/\D/g, "");
      const telFull = tel.startsWith("55") ? tel : `55${tel}`;
      
      // Codificar mensagem
      const encoded = encodeURIComponent(mensagem);
      
      if (Platform.OS === "android") {
        // Em Android, este esquema costuma disparar o seletor de app
        // (WhatsApp / WhatsApp Business) quando aplicável.
        const whatsappSchemeUrl = `whatsapp://send?phone=${telFull}&text=${encoded}`;
        try {
          await Linking.openURL(whatsappSchemeUrl);
          setLoading(false);
          return;
        } catch {
          // Fallback para link web caso o esquema nativo não esteja disponível.
        }
      }

      const waUrl = `https://wa.me/${telFull}?text=${encoded}`;
      await Linking.openURL(waUrl);
      setLoading(false);
      return;
    } catch (err) {
      Alert.alert("Erro", "WhatsApp não está instalado ou não foi possível abrir.");
      setLoading(false);
    }
  }, []);

  return { enviar, loading };
}
