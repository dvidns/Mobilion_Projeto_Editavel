import { useCallback, useState } from "react";
import { Alert, Linking, Platform } from "react-native";

/**
 * Hook para gerenciar envios de WhatsApp.
 * Tenta abrir WhatsApp Business direto, sem verificação prévia.
 * Se falhar, oferece opção de tentar com Normal.
 */
export function useWhatsApp() {
  const [loading, setLoading] = useState(false);

  // Enviar mensagem via WhatsApp Business
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
      
      // Tentar abrir WhatsApp Business via wa.me
      const waUrl = `https://wa.me/${telFull}?text=${encoded}`;
      
      try {
        await Linking.openURL(waUrl);
        setLoading(false);
        return;
      } catch (err) {
        // Se wa.me falhar, tentar intent específico do Business
        if (Platform.OS === "android") {
          try {
            const businessIntent = `intent://send?phone=${telFull}&text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
            await Linking.openURL(businessIntent);
            setLoading(false);
            return;
          } catch (err2) {
            // Se Business falhar, oferecer tentar Normal
            Alert.alert(
              "WhatsApp Business não encontrado",
              "Deseja tentar com WhatsApp Normal?",
              [
                {
                  text: "Cancelar",
                  onPress: () => setLoading(false),
                  style: "cancel",
                },
                {
                  text: "Tentar com Normal",
                  onPress: async () => {
                    try {
                      const normalIntent = `intent://send?phone=${telFull}&text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
                      await Linking.openURL(normalIntent);
                      setLoading(false);
                    } catch (err3) {
                      Alert.alert("Erro", "WhatsApp não está instalado.");
                      setLoading(false);
                    }
                  },
                },
              ]
            );
            return;
          }
        }
        
        // No iOS, se wa.me falhar, mostrar erro
        Alert.alert("Erro", "WhatsApp não está instalado ou não foi possível abrir.");
        setLoading(false);
      }
    } catch (err) {
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.");
      setLoading(false);
    }
  }, []);

  return { enviar, loading };
}
