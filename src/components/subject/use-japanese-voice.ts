import * as Speech from "expo-speech";
import { useEffect, useState } from "react";

import { findJapaneseVoice } from "./japanese-voice";

// One check per app run, cached (spec 0009 AC-10). A rejected check counts as no voice.
let check: Promise<string | null> | undefined;

// Called at app launch from the root layout, so the button is ready by the first vocab page.
export function startJapaneseVoiceCheck(): Promise<string | null> {
  check ??= Speech.getAvailableVoicesAsync().then(findJapaneseVoice, () => null);
  return check;
}

// The Japanese voice's identifier, or null while checking and when there is none.
export function useJapaneseVoice(): string | null {
  const [voice, setVoice] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    startJapaneseVoiceCheck().then((v) => active && setVoice(v));
    return () => {
      active = false;
    };
  }, []);
  return voice;
}
