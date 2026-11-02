import { ConfirmDialog } from "@/components/ui";

import type { useLeaveGuard } from "./use-leave-guard";

// The leave confirmation for a session with answers in it (spec 0004 AC-11).
export function LeaveDialog({ guard }: { guard: ReturnType<typeof useLeaveGuard> }) {
  return (
    <ConfirmDialog
      visible={guard.visible}
      title="Leave this session?"
      message="Items you finished are saved. Items you were partway through are not, and will be waiting next time."
      confirmLabel="Leave"
      cancelLabel="Keep going"
      onConfirm={guard.confirm}
      onCancel={guard.cancel}
    />
  );
}
