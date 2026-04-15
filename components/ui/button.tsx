import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: object;
}

export function Button({ title, onPress, variant = "primary", loading, disabled, icon, style }: ButtonProps) {
  const colors = useColors();

  const bgColor =
    variant === "primary" ? colors.primary :
    variant === "secondary" ? colors.surface :
    variant === "danger" ? colors.error :
    "transparent";

  const textColor =
    variant === "primary" ? "#FFFFFF" :
    variant === "secondary" ? colors.foreground :
    variant === "danger" ? "#FFFFFF" :
    colors.primary;

  const borderColor =
    variant === "secondary" ? colors.border :
    variant === "ghost" ? "transparent" :
    "transparent";

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bgColor, borderColor, borderWidth: variant === "secondary" ? 1 : 0 },
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.row}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={[styles.text, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconWrap: {
    marginRight: 2,
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
});
