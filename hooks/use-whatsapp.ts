import { useCallback, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import { getWhatsAppTipo } from "@/lib/store";

export function useWhatsApp() {
  const [loading, setLoading] = useState(false);

  const enviar = useCallback(async (clienteTelefone: string, mensagem: string) => {
    setLoading(true);
    try {
      if (!clienteTelefone) {
        Alert.alert("Erro", "Número do cliente não disponível.");
        setLoading(false);
        return;
      }

      const tel = clienteTelefone.replace(/\D/g, "");
      const telFull = tel.startsWith("55") ? tel : `55${tel}`;
      const encoded = encodeURIComponent(mensagem);

      const tipo = await getWhatsAppTipo();

      if (Platform.OS === "android") {
        if (tipo === "business") {
          // Tenta abrir o WhatsApp Business primeiro
          try {
            await Linking.openURL(`whatsapp-business://send?phone=${telFull}&text=${encoded}`);
            setLoading(false);
            return;
          } catch {
            // Fallback para wa.me se o app Business não estiver instalado
          }
        } else {
          // WhatsApp normal
          try {
            await Linking.openURL(`whatsapp://send?phone=${telFull}&text=${encoded}`);
            setLoading(false);
            return;
          } catch {
            // Fallback para wa.me
          }
        }
      }

      const waUrl = `https://wa.me/${telFull}?text=${encoded}`;
      await Linking.openURL(waUrl);
      setLoading(false);
    } catch {
      Alert.alert("Erro", "WhatsApp não está instalado ou não foi possível abrir.");
      setLoading(false);
    }
  }, []);

  return { enviar, loading };
}
