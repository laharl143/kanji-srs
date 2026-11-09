import { Pressable, Switch, Text } from "react-native";

import { usePalette } from "@/theme/use-palette";

// A labeled switch; the whole row toggles it (spec 0010 AC-3).
export function SwitchRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      className="min-h-12 flex-row items-center gap-3 active:opacity-85"
    >
      <Text className="flex-1 text-base text-text">{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: palette.border, true: palette.primary }}
        thumbColor={palette.surface}
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}
