import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, ToastProvider, useToast } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db/client";
import { addSynonym, removeSynonym } from "@/lib/study/items";

import { SynonymEditor, type AddOutcome } from "./SynonymEditor";

const SAVE_FAILED = "Could not save. Try again.";

type SynonymSheetProps = {
  visible: boolean;
  title: string;
  subjectId: number;
  // Your saved synonyms for the item, as the session or lesson holds them.
  synonyms: string[];
  // The saved list after each add or remove that worked (spec 0011 AC-4).
  onChange: (synonyms: string[]) => void;
  onClose: () => void;
};

/**
 * The synonym sheet (spec 0011 AC-1, AC-3, AC-6 to AC-9): a panel at the bottom with the title,
 * the `SynonymEditor` from the item page, and Done. It shows only your synonyms, never the
 * meanings, readings, or mnemonics, so it is safe to open before you answer. Done, a tap on the
 * scrim, or Android back closes it. It has its own toast host, because a Modal covers the app's.
 */
export function SynonymSheet({ visible, onClose, ...rest }: SynonymSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* Modal unmounts its content while hidden, so the field starts empty on every open. */}
      <ToastProvider bottomOffset={16}>
        <SheetBody onClose={onClose} {...rest} />
      </ToastProvider>
    </Modal>
  );
}

function SheetBody({
  title,
  subjectId,
  synonyms,
  onChange,
  onClose,
}: Omit<SynonymSheetProps, "visible">) {
  const insets = useSafeAreaInsets();
  const toast = useToast();

  // Same save rules as the item page (spec 0009 AC-5, AC-6): the stored list comes back from the
  // service; a thrown error shows the toast and keeps your text or chip.
  async function add(text: string): Promise<AddOutcome> {
    try {
      const r = await addSynonym(getDb(), getCurrentUserId(), subjectId, text, now().getTime());
      if (r.ok) {
        onChange(r.synonyms);
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
      onChange(r.synonyms);
      return true;
    } catch {
      toast.show(SAVE_FAILED, { tone: "error" });
      return false;
    }
  }

  return (
    <View className="flex-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close synonyms"
        onPress={onClose}
        className="absolute bottom-0 left-0 right-0 top-0 bg-black/50"
      />
      <KeyboardAvoidingView
        behavior="padding"
        pointerEvents="box-none"
        className="flex-1 justify-end"
      >
        <View
          testID="synonym-sheet"
          className="max-h-[90%] rounded-t-lg bg-surface dark:border dark:border-border"
        >
          {/* Scrolls when the sheet is taller than the screen (large font sizes); "handled" lets a
              tap on Add, a chip, or Done land while the keyboard is up. Render the sheet outside
              any ScrollView that lacks "handled": a Modal's touches bubble through its React
              parents, and such a ScrollView closes the keyboard and swallows the tap. */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            className="grow-0"
            contentContainerClassName="gap-4 pt-6"
            contentContainerStyle={{
              paddingBottom: insets.bottom + 16,
              paddingLeft: insets.left + 16,
              paddingRight: insets.right + 16,
            }}
          >
            <Text accessibilityRole="header" className="text-xl font-bold text-text">
              {title}
            </Text>
            <SynonymEditor synonyms={synonyms} onAdd={add} onRemove={remove} />
            <Button
              label="Done"
              variant="secondary"
              testID="synonym-sheet-done"
              onPress={onClose}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
