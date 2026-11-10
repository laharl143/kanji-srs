import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Mnemonic, NoteText } from "@/components/subject/Section";
import { usePalette } from "@/theme/use-palette";

import type { DetailPart } from "./quiz-details";

// "Show details" (spec 0009 AC-7, spec 0012 AC-4): a collapsed toggle over the mnemonics and your
// notes. Mount it fresh per question so it starts collapsed; it hides when there is nothing.
export function ShowDetails({ parts }: { parts: DetailPart[] }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  if (parts.length === 0) return null;
  return (
    <View className="gap-2">
      <Pressable
        testID="show-details"
        accessibilityRole="button"
        accessibilityLabel={open ? "Hide details" : "Show details"}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        className="min-h-12 flex-row items-center gap-2 active:opacity-85"
      >
        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={palette.primary}
        />
        <Text className="text-base font-bold text-primary">
          {open ? "Hide details" : "Show details"}
        </Text>
      </Pressable>
      {open && (
        <View testID="quiz-details" className="gap-2">
          {parts.map((p) => (
            <View key={p.noteLabel} className="gap-2">
              <Mnemonic text={p.mnemonic} />
              <NoteText label={p.noteLabel} text={p.note} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
