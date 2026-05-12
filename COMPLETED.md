# Completed

Finished TODO items moved **verbatim** from `TODO.md` per the TODO↔COMPLETED convention. Ordering: most recent at top.

---

## T-14 — HUD (`src/hud.ts`) *(2026-05-12)*

- **Deps**: T-11, T-12.
- **Rationale**: Players need to see HP, energy, and time-travel offset to make game decisions.
- **Acceptance**:
  - **Layout**: top strip, full 336px width. Height = `CANVAS.HUD_STRIP_HEIGHT` (14px). P1 elements left-aligned within [0, 160px]; P2 elements right-aligned within [176px, 336px]. 16px center gap.
  - **HP bar**: 10 equal horizontal segments. Filled segments = remaining HP. P1 = blue; P2 = red. Depleted segments = darker shade (same hue at 30% brightness).
  - **Energy bar**: horizontal bar directly below HP bar within the strip. Fill = `energyFraction`. Same blue/red color as HP bar.
  - **Clock offset label**: visible **only while zone is in time-travel mode**. Drawn to the right of P1's energy bar (or left of P2's). Font: p5.js default monospace at `textSize(CANVAS.HUD_FONT_SIZE)`. Format: `"−5.3s"` (always negative — fast-forwarding to the frontier exits time-travel, so a non-negative offset is impossible during time-travel mode). Offset = `(presentTick − zoneTick) / 60.0` seconds, `toFixed(1)`. The label is hidden when `zoneTick === presentTick`.
  - All elements remain within the top `CANVAS.HUD_STRIP_HEIGHT` px of the canvas.
  - HUD drawn on top of all field entities (last in draw order, per T-02).

### Clarifications (2026-05-12 interview)

- `CANVAS.HUD_FONT_SIZE = 8` stored in constants.json (zero magic numbers rule).
- P1 side: HP bar row 1, energy bar row 2, clock label row 2 (right of energy bar) — all left-aligned.
- P2 side: HP bar row 1, energy bar row 2, clock label row 2 (left of energy bar) — all right-aligned.

### Tests

- Clock offset: `presentTick=1000, zoneTick=680` → label `"−5.3s"`.
- Clock offset: `presentTick=1000, zoneTick=1000` → label hidden (not in time-travel mode).
- Clock offset: `presentTick=1000, zoneTick=940` → label `"−1.0s"`.
- HP bar segments: `hp=7` → `filledSegments=7`, `depletedSegments=3`.
- HP bar segments: `hp=0` → all 10 segments depleted.
- HP bar segments: `hp=10` → all 10 segments filled, 0 depleted.

---

## T-13 — Input wiring (`src/input.ts`) *(2026-05-12)*

- **Deps**: T-02, T-03, T-07, T-10, T-12.
- **Rationale**: Single module that reads all RCade plugin inputs each frame and dispatches to the appropriate game systems.
- **Acceptance**:

  **Plugin imports (exact)**:
  ```typescript
  import { PLAYER_1, PLAYER_2, SYSTEM } from "@rcade/plugin-input-classic";
  import { PLAYER_1_SPINNER, PLAYER_2_SPINNER } from "@rcade/plugin-input-spinners";
  ```

  *(Implementation note: actual installed `@rcade/plugin-input-spinners` v0.2.3 exports `PLAYER_1` / `PLAYER_2` with `.SPINNER.consume_step_delta()` rather than `PLAYER_N_SPINNER.delta`. The implementation aliases the imports as `PLAYER_1_SPIN` / `PLAYER_2_SPIN` to avoid a name collision with the classic plugin's `PLAYER_1`/`PLAYER_2`.)*

  **Per-frame dispatch**:
  | Input | API | Action |
  |-------|-----|--------|
  | P1 D-pad left | `PLAYER_1.DPAD.left` | rotate P1 ship left |
  | P1 D-pad right | `PLAYER_1.DPAD.right` | rotate P1 ship right |
  | P1 D-pad up | `PLAYER_1.DPAD.up` | unused — no effect |
  | P1 D-pad down | `PLAYER_1.DPAD.down` | unused — no effect |
  | P1 A button | `PLAYER_1.A` | thrust P1 ship |
  | P1 B button | `PLAYER_1.B` | fire P1 bullet (level-triggered, cooldown-gated) |
  | P1 Spinner | `PLAYER_1_SPINNER.delta` | time-travel P1 zone (`delta × TICKS_PER_SPIN` steps) |
  | P2 D-pad left | `PLAYER_2.DPAD.left` | rotate P2 ship left |
  | P2 D-pad right | `PLAYER_2.DPAD.right` | rotate P2 ship right |
  | P2 D-pad up | `PLAYER_2.DPAD.up` | unused — no effect |
  | P2 D-pad down | `PLAYER_2.DPAD.down` | unused — no effect |
  | P2 A button | `PLAYER_2.A` | thrust P2 ship |
  | P2 B button | `PLAYER_2.B` | fire P2 bullet (level-triggered, cooldown-gated) |
  | P2 Spinner | `PLAYER_2_SPINNER.delta` | time-travel P2 zone |
  | `SYSTEM.ONE_PLAYER` | `SYSTEM.ONE_PLAYER` | P1 ready signal in lobby (edge-triggered) |
  | `SYSTEM.TWO_PLAYER` | `SYSTEM.TWO_PLAYER` | P2 ready signal in lobby / return-to-lobby from game-over (edge-triggered) |

  - No direct `keydown` event listeners anywhere in `src/` — all input via the RCade plugins.
  - `SYSTEM.ONE_PLAYER` and `SYSTEM.TWO_PLAYER` are ignored during `PLAYING` state.

### Tests

- **Edge-detection — single fire**: `SYSTEM.ONE_PLAYER` held for 5 consecutive frames → exactly 1 ready-state change, not 5.
- **Edge-detection — re-press**: `SYSTEM.ONE_PLAYER` released then pressed again after transitioning to LOBBY → fires a second state change.
- **State-gating — P1 thrust ignored in LOBBY**: with game state = `LOBBY`, dispatch `PLAYER_1.A = true` → no velocity change on P1 ship.
- **State-gating — ONE_PLAYER ignored in PLAYING**: with game state = `PLAYING`, dispatch `SYSTEM.ONE_PLAYER = true` → no state transition.
- **State-gating — TWO_PLAYER ignored in PLAYING**: with game state = `PLAYING`, dispatch `SYSTEM.TWO_PLAYER = true` → no state transition (does not trigger GAME_OVER → LOBBY).

---

## T-12 — Win condition / game state machine (`src/game.ts`) *(2026-05-12)*

- **Deps**: T-03, T-08, T-09.
- **Rationale**: Owns the LOBBY / PLAYING / GAME_OVER state machine. Checks HP, triggers game-over, handles lobby ready state and hold-to-restart.
- **Acceptance**:

  **LOBBY state**:
  - Black background with game title text and a dynamic per-player readiness prompt.
  - Tracks whether P1 has pressed `SYSTEM.ONE_PLAYER` (edge-triggered) and P2 has pressed `SYSTEM.TWO_PLAYER` (edge-triggered) during this lobby session.
  - Prompt text (centered in canvas):
    - Neither pressed: `"P1: press 1   P2: press 2"`
    - P1 ready only: `"P1: ✓   P2: press 2"`
    - P2 ready only: `"P1: press 1   P2: ✓"`
  - Transition to `PLAYING` when both have pressed. Reset ready flags on entry to lobby.

  **PLAYING state**:
  - After any HP deduction (via T-08), if damaged player's HP ≤ 0 → transition to `GAME_OVER`.
  - HP is zone state — rewindable. HP deduction only fires if the zone's current tick reflects the hit (T-09 snapshot HP).
  - `SYSTEM.ONE_PLAYER` and `SYSTEM.TWO_PLAYER` completely ignored during `PLAYING`.

  **GAME_OVER state**:
  - "P1 WINS" or "P2 WINS" text centered on canvas. Game field still visible behind it (frozen at final state).
  - **Hold-to-restart** not present here — `SYSTEM.TWO_PLAYER` press (edge-triggered) transitions to `LOBBY`.
  - `SYSTEM.ONE_PLAYER` ignored in `GAME_OVER`.

### Tests

- HP deduction to 0 → state transitions to `GAME_OVER`.
- HP deduction to 1 → state remains `PLAYING`.
- `SYSTEM.TWO_PLAYER` press in `GAME_OVER` → state transitions to `LOBBY`, ready flags reset.
- Lobby: P1 presses 1, then P2 presses 2 → game starts.
- Lobby: P2 presses 2 alone → game does not start (P1 not ready).

---

## T-11 — Energy system (`src/energy.ts`) *(2026-05-12)*

- **Deps**: T-01.
- **Rationale**: Limits time-travel depth to ~60 seconds. Passive 2:1 regen. Clean float accounting.
- **Acceptance**:
  - `energy` clamped to `[0, ENERGY.MAX]`.
  - Each spinner tick costs `ENERGY.COST_PER_TICK` (same for both rewind and fast-forward).
  - When not time-traveling, passive regen at `ENERGY.REGEN_PER_TICK` per game tick. Regen pauses during active time-travel (any frame where `|delta| > 0`).
  - Energy = 0: spinner input blocked, time-travel cannot be initiated.
  - Exposes `energyFraction` (float 0–1) for HUD.

### Property tests (Vitest + fast-check)

- **Energy accounting**: after N spinner ticks each costing `COST_PER_TICK`, total deducted = exactly `N × COST_PER_TICK`. No floating-point drift over 3600 ticks.

### Unit tests

- Energy never exceeds `ENERGY.MAX` after regen.
- Energy never goes below 0 after deduction.
- After full depletion, regen for `ENERGY.MAX / ENERGY.REGEN_PER_TICK` ticks returns energy to `ENERGY.MAX`.

---

## T-10 — Spinner time-travel controller (`src/time-travel.ts`) *(2026-05-12)*

- **Deps**: T-09, T-04, T-11.
- **Rationale**: Maps spinner delta to undo-tree traversal. Handles FF-at-frontier boost and dual-zone boundary midpoints.
- **Acceptance**:
  - **Spinner mapping**: each frame, read `PLAYER_N_SPINNER.delta`. Traverse `|delta| × REWIND.TICKS_PER_SPIN` steps in the undo tree (negative delta = rewind, positive delta = fast-forward). If `delta = 0`, no traversal. Energy deducted: `|delta| × TICKS_PER_SPIN × ENERGY.COST_PER_TICK`.
  - **Energy at zero**: traversal stops immediately at the current tree node. No forced return to present. No boost.
  - **No sub-tick lerp**: the renderer always displays the exact snapshot at `current` node. No visual interpolation between snapshots.
  - **FF-at-frontier**: whenever `fastForward` returns fewer steps than requested (frontier reached), exit time-travel mode, re-join live present, apply velocity boost:
    - `boost = REWIND.FF_BOOST_SCALE × (spinnerDeltaTicksThisFrame / REWIND.TICKS_PER_SPIN)`, capped at `REWIND.MAX_BOOST_SPEED`.
    - Applied in ship's current facing direction.
    - Fires **always** when the frontier is reached, regardless of how it was reached (continuous spin or incremental).
  - **Zone membership**: zone-positional (zone-center rule) at each rewind step. In-progress rewinds preserve existing zone assignment; objects newly crossing the boundary snap to the new zone.
  - **Boundary midpoints** exposed for T-05:
    - `solidBoundaryMidpoint`: `midpoint(opponentGhostOrPresent, selfLastPresentPos)`
    - `ghostBoundaryMidpoint`: `midpoint(opponentGhostOrPresent, selfGhostPos)`
    - "opponentGhostOrPresent" = opponent's ghost position if opponent is also in time-travel mode; else opponent's live present position.

### Tests

- Spinner delta = 2: tree traverses exactly `2 × TICKS_PER_SPIN` steps.
- Energy deducted = `|delta| × TICKS_PER_SPIN × COST_PER_TICK` per frame.
- Energy hits 0 mid-traversal: partial traversal, no forced return.
- FF boost = 0 when `spinnerDeltaTicksThisFrame = 0` (no movement this frame, but frontier was already there from prior frame).
- `solidBoundaryMidpoint` unchanged while rewinding (anchored to lastPresentPos).
- `ghostBoundaryMidpoint` shifts each step as ghost position updates.
- Dual-rewind: when both zones are rewound, `opponentGhostOrPresent` = opponent's ghost position.

---

## T-09 — Zone undo tree (`src/zone-history.ts`) *(2026-05-12)*

- **Deps**: T-03, T-06, T-07.
- **Rationale**: Core data structure for Vim-style time travel. Branching tree of zone snapshots with fixed-depth ring buffer.
- **Acceptance**:
  - A snapshot contains all objects whose **center** is inside the zone's Voronoi cell at snapshot time: `{ shipState, asteroids[], bullets[], hp }`.
  - **Ring buffer = total node pool of 3600**: the zone maintains a fixed pool of at most `REWIND.HISTORY_TICKS` nodes shared across all branches. When the pool is full and a new node is added, the oldest node (by insertion order) is freed and its subtree becomes unreachable. Branches do reduce effective per-branch rewind depth — the 3600 budget is shared.
  - Node structure: `{ snapshot, parent, children[], lastVisitedChildIndex }`. `current` pointer tracks active node.
  - **`recordTick(snapshot)`**: **Vim undo behavior** — always appends a new child to `current` regardless of whether `current` is at the frontier or a rewound node. Updates `current` to the new child. Creates a branch if `current` had children. If at ring buffer capacity, discards the root node. `lastVisitedChildIndex` at the parent updated to point to the newly added child.
  - **`rewind(n)`**: moves `current` n steps toward root. If a node has multiple children (ambiguous forward path), `lastVisitedChildIndex` records which child to revisit on next fast-forward.
  - **`fastForward(n)`**: moves `current` n steps toward the most-recently-visited child (`lastVisitedChildIndex`). Returns actual steps taken (≤ n if frontier reached early).
  - **`atFrontier()`**: returns `true` when `current.children.length === 0`.

### Property tests (Vitest + fast-check)

- **Reversibility** *(precondition: no `recordTick` called between `rewind` and `fastForward`)*: for all `n ∈ [1, current depth]`, `rewind(n)` then `fastForward(n)` returns to the exact same node.
- **Snapshot completeness**: every object passed to `recordTick` appears exactly once in the stored snapshot (no duplicates, no missing items).
- **Pool invariant**: after recording `HISTORY_TICKS + k` nodes (any k > 0, across any branching pattern), total live node count in the pool = `HISTORY_TICKS`.

### Unit tests

- **Branch-point fastForward**: after `rewind(3)` + `recordTick(newSnapshot)`, `fastForward(1)` from the branch point follows the **new branch** (returns the node added by `recordTick`), not the old frontier.
- `lastVisitedChildIndex` at the branch point updated to new branch after `recordTick`.
- `atFrontier()` returns `true` on a freshly appended node (no children), `false` when `current` has children.
- After recording exactly `HISTORY_TICKS + 1` nodes in a straight line, the root node is no longer reachable; `rewind(HISTORY_TICKS)` from the frontier reaches the new root (not the original root).

---

## T-08 — Collision detection (`src/collision.ts`) *(2026-05-12)*

- **Deps**: T-03, T-06, T-07, T-04.
- **Rationale**: Determines damage, splits, and despawns. All checks use each object's state at their zone's current tick.
- **Acceptance**:
  - **Bullet–asteroid**: `dist(bullet.center, asteroid.center) < bullet.radius + asteroid.tier_radius` → asteroid splits (T-06 split logic), bullet removed.
  - **Bullet–live ship**: same circle overlap → ship loses 1 HP, bullet removed.
  - **Bullet–ghost ship**: circle overlap → bullet **despawned** (removed from state). No HP damage.
  - **Asteroid–live ship**: `dist < asteroid_radius + SHIP.COLLISION_RADIUS` → ship loses 1 HP, asteroid removed (not split).
  - **Asteroid–ghost ship**: circle overlap → asteroid **despawned**. No HP damage.
  - **Zone membership for collision**: each object is checked only against entities in the same zone's current snapshot. A bullet in zone A can only hit asteroids/ships recorded in zone A's current snapshot. Objects across zones do not interact unless they share a zone snapshot at that tick.
  - All collision logic is **pure functions** of snapshot state — no global mutation inside `collision.ts`.

### Tests

- `dist(centers) === sum of radii`: no collision (strict `<`).
- `dist(centers) = sum of radii - 0.1`: collision triggers.
- Ghost ship + bullet → bullet removed, ship HP unchanged.
- Ghost ship + asteroid → asteroid removed, ship HP unchanged.
- Asteroid + live ship → HP decreases by 1, asteroid removed.
- **Cross-zone isolation (simulated rewind)**: build a mini scenario where P1 is rewound to tick 50 (P1 zone snapshot contains asteroidX) and P2 is at tick 100 (P2 zone snapshot contains a bullet aimed at asteroidX's position). Run `collisionDetect(p2ZoneSnapshot)`; assert asteroidX is not examined and its state is unchanged.

---

## T-07 — Bullet system (`src/bullet.ts`) *(2026-05-12)*

- **Deps**: T-03.
- **Rationale**: Player weapon. Fixed lifetime, no canvas wrapping, hard count cap, level-triggered fire.
- **Acceptance**:
  - **Level-triggered**: each frame that B is held **and** cooldown has expired **and** active bullet count < `BULLET.MAX_COUNT`, fire one new bullet. Cooldown timer resets on each fired bullet.
  - Bullet spawns at the ship's **nose position** (`SHIP.NOSE_DIST` px from center in facing direction). Velocity = `BULLET.SPEED` px/tick in ship's facing direction (absolute — ship velocity not added).
  - Bullet expires after `BULLET.LIFETIME` ticks.
  - Bullets do **not** wrap — removed when center exits the canvas (`x < 0`, `x > CANVAS.WIDTH`, `y < 0`, `y > CANVAS.HEIGHT`).
  - **Hard cap**: max `BULLET.MAX_COUNT` (3) bullets per player simultaneously. B held at cap has no effect until a bullet expires or exits.
  - State serializable: `{ x, y, vx, vy, ticksRemaining, owner }`.

### RCade API note

`PLAYER_1.B` is `true` every frame while the key is held (level-triggered by the plugin). No edge detection needed in `bullet.ts` — the cooldown gate provides the shot-rate limit.

### Tests

- Bullet position advances by exactly `BULLET.SPEED` px/tick along firing direction.
- Bullet removed exactly at `BULLET.LIFETIME` ticks.
- Firing at cap (3 active bullets): no new bullet created.
- Firing before cooldown expires: no new bullet created.
- Bullet at canvas edge removed on the tick it exits.
- Holding B with cooldown = 0: fires exactly once per `BULLET.COOLDOWN` ticks.

---

## T-06 — Asteroid system (`src/asteroid.ts`) *(2026-05-12)*

- **Deps**: T-02.
- **Rationale**: Core obstacle. Three-tier split behavior. Fixed pool, global spawn, free drift.
- **Acceptance**:
  - **Fixed pool**: always maintain exactly `ASTEROID.POOL_SIZE` (4) large asteroids. When a large asteroid is destroyed (despawned or split into medium children), immediately spawn a replacement large asteroid from a random canvas edge.
  - **Spawn position**: center placed **one tier-radius outside the canvas edge** so the asteroid is fully off-screen at spawn. It then drifts inward.
  - **Spawn direction**: velocity aimed toward the canvas center (point `(CANVAS.WIDTH/2, CANVAS.HEIGHT/2)`) within a random cone of ±`ASTEROID.SPAWN_ANGLE_SPREAD` degrees. Speed uses the **deterministic tier formula** (see Drift).
  - **Drift**: constant velocity, wrapping at canvas edges. Speed is **deterministic per tier** using the inverse-radius formula:
    - `speed(r) = SPEED_MIN + (SPEED_MAX − SPEED_MIN) × (1 − r / ASTEROID.LARGE_RADIUS)`
    - Large (r=28): 0.5 px/tick. Medium (r=16): ≈0.93 px/tick. Small (r=8): ≈1.21 px/tick.
    - This formula only applies to **newly spawned large asteroids**. Split children inherit the parent's speed (direction changes; magnitude preserved — see Split behavior).
  - **Split behavior** (bullet hit):
    - Asteroid destroyed; two children of the next smaller tier spawned.
    - Each child center = parent center ± `(parent_radius × SPLIT_OFFSET_FRACTION)` along the axis perpendicular to parent velocity.
    - Each child velocity = parent velocity rotated ±`SPLIT_DIVERGE_ANGLE` degrees plus ±`SPLIT_RANDOM_SPREAD` degrees of additional random spread. **Speed magnitude is inherited from the parent** (not recalculated from tier formula).
    - Small tier on bullet hit: destroyed with no children.
  - Asteroids draw as irregular polygons (6–9 vertices at random radii 80–120% of tier radius). Polygon shape generated at spawn, stored in state, unchanged thereafter.
  - State serializable: `{ x, y, vx, vy, tier, vertices[] }`.

### Tests

- Splitting a large asteroid produces exactly 2 medium children.
- Each child's speed equals the parent's speed (not the tier formula result for medium radius).
- Split children: each child velocity direction differs from parent by exactly `±SPLIT_DIVERGE_ANGLE ± [0, SPLIT_RANDOM_SPREAD]` degrees.
- Splitting a small asteroid produces 0 children.
- **Pool invariant (property test, fast-check)**: for any sequence of split and ghost-despawn events, large asteroid count is always exactly `POOL_SIZE`. Both split and ghost-despawn of a large asteroid trigger an immediate replacement spawn.
- Spawn position: new large asteroid center is exactly `LARGE_RADIUS` px outside the chosen edge.
- Spawn direction: velocity vector points within ±`SPAWN_ANGLE_SPREAD`° of the canvas center.
- Spawn speed (large): `SPEED_MIN` px/tick (formula with r=LARGE_RADIUS gives exactly SPEED_MIN).
- Spawn speed formula: `speed(MEDIUM_RADIUS)` ≈ 0.929 px/tick; `speed(SMALL_RADIUS)` ≈ 1.214 px/tick.

---

## T-05 — Zone renderer (`src/zone-renderer.ts`) *(2026-05-12)*

- **Deps**: T-04.
- **Rationale**: Visualizes zone ownership and boundary. Shows two boundaries during time travel.
- **Acceptance**:
  - **Zone tint**: drawn as a polygon per zone using p5's `beginShape` / `vertex` / `endShape`. For each zone, the polygon vertices are: `[ep1, …canvas corners belonging to that zone in clockwise traversal order…, ep2]`. Canvas corners are assigned to a zone by `pointInZone(corner, p1, p2)`. Clockwise traversal: starting from `ep1`, walk the canvas boundary clockwise (top-right corner → bottom-right → bottom-left → top-left), collecting only corners that belong to the current zone, then close with `ep2`. This correctly covers any bisector angle (diagonal, horizontal, vertical). P1 side: blue fill with `alpha = CANVAS.ZONE_TINT_ALPHA`. P2 side: red fill with same alpha.
  - **Solid boundary line**: 1px white line between the two boundary endpoints.
  - **Time-travel boundary (single zone rewound)**: draw a second dashed line (6px dash / 4px gap) representing the ghost boundary. `solidBoundaryMidpoint = midpoint(opponentGhostOrPresent, selfLastPresentPos)`. `ghostBoundaryMidpoint = midpoint(opponentGhostOrPresent, selfGhostPos)`. "opponentGhostOrPresent" = opponent's ghost position if opponent is also in time-travel, else opponent's live present position.
  - **Dual time-travel (both zones rewound)**: both solid and dashed lines use ghost positions. Solid = `midpoint(P2_ghost, P1_lastPresent)` from P1's perspective; dashed = `midpoint(P2_ghost, P1_ghost)`. (Mirror for P2's boundary rendering.) In practice a single canonical boundary is drawn using the ghost positions of both sides.
  - Drawn in the correct order per T-02: tints first (behind entities), boundary lines last (in front of entities, behind HUD).

### Clarifications (2026-05-12 interview)

- "opponentGhostOrPresent" rule applies symmetrically: if the opponent is in time-travel, use their ghost position; otherwise use their live present position.

---

## T-04 — Voronoi zone calculator (`src/voronoi.ts`) *(2026-05-12)*

- **Deps**: T-02.
- **Rationale**: Defines the zone boundary as the perpendicular bisector of P1/P2 positions.
- **Acceptance**:
  - `computeZoneBoundary(p1Pos, p2Pos, canvasW, canvasH)`: returns `[endpoint1, endpoint2]` — the two canvas-edge intersection points of the perpendicular bisector of the straight line between P1 and P2. Uses **non-wrapping Euclidean** midpoint (no toroidal correction).
  - `pointInZone(pos, p1Pos, p2Pos)`: returns `1` or `2`. Uses Euclidean distance — returns `1` if `dist(pos, p1) < dist(pos, p2)`, else `2`. Ties (equal distance) deterministically return `1`.
  - Ships cannot cross the boundary — zone-boundary clamping enforced in T-03 ship update.
  - Exported for use by T-03 (clamping), T-05 (rendering), T-08 (collision zone checks), T-09 (snapshot zone membership), T-10 (boundary midpoints).

### Tests

- **Zone symmetry** (property): `pointInZone(A, p1, p2) !== pointInZone(A, p2, p1)` for all A where `dist(A,p1) ≠ dist(A,p2)`.
- `pointInZone(p1, p1, p2) === 1`; `pointInZone(p2, p1, p2) === 2`.
- Degenerate: `p1 === p2` must not throw; entire canvas is zone 1.
- `computeZoneBoundary` endpoints each lie exactly on a canvas edge (`x ∈ {0, canvasW}` or `y ∈ {0, canvasH}`).
- Midpoint of the two boundary endpoints is equidistant from both ships.

---

## T-03 — Ship entity (`src/ship.ts`) *(2026-05-12)*

- **Deps**: T-02.
- **Rationale**: Core player-controlled object. Newtonian physics with soft speed cap, rotation, canvas wrap, zone-boundary clamping.
- **Acceptance**:
  - **Triangle geometry**: elongated. Nose vertex at `(cos(angle) × SHIP.NOSE_DIST, sin(angle) × SHIP.NOSE_DIST)` from center. Two flank vertices at `SHIP.FLANK_DIST` px from center at `angle ± SHIP.FLANK_ANGLE` degrees.
  - **Rotation**: D-pad left/right rotates by `SHIP.ROTATION_SPEED` degrees/tick while held. Both held simultaneously → no rotation.
  - **Thrust (A button)**: level-triggered — adds `SHIP.THRUST_ACCEL` px/tick² in facing direction each frame A is held.
  - **Soft speed cap**: when `|velocity| > SHIP.MAX_SPEED`, multiply velocity by `SHIP.DRAG_FACTOR` each tick. No drag at or below `MAX_SPEED`.
  - **Canvas wrap**: when ship center exits one edge it re-enters from the opposite edge.
  - **Zone boundary clamping**: after applying physics, if the ship has crossed the Voronoi boundary, clamp its position to the boundary and zero out the velocity component perpendicular to the boundary (tangential component preserved — ship slides along boundary).
  - D-pad up/down: completely unused, no binding, no effect.
  - Ghost rendering: when the zone is in time-travel mode, draw the ship at the ghost position with alpha = `SHIP.GHOST_ALPHA`.
  - Ship state serializable: `{ x, y, vx, vy, angle, hp }`.

### Tests

- Thrust below max speed: no drag applied; velocity accumulates linearly.
- Thrust above max speed: drag `SHIP.DRAG_FACTOR` applied each tick; speed asymptotically approaches `MAX_SPEED`.
- Canvas wrap: ship at `x = CANVAS.WIDTH + 1` wraps to `x = 1`.
- Both D-pad directions held: no rotation (net 0).
- Boundary clamp: ship that crosses boundary is repositioned to boundary; perpendicular velocity component is 0 post-clamp; tangential component unchanged.

---

## T-02 — Scaffold main p5 sketch (`src/main.ts`) *(2026-05-12)*

*(Implementation note: scaffold lives in `src/sketch.ts` rather than `src/main.ts` to avoid churn in `index.html`. The LOBBY/PLAYING/GAME_OVER state machine, plugin imports, edge-triggered ready flags, and frame-rate setup are all in place. Per-frame wiring of wave 2–6 modules into the draw loop remains as integration work.)*

- **Deps**: T-01.
- **Rationale**: Entry point for the game. Sets up p5 instance mode, canvas, game loop, plugin initialization, and lobby/game state machine.
- **Acceptance**: `npm run dev` shows a 336×262 canvas. Lobby screen visible by default. No console errors. `@rcade/plugin-input-classic` and `@rcade/plugin-input-spinners` initialized.

### RCade plugin API (from `references/rcade_readme.md`)

```typescript
import { PLAYER_1, PLAYER_2, SYSTEM } from "@rcade/plugin-input-classic";
import { PLAYER_1_SPINNER, PLAYER_2_SPINNER } from "@rcade/plugin-input-spinners";

// PLAYER_1.DPAD.up / .down / .left / .right  — boolean, true while held
// PLAYER_1.A  — boolean, true while held
// PLAYER_1.B  — boolean, true while held
// PLAYER_1_SPINNER.delta  — number (positive = right, negative = left)
// SYSTEM.ONE_PLAYER — boolean (key 1 in dev; P1 start button on cabinet)
// SYSTEM.TWO_PLAYER — boolean (key 2 in dev; P2 start button on cabinet)
```

Spinners repeat at ~60 Hz while held; each held frame produces `delta = ±1` from the keyboard emulator.

### State machine

The main game loop has three top-level states:

1. **`LOBBY`** — initial state on page load.
2. **`PLAYING`** — active game.
3. **`GAME_OVER`** — post-match screen.

Transitions:
- `LOBBY → PLAYING`: when both `SYSTEM.ONE_PLAYER` **and** `SYSTEM.TWO_PLAYER` have each been pressed (edge-triggered) at least once during the current lobby session.
- `PLAYING → GAME_OVER`: when either player's HP ≤ 0 (T-12).
- `GAME_OVER → LOBBY`: `SYSTEM.TWO_PLAYER` press (edge-triggered).

### Clarifications (2026-05-12 interview)

- **Target frame rate**: 60 fps (p5 `frameRate(60)` in `setup()`). All tick values assume 60 fps.
- **Initial positions**: P1 at `(SHIP.START_P1_X, SHIP.START_P1_Y)` facing `START_ANGLE_P1`; P2 at `(SHIP.START_P2_X, SHIP.START_P2_Y)` facing `START_ANGLE_P2`. Fixed every game.
- **Canvas background**: black (`background(0)`) drawn at the start of each `draw()` call.

### Draw order (every frame, in this exact sequence)

1. `background(0)` — clear canvas
2. Zone tints (T-05)
3. Asteroids (T-06)
4. Bullets (T-07)
5. Live ships (T-03)
6. Ghost ships, if any zone is in time-travel (T-03 / T-10)
7. Zone boundary lines (T-05)
8. HUD (T-14)

---

## T-01 — Create `src/constants.json` *(2026-05-12)*

- **Deps**: None — must exist before any gameplay code is written.
- **Rationale**: CLAUDE.md convention requires all game constants in `src/constants.json`. Bootstrap with all values locked across both interview sessions.
- **Acceptance**: `src/constants.json` exists with the exact structure below. TypeScript imports verified with `import CONSTANTS from './constants.json'`. Zero magic numbers anywhere in `src/`.

### Locked constant values (2026-05-12 interviews)

```json
{
  "CANVAS": {
    "WIDTH": 336,
    "HEIGHT": 262,
    "HUD_FONT_SIZE": 8,
    "HUD_STRIP_HEIGHT": 14,
    "ZONE_TINT_ALPHA": 30
  },
  "SHIP": {
    "ROTATION_SPEED": 3,
    "THRUST_ACCEL": 0.1,
    "MAX_SPEED": 4,
    "DRAG_FACTOR": 0.95,
    "COLLISION_RADIUS": 8,
    "NOSE_DIST": 16,
    "FLANK_DIST": 6,
    "FLANK_ANGLE": 150,
    "GHOST_ALPHA": 128,
    "START_P1_X": 84,
    "START_P1_Y": 131,
    "START_P2_X": 252,
    "START_P2_Y": 131,
    "START_ANGLE_P1": 0,
    "START_ANGLE_P2": 180
  },
  "BULLET": {
    "SPEED": 6,
    "LIFETIME": 60,
    "COOLDOWN": 20,
    "MAX_COUNT": 3,
    "RADIUS": 2
  },
  "ASTEROID": {
    "POOL_SIZE": 4,
    "LARGE_RADIUS": 28,
    "MEDIUM_RADIUS": 16,
    "SMALL_RADIUS": 8,
    "SPEED_MIN": 0.5,
    "SPEED_MAX": 1.5,
    "SPAWN_ANGLE_SPREAD": 30,
    "SPLIT_OFFSET_FRACTION": 0.5,
    "SPLIT_DIVERGE_ANGLE": 20,
    "SPLIT_RANDOM_SPREAD": 5
  },
  "REWIND": {
    "HISTORY_TICKS": 3600,
    "TICKS_PER_SPIN": 12,
    "MAX_BOOST_SPEED": 8,
    "FF_BOOST_SCALE": 2
  },
  "ENERGY": {
    "MAX": 3600,
    "COST_PER_TICK": 1,
    "REGEN_PER_TICK": 0.5
  },
  "HP": {
    "INITIAL": 10
  }
}
```

**Notes on derived values**:
- `ENERGY.MAX = COST_PER_TICK × REWIND.HISTORY_TICKS` (60 s of travel capacity at 60 fps).
- `ENERGY.REGEN_PER_TICK = COST_PER_TICK / 2` (2:1 ratio — 120 s to fully refill).
- Ship triangle: nose vertex at `NOSE_DIST` px ahead of center; two flank vertices at `FLANK_DIST` px from center at ±`FLANK_ANGLE`°.
- `START_ANGLE_P1 = 0` = facing right (toward P2). `START_ANGLE_P2 = 180` = facing left (toward P1).
- `ASTEROID.SPAWN_ANGLE_SPREAD`: random cone half-angle in degrees when spawning; velocity aimed within ±this value of the center-of-canvas direction.
- `SPLIT_DIVERGE_ANGLE`: base rotation applied to parent velocity for each child (± this angle). `SPLIT_RANDOM_SPREAD`: additional ±random degrees added on top.

*(Note: implementation adds the following layout/style constants under `CANVAS` that were not in the original locked block but are required to keep renderer/HUD code magic-number-free: `BOUNDARY_DASH`, `BOUNDARY_GAP`, `TITLE_FONT_SIZE`, `HUD_P1_END_X`, `HUD_P2_START_X`, `HUD_BAR_HEIGHT`, `HUD_ROW_GAP`.)*

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
