import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from "react-native";

import { usePalette } from "@/theme/use-palette";

import { Button } from "./Button";

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  // When set, confirm stays disabled until this exact text is typed (case sensitive).
  requireText?: string;
  // Extra content under the message, such as a picker.
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

// Android back and a tap on the scrim both cancel. The scrim covers the system bars.
export function ConfirmDialog({ visible, onCancel, ...rest }: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Modal unmounts its content while hidden, so the typed text resets on every open. */}
      <DialogBody onCancel={onCancel} {...rest} />
    </Modal>
  );
}

function DialogBody({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  requireText,
  children,
  onConfirm,
  onCancel,
}: Omit<ConfirmDialogProps, "visible">) {
  const palette = usePalette();
  const [typed, setTyped] = useState("");
  const blocked = requireText !== undefined && typed !== requireText;

  return (
    <View className="flex-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        onPress={onCancel}
        className="absolute bottom-0 left-0 right-0 top-0 bg-black/50"
      />
      <KeyboardAvoidingView
        behavior="padding"
        pointerEvents="box-none"
        className="flex-1 justify-center px-4"
      >
        <View className="gap-4 rounded-lg bg-surface p-6 dark:border dark:border-border">
          <Text accessibilityRole="header" className="text-xl font-bold text-text">
            {title}
          </Text>
          <Text className="text-base text-text">{message}</Text>
          {children}
          {requireText !== undefined && (
            <TextInput
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              value={typed}
              onChangeText={setTyped}
              placeholder={requireText}
              placeholderTextColor={palette.muted}
              accessibilityLabel={`Type ${requireText} to confirm`}
              className="min-h-12 rounded-md border border-border px-3 text-base text-text"
            />
          )}
          <View className="flex-row flex-wrap justify-end gap-2">
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
            <Button
              label={confirmLabel}
              variant={tone === "danger" ? "danger" : "primary"}
              disabled={blocked}
              onPress={onConfirm}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
