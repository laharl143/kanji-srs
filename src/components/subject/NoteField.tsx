import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui";
import { NOTE_MAX_LENGTH } from "@/lib/study/items";
import { usePalette } from "@/theme/use-palette";

const COUNTER_FROM = 900;

type NoteFieldProps = {
  kind: "meaning" | "reading";
  // The saved text; null when there is no note.
  value: string | null;
  // Resolves true when saved. On false (a failed save) the field stays open with your text.
  onSave: (text: string) => Promise<boolean>;
};

/**
 * Your meaning or reading note, edited in place (spec 0009 AC-4, AC-6). The draft is local
 * state, so a reload of the page behind it never resets an open field.
 */
export function NoteField({ kind, value, onSave }: NoteFieldProps) {
  const palette = usePalette();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const title = kind === "meaning" ? "Your meaning note" : "Your reading note";

  function open() {
    setDraft(value ?? "");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) setEditing(false);
  }

  if (!editing) {
    if (!value) {
      return (
        <Button
          label={kind === "meaning" ? "Add meaning note" : "Add reading note"}
          icon="pencil-plus"
          variant="secondary"
          testID={`note-${kind}-add`}
          onPress={open}
        />
      );
    }
    return (
      <Pressable
        testID={`note-${kind}`}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${value}. Tap to edit`}
        onPress={open}
        className="min-h-12 gap-1 rounded-md border-l-4 border-vocab bg-bg px-3 py-2 active:opacity-85"
      >
        <Text className="text-sm font-bold text-muted">{title}</Text>
        <Text className="text-base leading-6 text-text">{value}</Text>
      </Pressable>
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-muted">{title}</Text>
      <TextInput
        testID={`note-${kind}-input`}
        accessibilityLabel={title}
        value={draft}
        onChangeText={setDraft}
        multiline
        autoFocus
        maxLength={NOTE_MAX_LENGTH}
        textAlignVertical="top"
        placeholder="Write your own way to remember it"
        placeholderTextColor={palette.muted}
        className="min-h-24 rounded-md border border-primary bg-surface px-3 py-2 text-base text-text"
      />
      {draft.length > COUNTER_FROM && (
        <Text
          testID={`note-${kind}-counter`}
          accessibilityLiveRegion="polite"
          className="text-right text-sm text-muted"
        >
          {`${draft.length} / ${NOTE_MAX_LENGTH}`}
        </Text>
      )}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            label="Cancel"
            variant="secondary"
            testID={`note-${kind}-cancel`}
            disabled={saving}
            onPress={() => setEditing(false)}
          />
        </View>
        <View className="flex-1">
          <Button
            label="Save"
            icon="content-save"
            testID={`note-${kind}-save`}
            loading={saving}
            onPress={save}
          />
        </View>
      </View>
    </View>
  );
}
