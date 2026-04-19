import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert, ScrollView, Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useColors } from "@/hooks/use-colors";

interface MultiPhotoPickerProps {
  fotos: string[];
  onFotosChange?: (fotos: string[]) => void;
  label?: string;
  readonly?: boolean;
}

export function MultiPhotoPicker({
  fotos,
  onFotosChange,
  label = "Fotos dos Móveis",
  readonly = false,
}: MultiPhotoPickerProps) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  async function adicionarDaGaleria() {
    try {
      setLoading(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão Negada", "Precisamos de acesso à sua galeria de fotos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets.length > 0) {
        const novasUris = result.assets.map((a) => a.uri);
        onFotosChange?.([...fotos, ...novasUris]);
      }
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      if (msg.toLowerCase().includes("permission")) {
        Alert.alert("Permissão Negada", "Acesso à galeria foi negado.");
      } else {
        Alert.alert("Erro", "Não foi possível selecionar a foto. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function tirarFoto() {
    try {
      setLoading(true);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão Negada", "Precisamos de acesso à câmera do seu celular.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        onFotosChange?.([...fotos, result.assets[0].uri]);
      }
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      if (msg.toLowerCase().includes("permission")) {
        Alert.alert("Permissão Negada", "Acesso à câmera foi negado.");
      } else {
        Alert.alert("Erro", "Não foi possível tirar a foto. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  function removerFoto(index: number) {
    Alert.alert("Remover Foto", "Deseja remover esta foto?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => onFotosChange?.(fotos.filter((_, i) => i !== index)),
      },
    ]);
  }

  function abrirOpcoes() {
    Alert.alert("Adicionar Foto", "Escolha a origem", [
      { text: "Câmera", onPress: tirarFoto },
      { text: "Galeria", onPress: adicionarDaGaleria },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        {!readonly && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={abrirOpcoes}
            disabled={loading}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add-a-photo" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Adicionar</Text>
          </TouchableOpacity>
        )}
      </View>

      {fotos.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="photo-camera" size={32} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {readonly ? "Nenhuma foto registrada" : "Adicione fotos dos móveis"}
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fotosRow}>
          {fotos.map((uri, index) => (
            <TouchableOpacity
              key={`${uri}-${index}`}
              style={[styles.fotoThumb, { borderColor: colors.border }]}
              onPress={() => setFotoAmpliada(uri)}
              activeOpacity={0.85}
            >
              <Image source={{ uri }} style={styles.thumbImg} />
              {!readonly && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removerFoto(index)}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <MaterialIcons name="cancel" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Modal foto ampliada */}
      <Modal
        visible={!!fotoAmpliada}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoAmpliada(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFotoAmpliada(null)}
        >
          {fotoAmpliada && (
            <Image
              source={{ uri: fotoAmpliada }}
              style={styles.fotoAmpliada}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
  },
  fotosRow: {
    gap: 8,
    paddingVertical: 4,
  },
  fotoThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  removeBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  fotoAmpliada: {
    width: "95%",
    height: "75%",
    borderRadius: 12,
  },
});
