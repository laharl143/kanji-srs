import { useColorScheme } from "react-native";

import { paletteFor, type Palette } from "./colors";

// Raw colors for the current system theme, for APIs that cannot take a class name.
export function usePalette(): Palette {
  return paletteFor(useColorScheme());
}
