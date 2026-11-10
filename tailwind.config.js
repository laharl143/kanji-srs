// NativeWind v4 config (spec 0003). Colors read the CSS variables in src/global.css.
const tokens = [
  "bg",
  "surface",
  "border",
  "text",
  "muted",
  "primary",
  "on-primary",
  "appbar",
  "radical",
  "kanji",
  "vocab",
  "correct",
  "wrong",
  "on-wrong",
  "stage-locked",
  "stage-lesson",
  "stage-seed",
  "stage-sprout",
  "stage-bloom",
  "stage-harvest",
  "stage-retired",
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: Object.fromEntries(tokens.map((t) => [t, `rgb(var(--${t}) / <alpha-value>)`])),
      fontFamily: {
        jp: ["NotoSansJP_400Regular"],
        "jp-bold": ["NotoSansJP_700Bold"],
      },
      borderRadius: { md: "8px", lg: "12px" },
    },
  },
  plugins: [],
};
