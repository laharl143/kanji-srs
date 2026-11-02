import { usePreventRemove } from "expo-router";
import { useRef, useState } from "react";

/**
 * Asks before leaving a session once an answer is in (spec 0004 AC-11): the Android back
 * button, the app bar arrow, and the back gesture all go through the stack's beforeRemove
 * event, which usePreventRemove listens to. Once you confirm, the guard turns off and the
 * blocked navigation runs, so it does not ask again. Pass `active` false when the session is
 * done or no answer is in.
 */
export function useLeaveGuard(active: boolean) {
  const [visible, setVisible] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const repeatRef = useRef<(() => void) | null>(null);

  usePreventRemove(active && !allowed, ({ repeat }) => {
    repeatRef.current = repeat;
    setVisible(true);
  });

  return {
    visible,
    confirm() {
      setVisible(false);
      setAllowed(true);
      // Runs after the guard is off, so the repeated action is not blocked again.
      setTimeout(() => repeatRef.current?.(), 0);
    },
    cancel() {
      setVisible(false);
      repeatRef.current = null;
    },
  };
}
