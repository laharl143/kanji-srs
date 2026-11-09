import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Pressable, Text } from "react-native";

import { now } from "@/lib/clock";
import { fromHHMM, toHHMM } from "@/lib/study/settings";

// The stored HH:MM in the phone's locale format, e.g. "8:00 AM" or "08:00".
export function formatTime(text: string): string {
  return fromHHMM(text, now()).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * A time row (spec 0010 AC-3). When enabled, a tap opens Android's own time dialog set to the
 * stored time; OK saves it as HH:MM, and Cancel, back, or a tap outside saves nothing. The
 * dialog follows the phone's own 12 or 24 hour setting (`is24Hour` left unset). Greyed and
 * inert while disabled.
 */
export function TimeRow({
  label,
  value,
  disabled = false,
  onChange,
  testID,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  testID?: string;
}) {
  const shown = formatTime(value);
  const open = () =>
    DateTimePickerAndroid.open({
      mode: "time",
      value: fromHHMM(value, now()),
      onChange: (event, date) => {
        if (event.type === "set" && date) onChange(toHHMM(date));
      },
    });

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${shown}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={open}
      className={`min-h-12 flex-row items-center gap-3 active:opacity-85 ${disabled ? "opacity-40" : ""}`}
    >
      <Text className="flex-1 text-base text-text">{label}</Text>
      <Text className="text-base font-medium text-primary">{shown}</Text>
    </Pressable>
  );
}
