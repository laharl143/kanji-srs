import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Card } from "@/components/ui";
import type { Reading, SubjectType } from "@/lib/types";

// A titled card for one part of a lesson or item page (spec 0004 AC-6, spec 0009 AC-1).
export function Section({
  title,
  children,
  testID,
}: {
  title: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID}>
      <Card>
        <Text accessibilityRole="header" className="text-sm font-bold uppercase text-muted">
          {title}
        </Text>
        {children}
      </Card>
    </View>
  );
}

export function Mnemonic({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <View className="mt-1 rounded-md border-l-4 border-primary bg-bg px-3 py-2">
      <Text className="text-base leading-6 text-text">{text}</Text>
    </View>
  );
}

// Your own note, read only, under the mnemonic it overrides (spec 0009 AC-7).
export function NoteText({ label, text }: { label: string; text: string | null | undefined }) {
  if (!text) return null;
  return (
    <View className="mt-1 gap-1 rounded-md border-l-4 border-vocab bg-bg px-3 py-2">
      <Text className="text-sm font-bold text-muted">{label}</Text>
      <Text className="text-base leading-6 text-text">{text}</Text>
    </View>
  );
}

/**
 * Kanji readings grouped by kind, primary ones highlighted; vocab readings in a row. `aside`
 * sits after the vocab readings (the speak button, spec 0009 AC-10).
 */
export function Readings({
  type,
  readings,
  aside,
}: {
  type: Exclude<SubjectType, "radical">;
  readings: Reading[];
  aside?: ReactNode;
}) {
  const groups =
    type === "kanji"
      ? [
          { label: "On'yomi", items: readings.filter((r) => r.kind === "onyomi") },
          { label: "Kun'yomi", items: readings.filter((r) => r.kind === "kunyomi") },
        ].filter((g) => g.items.length > 0)
      : [{ label: "", items: readings }];

  return (
    <View className="gap-2">
      {groups.map((g) => (
        <View key={g.label} className="gap-1">
          {g.label !== "" && <Text className="text-sm text-muted">{g.label}</Text>}
          <View className="flex-row flex-wrap items-center gap-2">
            {g.items.map((r) => (
              <View
                key={r.text}
                accessible
                accessibilityLabel={`${r.text}${r.primary ? ", main reading" : ""}`}
                className={`rounded-md px-3 py-1 ${r.primary ? "bg-primary" : "border border-border"}`}
              >
                <Text className={`font-jp text-lg ${r.primary ? "text-on-primary" : "text-muted"}`}>
                  {r.text}
                </Text>
              </View>
            ))}
            {g.label === "" ? aside : null}
          </View>
        </View>
      ))}
      <Text className="text-sm text-muted">The highlighted reading is the one quizzes accept.</Text>
    </View>
  );
}
