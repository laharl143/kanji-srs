import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui";
import { synonymRefusalMessage, type SynonymRefusal } from "@/lib/answer/synonym";
import { usePalette } from "@/theme/use-palette";

export type AddOutcome = { ok: true } | { ok: false; reason?: SynonymRefusal };

type SynonymEditorProps = {
  synonyms: string[];
  // A refusal comes back with a reason; a failed save without one (the screen shows the toast).
  onAdd: (text: string) => Promise<AddOutcome>;
  onRemove: (text: string) => Promise<boolean>;
};

/**
 * "Your synonyms" (spec 0009 AC-5, AC-6): one chip per synonym with a remove button, then a field
 * and an Add button. Each add or remove saves at once. A refused synonym shows why and stays in
 * the field; a failed save keeps your text, and a failed remove keeps its chip.
 */
export function SynonymEditor({ synonyms, onAdd, onRemove }: SynonymEditorProps) {
  const palette = usePalette();
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function add() {
    if (busy) return;
    setBusy(true);
    const result = await onAdd(text);
    setBusy(false);
    if (result.ok) {
      setText("");
      setError(undefined);
    } else if (result.reason) {
      setError(synonymRefusalMessage[result.reason]);
    }
  }

  async function remove(s: string) {
    if (busy) return;
    setBusy(true);
    await onRemove(s);
    setBusy(false);
  }

  return (
    <View testID="synonyms" className="gap-2">
      <Text className="text-sm font-bold text-muted">Your synonyms</Text>
      {synonyms.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {synonyms.map((s) => (
            <View
              key={s}
              className="flex-row items-center rounded-full border border-vocab bg-bg pl-3"
            >
              <Text className="text-base text-text">{s}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove synonym ${s}`}
                testID={`synonym-remove-${s}`}
                disabled={busy}
                onPress={() => remove(s)}
                className="h-12 w-12 items-center justify-center rounded-full active:bg-border"
              >
                <MaterialCommunityIcons name="close" size={18} color={palette.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View className="flex-row items-start gap-2">
        <TextInput
          testID="synonym-input"
          accessibilityLabel="New synonym"
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(undefined);
          }}
          onSubmitEditing={add}
          placeholder="Add an English meaning"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="visible-password"
          returnKeyType="done"
          submitBehavior="submit"
          className={`min-h-12 flex-1 rounded-md border bg-surface px-3 text-base text-text ${error ? "border-wrong" : "border-border"}`}
        />
        <Button
          label="Add"
          icon="plus"
          testID="synonym-add"
          loading={busy}
          disabled={text.trim() === ""}
          onPress={add}
        />
      </View>
      {error && (
        <Text
          testID="synonym-error"
          accessibilityLiveRegion="polite"
          className="text-sm font-bold text-wrong"
        >
          {error}
        </Text>
      )}
    </View>
  );
}
