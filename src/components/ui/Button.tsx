import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

import type { Palette } from "@/theme/colors";
import { usePalette } from "@/theme/use-palette";

type Variant = "primary" | "secondary" | "danger";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  // For Maestro flows (spec 0004).
  testID?: string;
};

const containerClasses: Record<Variant, string> = {
  primary: "bg-primary",
  secondary: "border border-primary bg-surface",
  danger: "bg-wrong",
};

const labelClasses: Record<Variant, string> = {
  primary: "text-on-primary",
  secondary: "text-primary",
  danger: "text-on-wrong",
};

function tintFor(variant: Variant, palette: Palette): string {
  if (variant === "primary") return palette["on-primary"];
  if (variant === "secondary") return palette.primary;
  return palette["on-wrong"];
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  testID,
}: ButtonProps) {
  const tint = tintFor(variant, usePalette());
  const inactive = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-md px-4 active:opacity-85 ${containerClasses[variant]} ${disabled ? "opacity-40" : ""}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        icon && <MaterialCommunityIcons name={icon} size={20} color={tint} />
      )}
      <Text className={`text-base font-medium ${labelClasses[variant]}`}>{label}</Text>
    </Pressable>
  );
}
