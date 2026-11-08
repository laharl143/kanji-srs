import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { LoadingState } from "@/components/study";
import {
  ItemHero,
  LoadError,
  Mnemonic,
  NoteField,
  NotFound,
  Readings,
  Section,
  SpeakButton,
  StageStrip,
  SynonymEditor,
  nextReviewLabel,
  type AddOutcome,
} from "@/components/subject";
import { Screen, SubjectChip, useToast } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db/client";
import { parsePositiveParam } from "@/lib/params";
import {
  addSynonym,
  getItemPage,
  removeSynonym,
  saveNote,
  type Chip,
  type ItemNote,
  type ItemPage,
} from "@/lib/study/items";
import { primaryMeaning } from "@/lib/subjects";

const SAVE_FAILED = "Could not save. Try again.";

// One item page (spec 0009 AC-1 to AC-6, AC-11, AC-12).
export default function SubjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subjectId = parsePositiveParam(id);
  if (subjectId === null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Not found" }} />
        <NotFound what="item" />
      </Screen>
    );
  }
  return <ItemScreen key={subjectId} subjectId={subjectId} />;
}

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "ready"; page: ItemPage; at: number };

function ItemScreen({ subjectId }: { subjectId: number }) {
  const toast = useToast();
  const [load, setLoad] = useState<Load>({ status: "loading" });

  // Loads on every focus. A reload swaps the data in place and never unmounts the cards, so an
  // open note keeps its text (AC-4).
  const refresh = useCallback(() => {
    let active = true;
    const at = now().getTime();
    getItemPage(getDb(), getCurrentUserId(), subjectId).then(
      (page) => active && setLoad(page ? { status: "ready", page, at } : { status: "missing" }),
      (e) =>
        active && setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      active = false;
    };
  }, [subjectId]);
  useFocusEffect(refresh);
  const retry = () => {
    setLoad({ status: "loading" });
    refresh();
  };

  const setNote = (update: (note: ItemNote) => ItemNote) =>
    setLoad((l) =>
      l.status === "ready" ? { ...l, page: { ...l.page, note: update(l.page.note) } } : l,
    );

  async function saveText(kind: "meaningNote" | "readingNote", text: string): Promise<boolean> {
    try {
      const r = await saveNote(
        getDb(),
        getCurrentUserId(),
        subjectId,
        { [kind]: text },
        now().getTime(),
      );
      if (!r.ok) throw new Error(r.error);
      setNote(() => r.note);
      return true;
    } catch {
      toast.show(SAVE_FAILED, { tone: "error" });
      return false;
    }
  }

  async function add(text: string): Promise<AddOutcome> {
    try {
      const r = await addSynonym(getDb(), getCurrentUserId(), subjectId, text, now().getTime());
      if (r.ok) {
        setNote((n) => ({ ...n, synonyms: r.synonyms }));
        return { ok: true };
      }
      if (r.error === "invalid") return { ok: false, reason: r.reason };
      throw new Error(r.error);
    } catch {
      toast.show(SAVE_FAILED, { tone: "error" });
      return { ok: false };
    }
  }

  async function remove(text: string): Promise<boolean> {
    try {
      const r = await removeSynonym(getDb(), getCurrentUserId(), subjectId, text, now().getTime());
      if (!r.ok) throw new Error(r.error);
      setNote((n) => ({ ...n, synonyms: r.synonyms }));
      return true;
    } catch {
      toast.show(SAVE_FAILED, { tone: "error" });
      return false;
    }
  }

  if (load.status !== "ready") {
    return (
      <Screen>
        <Stack.Screen options={{ title: load.status === "missing" ? "Not found" : "Item" }} />
        {load.status === "loading" && <LoadingState label="Loading item" />}
        {load.status === "missing" && <NotFound what="item" />}
        {load.status === "error" && (
          <LoadError title="Item could not load" message={load.message} onRetry={retry} />
        )}
      </Screen>
    );
  }

  const { subject, assignment, components, usedIn, note } = load.page;
  const meaning = primaryMeaning(subject.meanings);
  const others = subject.meanings.filter((m) => m.text !== meaning).map((m) => m.text);
  const speakText = subject.readings.find((r) => r.primary)?.text;

  return (
    <Screen>
      <Stack.Screen options={{ title: subject.characters }} />
      <ItemHero
        type={subject.type}
        level={subject.level}
        characters={subject.characters}
        meaning={meaning}
      />
      <StageStrip
        stage={assignment?.srsStage ?? null}
        next={nextReviewLabel(assignment, load.at)}
      />

      <Section title="Meaning" testID="item-meaning">
        <Text className="text-xl font-bold text-text">{meaning}</Text>
        {others.length > 0 && (
          <Text className="text-base text-muted">Also accepted: {others.join(", ")}</Text>
        )}
        <Mnemonic text={subject.meaningMnemonic} />
        <NoteField
          kind="meaning"
          value={note.meaningNote}
          onSave={(t) => saveText("meaningNote", t)}
        />
        <SynonymEditor synonyms={note.synonyms} onAdd={add} onRemove={remove} />
      </Section>

      {subject.type !== "radical" && (
        <Section title="Reading" testID="item-reading">
          <Readings
            type={subject.type}
            readings={subject.readings}
            aside={subject.type === "vocab" ? <SpeakButton text={speakText} /> : undefined}
          />
          <Mnemonic text={subject.readingMnemonic} />
          <NoteField
            kind="reading"
            value={note.readingNote}
            onSave={(t) => saveText("readingNote", t)}
          />
        </Section>
      )}

      {components.length > 0 && (
        <Section
          title={subject.type === "kanji" ? "Radicals in this kanji" : "Kanji in this word"}
          testID="item-components"
        >
          <View className="gap-3">
            {components.map((c) => (
              <View key={c.id} className="flex-row items-center gap-3">
                <ChipFor chip={c} />
                <Text className="flex-1 text-base text-text">{primaryMeaning(c.meanings)}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}

      {usedIn.length > 0 && (
        <Section title={`Used in (${usedIn.length})`} testID="item-used-in">
          <View className="flex-row flex-wrap gap-2">
            {usedIn.map((c) => (
              <View key={c.id} className="w-20 items-center gap-1">
                <ChipFor chip={c} />
                <Text numberOfLines={1} className="text-center text-xs text-muted">
                  {primaryMeaning(c.meanings)}
                </Text>
              </View>
            ))}
          </View>
        </Section>
      )}
    </Screen>
  );
}

function ChipFor({ chip }: { chip: Chip }) {
  return (
    <SubjectChip
      size="sm"
      stage={chip.stage}
      subject={{
        id: chip.id,
        type: chip.type,
        characters: chip.characters,
        meaning: primaryMeaning(chip.meanings),
      }}
    />
  );
}
