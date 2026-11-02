import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Card, SubjectChip } from "@/components/ui";
import { primaryMeaning } from "@/lib/subjects";
import type { LessonItem } from "@/lib/study/lessons";
import type { Reading } from "@/lib/types";

import { subjectBg, subjectLabel } from "./subject-style";

// One lesson item (spec 0004 AC-6): characters, meanings, readings, components, and mnemonics.
export function LessonPage({ item }: { item: LessonItem }) {
  const { subject, components } = item;
  const meaning = primaryMeaning(subject.meanings);
  const others = subject.meanings.filter((m) => m.text !== meaning).map((m) => m.text);

  return (
    <View className="gap-4">
      <View
        className={`items-center gap-1 rounded-lg px-4 py-6 ${subjectBg[subject.type]}`}
        accessible
        accessibilityLabel={`${subjectLabel[subject.type]} ${subject.characters}, ${meaning}`}
      >
        <Text maxFontSizeMultiplier={1.3} className="text-sm font-bold uppercase text-white/90">
          {subjectLabel[subject.type]}
        </Text>
        <Text
          testID="lesson-characters"
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.2}
          className="font-jp text-[72px] leading-[96px] text-white"
        >
          {subject.characters}
        </Text>
        <Text className="text-center text-2xl font-bold text-white">{meaning}</Text>
      </View>

      <Section title={subject.type === "radical" ? "Name" : "Meaning"}>
        <Text className="text-xl font-bold text-text">{meaning}</Text>
        {others.length > 0 && (
          <Text className="text-base text-muted">Also accepted: {others.join(", ")}</Text>
        )}
        <Mnemonic text={subject.meaningMnemonic} />
      </Section>

      {subject.type !== "radical" && (
        <Section title="Reading">
          <Readings type={subject.type} readings={subject.readings} />
          {subject.readingMnemonic ? <Mnemonic text={subject.readingMnemonic} /> : null}
        </Section>
      )}

      {components.length > 0 && (
        <Section title={subject.type === "kanji" ? "Radicals in this kanji" : "Kanji in this word"}>
          <View className="gap-3">
            {components.map((c) => (
              <View key={c.id} className="flex-row items-center gap-3">
                <SubjectChip
                  size="sm"
                  subject={{
                    id: c.id,
                    type: c.type,
                    characters: c.characters,
                    meaning: primaryMeaning(c.meanings),
                  }}
                />
                <Text className="flex-1 text-base text-text">{primaryMeaning(c.meanings)}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <Text accessibilityRole="header" className="text-sm font-bold uppercase text-muted">
        {title}
      </Text>
      {children}
    </Card>
  );
}

function Mnemonic({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View className="mt-1 rounded-md border-l-4 border-primary bg-bg px-3 py-2">
      <Text className="text-base leading-6 text-text">{text}</Text>
    </View>
  );
}

// Kanji readings grouped by kind, primary ones first and marked; vocab readings in a row.
function Readings({ type, readings }: { type: "kanji" | "vocab"; readings: Reading[] }) {
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
          <View className="flex-row flex-wrap gap-2">
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
          </View>
        </View>
      ))}
      <Text className="text-sm text-muted">The highlighted reading is the one quizzes accept.</Text>
    </View>
  );
}
