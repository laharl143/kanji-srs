# 0003. UI foundation

**Date**: 2026-10-13
**Status**: Proposed

## Summary

The look and the base components every page uses. The style is calm and readable, with its own colors so it does not look like WaniKani. It works on a phone width from day one and follows your system's light or dark mode.

## Requirements

**Acceptance criteria**:
- **AC-1**: Design tokens (colors, radius, spacing) live in `src/app/globals.css` as CSS variables and are mapped in the Tailwind config; light and dark values both defined (`prefers-color-scheme`).
- **AC-2**: Subject type colors are distinct and not WaniKani's (WaniKani uses blue / pink / purple; we use the palette below).
- **AC-3**: Japanese text renders with Noto Sans JP (via `next/font/google`), falling back to `"Hiragino Sans", "Yu Gothic", sans-serif`.
- **AC-4**: App shell: top nav with Dashboard, Lessons, Reviews, Levels, Settings; collapses to a compact bar at 375px width with no horizontal scroll.
- **AC-5**: Base components exist in `src/components/ui/` and handle keyboard focus visibly.

## Decision

**Chosen option**: Tailwind with CSS variable tokens and a small hand-written component set (no component library).

## Feature design

**Palette** (CSS variables; light / dark):
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#fafaf9` | `#1c1917` | page |
| `--surface` | `#ffffff` | `#292524` | cards |
| `--text` | `#1c1917` | `#f5f5f4` | body |
| `--muted` | `#78716c` | `#a8a29e` | secondary text |
| `--radical` | `#0f766e` (teal) | `#2dd4bf` | radical chips |
| `--kanji` | `#c2410c` (orange) | `#fb923c` | kanji chips |
| `--vocab` | `#4d7c0f` (olive green) | `#a3e635` | vocab chips |
| `--correct` | `#15803d` | `#4ade80` | answer feedback |
| `--wrong` | `#b91c1c` | `#f87171` | answer feedback |

Stage group colors: Seed `#a16207`, Sprout `#65a30d`, Bloom `#0d9488`, Harvest `#7c3aed`, Retired `#57534e`.

**Components** (`src/components/ui/`): `Button` (primary, secondary, danger), `Card`, `SubjectChip` (characters on type color, links to `/subjects/[id]`), `ProgressBar` (value, max, optional marker at 90%), `Toast` (simple context provider), `ConfirmDialog` (native `<dialog>`), `Kbd` (keyboard hint).

**Layout**: `src/app/layout.tsx` wraps pages in the shell; content max width 960px, 16px side padding.

**Critical test scenarios**:
- Happy path: render every component in a `/dev/ui` page (only in development) and check at 375px and 1280px, verifies **AC-4**, **AC-5**

## Build plan

1. Add tokens to `globals.css` and map them in Tailwind config, satisfies **AC-1**, **AC-2**
2. Load Noto Sans JP with `next/font/google`; add a `.jp` utility class, satisfies **AC-3**
3. Build the app shell and nav in `layout.tsx`, satisfies **AC-4**
4. Build the base components plus a development-only `/dev/ui` preview page, satisfies **AC-5**

## Consequences

**Positive**: consistent look, no extra dependency.
**Negative / tradeoffs**: hand-written components need their own accessibility care.
