import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";
import type { UpdateStatus } from "@/lib/update-service";

interface UpdateFloatingButtonProps {
  updateStatus: UpdateStatus | null;
  isDownloading: boolean;
  onDownload: () => void;
}

export function UpdateFloatingButton({
  updateStatus,
  isDownloading,
  onDownload,
}: UpdateFloatingButtonProps) {
  const colors = useColors();

  // Não mostrar se não há atualização disponível
  if (!updateStatus?.isAvailable) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.primary }]}
      onPress={onDownload}
      activeOpacity={0.8}
      disabled={isDownloading}
    >
      <View style={styles.content}>
        {isDownloading ? (
          <>
            <ActivityIndicator size={20} color="#fff" />
            <Text style={styles.text}>Baixando...</Text>
          </>
        ) : (
          <>
            <MaterialIcons name="cloud-download" size={20} color="#fff" />
            <Text style={styles.text}>Atualizar</Text>
          </>
        )}
      </View>

      {/* Badge com versão */}
      {updateStatus.newVersion && (
        <View style={[styles.badge, { backgroundColor: "#fff" }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>
            v{updateStatus.newVersion}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 80,
    right: 16,
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
