// Raw color values for APIs that take a color, not a class name (navigation theme, tab bar,
// status bar, icons). Must match src/global.css exactly; colors.test.ts fails if they drift.
export const colors = {
  light: {
    bg: "#fafaf9",
    surface: "#ffffff",
    border: "#e7e5e4",
    text: "#1c1917",
    muted: "#78716c",
    primary: "#d81b60",
    "on-primary": "#ffffff",
    appbar: "#e91e63",
    radical: "#009dec",
    kanji: "#e91e63",
    vocab: "#aa00ff",
    correct: "#15803d",
    wrong: "#b91c1c",
    "stage-locked": "#d6d3d1",
    "stage-lesson": "#78716c",
    "stage-seed": "#a16207",
    "stage-sprout": "#65a30d",
    "stage-bloom": "#0d9488",
    "stage-harvest": "#7c3aed",
    "stage-retired": "#57534e",
  },
  dark: {
    bg: "#1c1917",
    surface: "#292524",
    border: "#44403c",
    text: "#f5f5f4",
    muted: "#a8a29e",
    primary: "#f06292",
    "on-primary": "#1c1917",
    appbar: "#ad1457",
    radical: "#009dec",
    kanji: "#e91e63",
    vocab: "#aa00ff",
    correct: "#4ade80",
    wrong: "#f87171",
    "stage-locked": "#44403c",
    "stage-lesson": "#a8a29e",
    "stage-seed": "#ca8a04",
    "stage-sprout": "#84cc16",
    "stage-bloom": "#2dd4bf",
    "stage-harvest": "#a78bfa",
    "stage-retired": "#e7e5e4",
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorToken = keyof (typeof colors)["light"];
export type Palette = Record<ColorToken, string>;

// Colors that never change with the theme (text on the app bar and on subject tiles).
export const white = "#ffffff";

export function paletteFor(scheme: string | null | undefined): Palette {
  return scheme === "dark" ? colors.dark : colors.light;
}
