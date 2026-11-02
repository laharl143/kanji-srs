import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { colors, white, type ColorScheme, type Palette } from "./colors";

const css = readFileSync(fileURLToPath(new URL("../global.css", import.meta.url)), "utf8");

// Reads `--name: R G B;` lines from the first `:root { ... }` block in `source`.
function rootTokens(source: string): Record<string, string> {
  const block = /:root\s*\{([^}]*)\}/.exec(source);
  if (!block) throw new Error("no :root block found");
  const tokens: Record<string, string> = {};
  for (const [, name, r, g, b] of block[1].matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    tokens[name] = "#" + [r, g, b].map((v) => Number(v).toString(16).padStart(2, "0")).join("");
  }
  return tokens;
}

function cssTokens(scheme: ColorScheme): Record<string, string> {
  const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
  if (darkStart < 0) throw new Error("no dark media block found");
  return scheme === "light"
    ? rootTokens(css.slice(0, darkStart))
    : rootTokens(css.slice(darkStart));
}

describe("global.css and colors.ts parity", () => {
  it.each(["light", "dark"] as const)("%s tokens match exactly", (scheme) => {
    expect(cssTokens(scheme)).toEqual({ ...colors[scheme] });
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Pair = { scheme: ColorScheme; name: string; fg: string; bg: string; min: number };

function pairs(): Pair[] {
  const out: Pair[] = [];
  for (const scheme of ["light", "dark"] as const) {
    const p: Palette = colors[scheme];
    const add = (name: string, fg: string, bg: string, min: number) =>
      out.push({ scheme, name, fg, bg, min });
    add("on-primary on primary (button label)", p["on-primary"], p.primary, 4.5);
    add("primary on surface (secondary button label)", p.primary, p.surface, 4.5);
    add("text on bg", p.text, p.bg, 4.5);
    add("text on surface", p.text, p.surface, 4.5);
    add("muted on bg", p.muted, p.bg, 4.5);
    add("muted on surface", p.muted, p.surface, 4.5);
    add("white on wrong (danger button label)", white, p.wrong, 4.5);
    add("white on appbar (bold 20sp title)", white, p.appbar, 3);
    for (const type of ["radical", "kanji", "vocab"] as const) {
      add(`white on ${type} (chip characters)`, white, p[type], 3);
    }
    add("muted on stage-locked (locked chip characters)", p.muted, p["stage-locked"], 3);
    for (const stage of [
      "locked",
      "lesson",
      "seed",
      "sprout",
      "bloom",
      "harvest",
      "retired",
    ] as const) {
      const token = `stage-${stage}` as const;
      add(`${token} on bg`, p[token], p.bg, 3);
    }
  }
  if (out.length === 0) throw new Error("no pairs");
  return out;
}

// Pairs from the spec 0003 palette that miss their contrast target. They are owed to
// `/architect UI foundation` to settle (new values, or an exemption for the locked state).
// This list must match exactly, so a fixed pair or a new failure both fail the test.
const KNOWN_GAPS = [
  "light: white on radical (chip characters)",
  "light: stage-locked on bg",
  "light: stage-sprout on bg",
  "dark: white on wrong (danger button label)",
  "dark: white on radical (chip characters)",
  "dark: stage-locked on bg",
];

describe("contrast", () => {
  it("light mode primary passes 4.5:1 for white labels and pink text on bg", () => {
    expect(contrast(white, colors.light.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.light.primary, colors.light.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("every pair meets its target except the recorded gaps", () => {
    const failing = pairs()
      .filter((p) => contrast(p.fg, p.bg) < p.min)
      .map((p) => `${p.scheme}: ${p.name}`);
    expect(failing.sort()).toEqual([...KNOWN_GAPS].sort());
  });
});
