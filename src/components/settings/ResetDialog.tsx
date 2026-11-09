import { ConfirmDialog } from "@/components/ui";

// Reset all progress (spec 0010 AC-7, AC-8): danger tone, confirm only after typing RESET.
export function ResetDialog({
  visible,
  busy,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      visible={visible}
      title="Reset all progress?"
      message="Deletes all your progress, reviews, notes, and synonyms. Your settings stay. You cannot undo this. Type RESET to confirm."
      confirmLabel="Reset"
      tone="danger"
      requireText="RESET"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
