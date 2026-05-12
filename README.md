# Chronostroid

PvP Asteroids with time travel — built for the [RCade](https://github.com/fcjr/RCade) arcade cabinet at The Recurse Center.

Two players pilot ships in an asteroid field. Each player's spinner rewinds or fast-forwards the state on their half of the screen — asteroids, bullets, and their own HP changes. Deplete your opponent's HP to win.

---

## Development workflow

This project uses [n](https://github.com/tj/n) for Node version management. All npm/npx commands must go through `n exec stable`.

### Scripts

```bash
bash scripts/dev.sh      # Start Vite dev server + RCade emulator (port 5173)
bash scripts/build.sh    # Production build → dist/
bash scripts/lint.sh     # tsc --noEmit + ESLint
bash scripts/test.sh     # Vitest unit tests
```

### Install dependencies

```bash
n exec stable npm install
```

### Manual npm equivalents

```bash
n exec stable npm run dev
n exec stable npm run build
n exec stable npm run lint
n exec stable npm run test
```

---

## Arcade controls

| Player | Action | In-code | Dev key |
|--------|--------|---------|---------|
| P1 | Thruster | `PLAYER_1.A` | F |
| P1 | Shoot | `PLAYER_1.B` | G |
| P1 | Spinner | `PLAYER_1_SPINNER.delta` | C / V |
| P1 | D-Pad | `PLAYER_1.DPAD.*` | W/A/S/D |
| P2 | Thruster | `PLAYER_2.A` | ; |
| P2 | Shoot | `PLAYER_2.B` | ' |
| P2 | Spinner | `PLAYER_2_SPINNER.delta` | . / / |
| P2 | D-Pad | `PLAYER_2.DPAD.*` | I/J/K/L |
| System | 2P Start | `SYSTEM.TWO_PLAYER` | 2 |

Full input reference: `references/rcade_readme.md`.

---

## Project structure

```
├── scripts/
│   ├── dev.sh             # n exec stable npm run dev
│   ├── build.sh           # n exec stable npm run build
│   ├── lint.sh            # tsc --noEmit + eslint src
│   └── test.sh            # vitest run
├── references/
│   ├── rcade_readme.md    # RCade README snapshot
│   ├── p5js_api_cheatsheet.md
│   ├── session_handoff_convention.md
│   └── design_interview_convention.md
├── src/
│   ├── sketch.ts          # p5.js sketch (game entrypoint)
│   └── style.css
├── index.html
├── vite.config.js
├── tsconfig.json
├── eslint.config.js
├── rcade.manifest.json
├── CLAUDE.md              # Conventions for agents and contributors
├── TODO.md                # Open work items
├── COMPLETED.md           # Finished items (verbatim from TODO.md)
└── FUTURE_WORK.md         # Long-horizon / deferred items
```

Canvas: **336 × 262 px** (RCade standard).

---

## Deployment

Push to `main` → GitHub Actions auto-deploys via `.github/workflows/deploy.yaml`.
Requires GitHub username linked to RC profile at recurse.com/settings/general.

---

Made with <3 at [The Recurse Center](https://recurse.com)
