# Session Handoff — 2026-05-12 T-01–T-14 implementation

## State at handoff

- Branch/HEAD: `main` @ `777b6df`
- Tests: **107/107 passing** (Vitest + fast-check) across 12 test files
- Lint: clean (`tsc --noEmit` and `eslint src` both exit 0)
- Commits this session: 5 — bootstrap+T01–T07, wave 4, wave 5, wave 6, audit/migration

## What was accomplished

- All 14 locked tasks (T-01 through T-14) implemented in 6 dependency-ordered waves, mostly via parallel Sonnet sub-agents.
- `src/constants.json` plus thirteen TypeScript modules (`sketch`, `ship`, `voronoi`, `zone-renderer`, `asteroid`, `bullet`, `collision`, `zone-history`, `time-travel`, `energy`, `game`, `input`, `hud`) with colocated `*.test.ts` files.
- Property tests (fast-check) for: energy accounting drift, zone-history reversibility, snapshot completeness, pool invariant, asteroid pool invariant.
- One spec-violation fix: `sketch.ts` had hardcoded `16` for title text size — replaced with `CANVAS.TITLE_FONT_SIZE`.
- Full read-only audit comparing each module to TODO.md spec. Findings captured in trimmed TODO.md.
- All 14 task entries migrated verbatim from TODO.md → COMPLETED.md (most-recent-first, dated 2026-05-12).
- `fast-check` added as devDependency; `tsconfig.json` gained `resolveJsonModule` + `esModuleInterop`.
- Decisions locked via single up-front interview: keep `src/sketch.ts` entry point (not `src/main.ts`), ships filled team colors / asteroids wireframe, `CHRONOSTROID` lobby title, install fast-check.

## In-flight / open

**Nothing in-flight.** All sub-agents completed; all commits clean.

The remaining work toward a playable prototype is **integration**, captured concretely in the trimmed `TODO.md`:

1. **`ZoneSnapshot` name collision** — `collision.ts` and `zone-history.ts` both export a type called `ZoneSnapshot` with different shapes. Resolution: rename one (`CollisionSnapshot` is the obvious candidate since `zone-history`'s shape matches the spec wording more closely) and update the one import site.
2. **Boundary-midpoint API overlap** — `time-travel.ts::boundaryMidpoints` returns point-midpoints, `zone-renderer.ts::computeBoundaryMidpoints` returns full boundary endpoint pairs. The game loop needs to pick one path. Simplest: drop `time-travel.ts::boundaryMidpoints` and have the loop pass ship positions directly to `zone-renderer.ts::computeBoundaryMidpoints`.
3. **Ghost-vs-live ship surfacing** — `TimeTravelState.inTimeTravel` + `visibleSnapshot.ship` together give the ghost vs. live answer; add a one-line helper or inline the conditional in `sketch.ts`.
4. **`sketch.ts` placeholder state machine** — currently duplicates `game.ts`. Replace `drawLobby`/`drawGameOver`/state vars with `createGameState()` + `tickLobby`/`tickPlaying`/`tickGameOver` from `game.ts`.
5. **`drawAsteroid` not yet attached** — module exports the function; loop must call it once per asteroid per frame in the spec'd draw order (after zone tints, before live ships).

## Next session starting point

**Read this file plus `TODO.md` cold-start, then run the integration in `src/sketch.ts`.** Below is the planned plan + interview agenda. Per user instruction, **defer all AskUserQuestion interviews to the next session** — the sketch below is the *agenda*, not pre-locked decisions.

### Integration plan (mechanical once decisions are made)

Once the interview lands the open questions, the per-frame loop is:

```
draw():
  background(0)
  systemInput, p1Input, p2Input = readFrame(inputState)
  switch gameState.name:
    case LOBBY:    gameState = tickLobby(gameState, systemInput); drawLobby(p, gameState)
    case PLAYING:
      // 1. Per-zone time-travel resolution
      tt1 = tickTimeTravel(tt1State, p1Input.spinnerDelta)
      tt2 = tickTimeTravel(tt2State, p2Input.spinnerDelta)

      // 2. If a zone is in time travel, use visibleSnapshot for that zone;
      //    otherwise advance live state for that zone:
      //    - update ship (rotate, thrust, wrap, boundary clamp)
      //    - apply FF boost vector if returned
      //    - tickBullets (per player firing state)
      //    - update each asteroid
      //    - resolveCollisions(snapshot) — updates ship.hp, splits asteroids,
      //      culls bullets, despawns asteroids that hit ghost ships
      //    - recordPresent(ttState, fresh snapshot)

      // 3. HP check via tickPlaying → may transition to GAME_OVER

      // 4. Draw in T-02 spec order:
      //    a. zone tints (drawZoneTints with self/other positions — ghost if in TT)
      //    b. asteroids (drawAsteroid)
      //    c. bullets (drawBullet)
      //    d. live ships (drawShip with alpha=255)
      //    e. ghost ships (drawShip with alpha=GHOST_ALPHA) — only if in TT
      //    f. zone boundary lines (drawZoneBoundary; drawDashedBoundary if any TT)
      //    g. HUD (drawHud)
    case GAME_OVER:
      // Freeze field at final state; draw "P1/P2 WINS" overlay; TWO_PLAYER → LOBBY
```

### Interview agenda for the next session

Use `AskUserQuestion` for these. Each is a real design tradeoff that the audit surfaced but I deliberately did not decide alone.

1. **`ZoneSnapshot` rename** — rename `collision.ts::ZoneSnapshot` to `CollisionSnapshot`, OR rename `zone-history.ts::ZoneSnapshot` to `HistorySnapshot`, OR keep both names and rely on import aliasing in `sketch.ts`?
2. **Asteroid ownership during time travel** — TODO design spec says asteroids cross zones freely and "objects already being rewound keep their zone assignment". Per-zone snapshots in `zone-history.ts` store only the asteroids inside the zone *at snapshot time*. When a player rewinds, asteroids in their visible snapshot need to be drawn at their snapshot positions, but asteroids in the other zone keep moving live. How should `sketch.ts` reconcile the per-zone asteroid sets each frame? (Option A: dual asteroid pools, one per zone, with cross-zone handoff at boundary crossings. Option B: one shared global pool with a per-zone "rewound override" overlay that masks the global state inside that zone.)
3. **Bullet ownership during time travel** — symmetric question for bullets. TODO design spec: "once a bullet crosses the zone boundary it belongs to that zone and is controlled by that zone's spinner only." How is "owned by zone" tracked? Is the `owner` field on `BulletState` repurposed for this, or does the snapshot membership do all the work?
4. **Ghost-vs-live render branching** — should the game loop draw both live and ghost ships when a zone is in time travel (the live ship is then somewhere implied by lastPresentSnapshot), OR draw only the ghost ship in that zone? The TODO.md T-03 acceptance says "Ghost rendering: when the zone is in time-travel mode, draw the ship at the ghost position with alpha = GHOST_ALPHA" but doesn't explicitly forbid also drawing the live ship.
5. **Lerp policy reaffirmation** — TODO.md T-10 says "No sub-tick lerp" but the original D-INTERVIEW-1 design notes said "visual lerp smooths multi-tick sweeps". These contradict. The implementation followed the T-10 spec (no lerp). Confirm in the next session that no-lerp is final.
6. **FF boost direction** — "ship's current facing direction" is in `currentSnapshot(history).ship.angle` at frontier-reach. Is that the right ship: the snapshot we just *exited into* (i.e., the live present, frontier of history)? Or the snapshot we *came from* (ghost angle pre-exit)? Implementation uses currentSnapshot post-FF, which is the frontier ship. Confirm.
7. **Browser smoke test** — should the next session install Playwright (already in MCP tool list) and write a smoke test that opens the dev server, takes a screenshot, and verifies the lobby renders? Would catch the wiring regressions that the unit tests can't.
8. **Test-coverage additions** — go through the audit's "suggested test additions" list (in TODO.md) and decide which to actually write. Roughly 25 candidate tests; ~10 are high value.
9. **CI** — `.github/workflows/deploy.yaml` exists in the repo but I never inspected it. Does CI run tests? Should it? Add a `test` job?
10. **D-pad up/down repurposing** — TODO.md spec explicitly says these are unused. The cabinet has them physically; consider future use (shield? brake?). Defer to FUTURE_WORK.md if not addressed now.

### Suggested improvements to project / tests / structure

- **Browser smoke test via Playwright** (per interview Q7).
- **Integration test layer**: Vitest tests today exercise pure modules. None currently drives a fake game loop end-to-end. Add 1–2 "playthrough" integration tests that simulate ~600 ticks of input and assert no exceptions / consistent state.
- **A real `Vec2` shared type** — `voronoi.ts` exports `Vec2`, but `ship.ts`, `bullet.ts`, `asteroid.ts` all use inline `{ x, y }` shapes. Consolidate.
- **`src/types.ts`** — centralize shared types (Vec2, GameState, ZoneSnapshot variants once renamed).
- **Pre-commit hook** — running `tsc + eslint + vitest run` on commit would prevent regressions; harmless overhead at 107/107 in <500ms.
- **`vite.config.js`** — not inspected; verify it handles the JSON import + tree-shakes constants.
- **Cabinet-only smoke verification** — at some point the game has to run on the RCade cabinet emulator. The `npm run dev` command already starts `rcade dev`; visit it in a browser to confirm the lobby renders with the actual spinner plugin live (the spinner API deviates from the README spec — confirmed in input.ts but not exercised at runtime by tests).
- **Polygon self-intersection guard for `zone-renderer`** — T-05 had a near-miss where the spec's "clockwise traversal from ep1" produced self-intersecting polygons until the implementer corrected it. Add a runtime assertion (dev-only) that the emitted polygon has no edge crossings.
- **Asteroid pool snapshot returns mutable references** — `asteroid.ts::snapshot()` should return deep clones if downstream code is allowed to mutate; otherwise document that pool state is shared with consumers.

### Memory updates worth making in the next session

After the integration interview, save:
- A `feedback` memory if the user's answers reveal preferences on naming conventions, snapshot ownership models, or test-coverage philosophy.
- A `project` memory once the integration ships and the game is playable — note the win-state and any first-run feedback.

---

*Cold-start checklist for next session:*
1. `git log -1 --stat` to confirm HEAD = `777b6df`.
2. `n exec stable npx vitest run` — should be 107/107.
3. Read `TODO.md` (current trimmed version) for the integration concerns.
4. Read this file for the interview agenda.
5. Run the interview, then implement.
