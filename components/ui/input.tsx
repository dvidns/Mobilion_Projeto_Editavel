import { TextInput, Text, View, StyleSheet, TextInputProps } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  const colors = useColors();
  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.border,
            color: colors.foreground,
          },
          style,
        ]}
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        {...props}
      />
      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    lineHeight: 20,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
});
