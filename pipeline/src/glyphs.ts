// Reads a TrueType/OpenType font's cmap so the build report can list components the app font
// cannot draw (0001 §5.2). Supports cmap formats 4 and 12, which cover Noto Sans JP.
import { readFileSync } from "node:fs";

export const NOTO_SANS_JP =
  "node_modules/@expo-google-fonts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf";

export function loadCodepoints(fontPath: string): Set<number> {
  const buf = readFileSync(fontPath);
  const numTables = buf.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString("latin1", rec, rec + 4) === "cmap") cmap = buf.readUInt32BE(rec + 8);
  }
  if (cmap < 0) throw new Error(`${fontPath}: no cmap table`);

  const out = new Set<number>();
  const subtables = buf.readUInt16BE(cmap + 2);
  for (let i = 0; i < subtables; i++) {
    const offset = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
    const format = buf.readUInt16BE(offset);
    if (format === 12) {
      const groups = buf.readUInt32BE(offset + 12);
      for (let g = 0; g < groups; g++) {
        const at = offset + 16 + g * 12;
        const start = buf.readUInt32BE(at);
        const end = buf.readUInt32BE(at + 4);
        for (let c = start; c <= end; c++) out.add(c);
      }
    } else if (format === 4) {
      const segX2 = buf.readUInt16BE(offset + 6);
      const ends = offset + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const rangeOffsets = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = buf.readUInt16BE(ends + s * 2);
        const start = buf.readUInt16BE(starts + s * 2);
        const delta = buf.readInt16BE(deltas + s * 2);
        const ro = buf.readUInt16BE(rangeOffsets + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph: number;
          if (ro === 0) glyph = (c + delta) & 0xffff;
          else {
            const at = rangeOffsets + s * 2 + ro + (c - start) * 2;
            const raw = buf.readUInt16BE(at);
            glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
          }
          if (glyph !== 0) out.add(c);
        }
      }
    }
  }
  return out;
}

export function missingGlyphs(text: string[], codepoints: Set<number>): string[] {
  return text.filter((t) => [...t].some((c) => !codepoints.has(c.codePointAt(0)!)));
}
