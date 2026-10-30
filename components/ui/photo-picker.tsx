import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useColors } from "@/hooks/use-colors";

interface PhotoPickerProps {
  onPhotoSelected: (uri: string) => void;
  currentPhotoUri?: string;
  label?: string;
}

export function PhotoPicker({ onPhotoSelected, currentPhotoUri, label = "Foto do Móvel" }: PhotoPickerProps) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    try {
      setLoading(true);

      // Solicitar permissão
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão Negada", "Precisamos de acesso à sua galeria de fotos.");
        return;
      }

      // Abrir picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        onPhotoSelected(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert("Erro", "Não foi possível selecionar a foto.");
      console.error("Erro ao selecionar foto:", err);
    } finally {
      setLoading(false);
    }
  }

  async function takePhoto() {
    try {
      setLoading(true);

      // Solicitar permissão
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão Negada", "Precisamos de acesso à câmera do seu celular.");
        return;
      }

      // Abrir câmera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        onPhotoSelected(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert("Erro", "Não foi possível tirar a foto.");
      console.error("Erro ao tirar foto:", err);
    } finally {
      setLoading(false);
    }
  }

  function removePhoto() {
    Alert.alert("Remover Foto?", "Tem certeza que quer remover a foto?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => onPhotoSelected(""),
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>

      {currentPhotoUri ? (
        <View style={[styles.photoContainer, { borderColor: colors.border }]}>
          <Image source={{ uri: currentPhotoUri }} style={styles.photo} />
          <View style={styles.photoActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={takePhoto}
              disabled={loading}
            >
              <MaterialIcons name="camera-alt" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Tirar Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.error }]}
              onPress={removePhoto}
              disabled={loading}
            >
              <MaterialIcons name="delete" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Remover</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="image-not-supported" size={40} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>Nenhuma foto adicionada</Text>
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={takePhoto}
              disabled={loading}
            >
              <MaterialIcons name="camera-alt" size={20} color="#fff" />
              <Text style={styles.buttonText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, flex: 1, marginLeft: 8 }]}
              onPress={pickImage}
              disabled={loading}
            >
              <MaterialIcons name="photo-library" size={20} color="#fff" />
              <Text style={styles.buttonText}>Galeria</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  photoContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    gap: 8,
  },
  photo: {
    width: "100%",
    height: 200,
  },
  photoActions: {
    flexDirection: "row",
    gap: 8,
    padding: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    paddingHorizontal: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
