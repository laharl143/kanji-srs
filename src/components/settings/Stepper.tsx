import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLayoutEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";

import { usePalette } from "@/theme/use-palette";

type StepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  // Labels for scripted checks, e.g. "Fewer lessons per batch".
  decreaseLabel: string;
  increaseLabel: string;
  // Read with the value, e.g. "Lessons per batch" gives "Lessons per batch, 5".
  valueLabel: string;
  testID?: string;
};

// Minus, value, plus (spec 0010 AC-2, AC-5). Each tap moves the value by 1 within min and max.
export function Stepper({
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  valueLabel,
  testID,
}: StepperProps) {
  // Taps can land before the next render, so step from the last value sent, not the rendered one
  // (AC-4). Each commit resets it to the prop, which also follows a rolled back save.
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  });
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, latest.current + delta));
    if (next === latest.current) return;
    latest.current = next;
    onChange(next);
  };
  return (
    <View className="flex-row items-center gap-2">
      <StepButton
        icon="minus"
        label={decreaseLabel}
        disabled={value <= min}
        testID={testID && `${testID}-minus`}
        onPress={() => step(-1)}
      />
      <Text
        testID={testID && `${testID}-value`}
        accessibilityLabel={`${valueLabel}, ${value}`}
        className="min-w-12 text-center text-2xl font-bold text-text"
      >
        {value}
      </Text>
      <StepButton
        icon="plus"
        label={increaseLabel}
        disabled={value >= max}
        testID={testID && `${testID}-plus`}
        onPress={() => step(1)}
      />
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  testID,
  onPress,
}: {
  icon: "minus" | "plus";
  label: string;
  disabled: boolean;
  testID?: string;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`h-12 w-12 items-center justify-center rounded-md border border-primary bg-surface active:opacity-85 ${disabled ? "opacity-40" : ""}`}
    >
      <MaterialCommunityIcons name={icon} size={24} color={palette.primary} />
    </Pressable>
  );
}
