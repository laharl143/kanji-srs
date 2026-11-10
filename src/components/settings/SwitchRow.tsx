import { Pressable, Switch, Text, View } from "react-native";

import { usePalette } from "@/theme/use-palette";

// A labeled switch; the whole row toggles it (spec 0010 AC-3). An optional subtitle sits under
// the label (spec 0012 AC-1) and is read with it.
export function SwitchRow({
  label,
  subtitle,
  value,
  onChange,
  testID,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      className="min-h-12 flex-row items-center gap-3 active:opacity-85"
    >
      <View className="flex-1 gap-0.5 py-1">
        <Text className="text-base text-text">{label}</Text>
        {subtitle ? <Text className="text-sm text-muted">{subtitle}</Text> : null}
      </View>
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
