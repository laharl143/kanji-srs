import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { ConfirmDialog } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/client";
import { countToRetire } from "@/lib/db/queries/assignments";

import { Stepper } from "./Stepper";

type Count = { status: "loading" } | { status: "ready"; n: number } | { status: "error" };

// The preview line under the level stepper (spec 0010 AC-5).
export function previewText(count: Count, level: number): string {
  if (count.status === "loading") return "Counting items…";
  if (count.status === "error") return "Could not count items. Try again.";
  if (count.n === 0) return `Nothing to retire. You move to level ${level}.`;
  const items = count.n === 1 ? "1 item" : `${count.n} items`;
  return `${items} below level ${level} become Retired. They will not come up for review. You cannot undo this.`;
}

/**
 * Skip ahead (spec 0010 AC-5, AC-8). Mount it only while open, so the level starts at your
 * level plus 1 every time. The count reloads on each step and only the answer for the level now
 * shown is used. Confirm stays disabled while counting or after a failed count.
 */
export function SkipAheadDialog({
  currentLevel,
  maxLevel,
  busy,
  onConfirm,
  onCancel,
}: {
  currentLevel: number;
  maxLevel: number;
  busy: boolean;
  onConfirm: (level: number) => void;
  onCancel: () => void;
}) {
  const [level, setLevel] = useState(currentLevel + 1);
  // The last answer, tagged with its level; an answer for another level means still counting.
  const [answer, setAnswer] = useState<{ level: number; count: Count }>();
  const request = useRef(0);

  useEffect(() => {
    request.current += 1;
    const mine = request.current;
    countToRetire(getDb(), getCurrentUserId(), level).then(
      (n) => mine === request.current && setAnswer({ level, count: { status: "ready", n } }),
      () => mine === request.current && setAnswer({ level, count: { status: "error" } }),
    );
  }, [level]);
  const count: Count = answer?.level === level ? answer.count : { status: "loading" };

  return (
    <ConfirmDialog
      visible
      title="Skip ahead"
      message="Choose the level to skip to."
      confirmLabel={`Skip to level ${level}`}
      confirmDisabled={count.status !== "ready"}
      busy={busy}
      onConfirm={() => onConfirm(level)}
      onCancel={onCancel}
    >
      <View className="items-center">
        <Stepper
          value={level}
          min={currentLevel + 1}
          max={maxLevel}
          onChange={setLevel}
          decreaseLabel="Lower level"
          increaseLabel="Higher level"
          valueLabel="Skip to level"
          testID="skip-level"
        />
      </View>
      <Text testID="skip-preview" className="text-base text-muted">
        {previewText(count, level)}
      </Text>
    </ConfirmDialog>
  );
}
