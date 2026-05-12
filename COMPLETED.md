# Completed

Finished TODO items moved **verbatim** from `TODO.md` per the TODO↔COMPLETED convention. Ordering: most recent at top.

---

## D-INTERVIEW-1 — Full game design / scope interview *(2026-05-12)*

- **Type**: Design interview (requires `AskUserQuestion` before any implementation).
- **Deps**: None — this gates all gameplay implementation items.
- **Rationale**: The core game concept is defined but many mechanics are ambiguous, involve tradeoffs, or are explicitly undecided. All open questions must be locked via interview before code is written.

### Locked spec (2026-05-12 interview)

#### Field & View
- **View**: Single shared 336×262 canvas. Both players see the full field simultaneously.
- **Field topology**: Ships fly on a fully shared canvas. The Voronoi zone boundary is the live-computed **perpendicular bisector** of the two ships' positions (toroidal distance for canvas wrap). Ships cannot cross the boundary — the live bisector keeps each ship on its own side. Asteroids and bullets cross the boundary freely. Full canvas wrap for all entities (classic Asteroids behavior).

#### Voronoi Zone Visualization
- Faint background tint (blue = P1 zone, red = P2 zone) + a visible solid boundary line.
- **During time travel**: Two boundary lines rendered simultaneously:
  - **Solid line**: computed from `midpoint(opponent@present, self@last-present-position)`.
  - **Dashed line**: computed from `midpoint(opponent@present, self@current-ghost-position)`. Shifts as the player scrubs.

#### Time Travel — Vim Undo Tree
- Each zone maintains a **Vim-style undo tree**: every recorded state is preserved in a branching tree; no state is ever discarded until the ring buffer depth is exceeded.
- Each zone has its **own independent clock** (tick pointer into the undo tree). The two zones can be at different ticks simultaneously.
- **Ring buffer depth**: `REWIND.HISTORY_TICKS` = 3600 ticks (60 s at 60 fps). Fixed-size arrays.
- **Spinner granularity**: `REWIND.TICKS_PER_SPIN` = 12. Each spinner notch advances or rewinds 12 game ticks. Visual lerp smooths multi-tick sweeps.
- **Branch traversal**: most-recently-visited branch (Vim `Ctrl+R` default).
- **FF at frontier**: seamlessly exits time-travel mode, rejoins live present, and applies a velocity boost in the ship's current facing direction. Boost magnitude ∝ scrub speed at the moment of return, capped at `REWIND.MAX_BOOST_SPEED`.
- **Rewind**: no velocity side-effect. Costs energy.
- Both rewind and fast-forward cost energy; cannot time-travel at 0 energy.

#### Energy System
- Both rewind and fast-forward consume `ENERGY.COST_PER_TICK` per spinner tick.
- Total capacity: ~60 s of travel when full.
- Passive regen: **2:1 ratio** — 1 s of time-travel takes 2 s to refill.
- Regen pauses during active time-travel.

#### Zone Membership (for rewind)
- **Zone-positional**: at each rewind step, any object currently inside a zone's Voronoi cell gets its state rewound.
- **Hybrid lock rule**: objects already being rewound keep their zone assignment; objects freshly entering the zone during an active rewind snap to the new zone.

#### Cross-Zone Bullets During Time Travel
- A bullet entering P1's zone interacts with P1's **current time-state** (whatever tick P1's zone is at). It can hit asteroids that have been "resurrected" by P1's rewind.
- Once a bullet crosses the zone boundary it belongs to that zone and is controlled by that zone's spinner only. The original owner cannot rewind it.

#### Asteroid Split + Rewind
- Only the split child **currently inside** the zone is rewound. Cross-zone children are unaffected by the other zone's spinner.

#### Both Players Rewound Simultaneously
- Each zone is fully independent. The solid Voronoi boundary divides clock domains. An object crossing the boundary transitions to the clock of the zone it enters.

#### Shadow Ship (during time travel)
- When a player is rewound, their ghost ship **deflects bullets** (bullet velocity reversed or scattered) but **cannot take HP damage**.
- Ghost renders semi-transparent at the rewound position.

#### HP System
- **10 HP** per player.
- All hits deal **1 damage** (asteroid hit anywhere, or opponent's bullet in your zone).
- **HP is zone state** — fully rewindable. Rewinding past a hit restores the HP; creating a new branch that avoids the hit makes the recovery permanent.
- Win condition: first player to 0 HP loses. No time limit.

#### Ship Physics
- Rotation: D-pad left/right. D-pad up/down unused for movement.
- Thrust: `A` button fires in ship facing direction. **Newtonian momentum** — no drag.
- All numeric values (rotation speed, max speed, etc.) in `src/constants.json`.

#### Asteroids
- **Global spawn** at random canvas edges. Drift freely across both zones.
- **3 tiers**: Large → 2 Medium → 2 Small → destroyed (one hit per tier).
- **Static difficulty**: no wave progression.

#### Weapons
- Single bullet per shot, instant fire, short cooldown (`BULLET.COOLDOWN` ticks).
- **Fixed lifetime** (`BULLET.LIFETIME` ticks). Does not wrap at canvas edges.
- Bullets cross the Voronoi boundary freely.

#### Visual / Audio
- Placeholder geometry: ships = triangles, asteroids = filled polygons/circles, bullets = small dots.
- Voronoi zone tint + solid boundary line; dashed ghost boundary during time travel.
- Silence for v1 prototype.

#### Constants File
- All game constants in **`src/constants.json`** (plain JSON, `import CONSTANTS from './constants.json'`).
- Zero magic numbers in `src/`. Domain keys: `CANVAS`, `SHIP`, `BULLET`, `ASTEROID`, `REWIND`, `ENERGY`, `HP`.

---

## T-00 — Update rcade.manifest.json to include spinner dependency *(2026-05-12)*

- **Deps**: None.
- **Rationale**: `@rcade/plugin-input-spinners` is installed in `package.json` but the `rcade.manifest.json` currently only lists `@rcade/input-classic`. The cabinet needs the manifest to declare both.
- **Acceptance**: `rcade.manifest.json` `dependencies` array contains both `@rcade/input-classic` and `@rcade/input-spinners` entries; `npm run dev` still starts cleanly.

---

## Infrastructure setup *(2026-05-12)*

- Created `scripts/` directory with `dev.sh`, `build.sh`, `lint.sh`, `test.sh` (all using `n exec stable npm/npx`).
- Installed `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`; created `eslint.config.js`.
- Created `references/` with `rcade_readme.md`, `p5js_api_cheatsheet.md`, `session_handoff_convention.md`, `design_interview_convention.md`.
- Created `CLAUDE.md`, `TODO.md`, `COMPLETED.md`, `FUTURE_WORK.md`.
- Updated `README.md` with project overview and development workflow.
