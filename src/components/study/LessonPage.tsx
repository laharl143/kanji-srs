import { Pressable, Text, View } from "react-native";

import { Mnemonic, NoteText, Readings, Section } from "@/components/subject/Section";
import { SpeakButton } from "@/components/subject/SpeakButton";
import { SubjectChip } from "@/components/ui";
import { primaryMeaning } from "@/lib/subjects";
import type { LessonItem } from "@/lib/study/lessons";

import { subjectBg, subjectLabel } from "./subject-style";

// One lesson item (spec 0004 AC-6): characters, meanings, readings, components, and mnemonics,
// with your notes under the mnemonics and your synonyms after "Also accepted" (spec 0009 AC-7),
// and the speak button for vocab (spec 0009 AC-10). "+ Add synonym" opens the synonym sheet
// (spec 0011 AC-1); the screen owns the sheet and passes the saved list back in `item`.
export function LessonPage({
  item,
  onAddSynonym,
}: {
  item: LessonItem;
  onAddSynonym?: () => void;
}) {
  const { subject, components, synonyms, details } = item;
  const meaning = primaryMeaning(subject.meanings);
  const others = [
    ...subject.meanings.filter((m) => m.text !== meaning).map((m) => m.text),
    ...synonyms,
  ];

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
          <Text testID="lesson-also-accepted" className="text-base text-muted">
            Also accepted: {others.join(", ")}
          </Text>
        )}
        {onAddSynonym && (
          <Pressable
            accessibilityRole="button"
            testID="lesson-add-synonym"
            onPress={onAddSynonym}
            className="min-h-12 justify-center self-start"
          >
            <Text className="text-base font-bold text-primary">+ Add synonym</Text>
          </Pressable>
        )}
        <Mnemonic text={subject.meaningMnemonic} />
        <NoteText label="Your meaning note" text={details.meaningNote} />
      </Section>

      {subject.type !== "radical" && (
        <Section title="Reading">
          <Readings
            type={subject.type}
            readings={subject.readings}
            aside={
              subject.type === "vocab" ? (
                <SpeakButton text={subject.readings.find((r) => r.primary)?.text} />
              ) : undefined
            }
          />
          <Mnemonic text={subject.readingMnemonic} />
          <NoteText label="Your reading note" text={details.readingNote} />
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
