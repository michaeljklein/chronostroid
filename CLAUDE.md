# CLAUDE.md — Chronostroid

Authoritative conventions for agents and contributors. Read this first; open `references/` only when you need full specs.

---

## 1. Project Summary

**Chronostroid** is a two-player PvP Asteroids game with a time-travel twist, built in TypeScript + p5.js targeting the [RCade arcade cabinet](https://github.com/fcjr/RCade) at The Recurse Center.

### Core concept

- Two players share a single 336×262 canvas view. Both ships fly on a fully shared field with **Voronoi-based time-travel zones** from day one.
- The zone boundary is the live-computed **perpendicular bisector** of the two ships' positions. It shifts as ships move. Ships cannot cross the boundary (the live bisector keeps each ship on its own side). Asteroids and bullets cross freely.
- Each player pilots a ship in an asteroid field; asteroids split on hit (3 tiers: L → 2M → 2S → gone).
- **A** = thruster (Newtonian momentum, no drag). **B** = shoot (single bullet, fixed lifetime).
- Each player's **spinner** operates a **Vim-style undo tree** on their zone's game state (positions, asteroids, bullets, HP). Spinning rewinds or fast-forwards that zone's history. Independent zone clocks — each side can be at a different tick.
- **Fast-forwarding to the present** exits time-travel mode and gives a velocity boost proportional to scrub speed.
- Win condition: deplete the opponent's HP (10 HP, 1 damage per hit). No time limit.

### Tech stack

| Concern | Tool |
|---------|------|
| Language | TypeScript (strict) |
| Renderer | p5.js (instance mode) |
| Bundler | Vite |
| Arcade runtime | RCade (`rcade.manifest.json`) |
| Input | `@rcade/plugin-input-classic` + `@rcade/plugin-input-spinners` |
| Tests | Vitest |
| Lint | tsc + ESLint (`eslint.config.js`) |
| Node mgmt | `n` — always invoke npm/npx via `n exec stable npm …` |

Canvas dimensions: **336 × 262 px** (RCade standard).

---

## 2. Input Reference

| Player | Action | In-code symbol | Dev key |
|--------|--------|---------------|---------|
| P1 | D-Pad | `PLAYER_1.DPAD.{up,down,left,right}` | W / S / A / D |
| P1 | Thruster | `PLAYER_1.A` | F |
| P1 | Shoot | `PLAYER_1.B` | G |
| P1 | Spinner | `PLAYER_1_SPINNER.delta` | C (left) / V (right) |
| P2 | D-Pad | `PLAYER_2.DPAD.{up,down,left,right}` | I / K / J / L |
| P2 | Thruster | `PLAYER_2.A` | ; |
| P2 | Shoot | `PLAYER_2.B` | ' |
| P2 | Spinner | `PLAYER_2_SPINNER.delta` | . (left) / / (right) |
| System | 2P Start | `SYSTEM.TWO_PLAYER` | 2 |

Full RCade input spec: `references/rcade_readme.md`.

---

## 3. Conventions

### Node version management

Always use `n exec stable npm …` or `n exec stable npx …`. Never bare `npm` or `npx`.

### TypeScript

- `strict: true`, `noUnusedLocals`, `noUnusedParameters` are on. Do not suppress.
- No `any` unless unavoidable; prefer `unknown` + narrowing.
- p5 instance mode only — never global mode.

### Constants file — `src/constants.json`

All game constants live in **`src/constants.json`** (plain JSON, imported by TypeScript via `import CONSTANTS from './constants.json'`).

- **Zero magic numbers** anywhere in `src/`. Every numeric or boolean game parameter (physics values, timing, sizes, HP, energy, canvas dimensions) goes in this file.
- Organized by domain: `CANVAS`, `SHIP`, `BULLET`, `ASTEROID`, `REWIND`, `ENERGY`, `HP`.
- Do not add a domain key for values that don't share a domain — flat keys inside each domain object only.

### RCade sandbox constraints

- No `fetch`, no `localStorage`, no direct `keydown` listeners.
- All assets bundled at build time (no CDN).
- Use `@rcade/plugin-input-classic` / `@rcade/plugin-input-spinners` for all input.
- See `references/rcade_readme.md` §The Sandbox for full list.

### File naming

- TypeScript source: `src/*.ts` — kebab-case filenames.
- Tests: colocated `src/*.test.ts` or `src/__tests__/*.ts`.

---

## 4. TODO / COMPLETED / FUTURE_WORK Conventions

### TODO.md

- Top block: **session pointer** (latest handoff date, git HEAD, test/lint status).
- Each item: numbered ID, deps, rationale, acceptance criteria.
- Items prefixed **D-** are design/scope items requiring an `AskUserQuestion` interview before implementation.
- On completion, move the item **verbatim** to `COMPLETED.md` (most recent at top); add the completion date.

### COMPLETED.md

- Most-recent-first ordering.
- Items arrive verbatim from `TODO.md`; add a `*(YYYY-MM-DD)*` completion date tag.

### FUTURE_WORK.md

- Long-horizon items not in the current prototype scope.
- Each entry: rationale, open questions, when to revisit, acceptance criteria.

### Design interviews

Before implementing any feature marked **D-** in TODO.md, run an `AskUserQuestion` interview to lock the spec. Append a "Locked spec (YYYY-MM-DD interview)" block to the TODO item before writing code. See `references/design_interview_convention.md`.

---

## 5. Scripts Reference

All scripts live in `./scripts/` and must be run from the repo root (they `cd` internally). Always invoke via `bash scripts/<name>.sh` or make them executable and run directly.

| Script | Command inside | Purpose |
|--------|---------------|---------|
| `scripts/dev.sh` | `n exec stable npm run dev` | Start Vite dev server + RCade emulator |
| `scripts/build.sh` | `n exec stable npm run build` | Production Vite build |
| `scripts/lint.sh` | `tsc --noEmit` + `eslint src` | Type-check + lint |
| `scripts/test.sh` | `vitest run` | Run Vitest unit tests |

---

## 6. References

| File | Contents |
|------|---------|
| `references/rcade_readme.md` | RCade README snapshot — input API, sandbox rules, manifest format |
| `references/p5js_api_cheatsheet.md` | p5.js quick-reference by category |
| `references/session_handoff_convention.md` | How to write session handoff docs |
| `references/design_interview_convention.md` | Design interview process + open questions index |
| `references/session_handoff_*.md` | Per-session handoff records (added over time) |
