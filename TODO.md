# TODO

Open work toward the initial prototype. On completion, items move **verbatim** to `COMPLETED.md` (per CLAUDE.md convention). Long-horizon items live in `FUTURE_WORK.md`.

## Session pointer

**Most recent session**: 2026-05-12 (T-01 through T-14 all implemented in waves 0–6; full unit and fast-check property test suite green at 107/107; tsc + eslint clean). Git HEAD: see `git log -1`.

---

## Remaining work toward a playable prototype

All T-01 through T-14 module-level items are complete and moved to `COMPLETED.md`. What remains is **final integration**: wiring the implemented modules into `src/sketch.ts`'s `PLAYING` branch so the game actually runs end-to-end on `npm run dev`. The audit (2026-05-12) identified the following concrete integration concerns:

1. **`ZoneSnapshot` name collision**: both `src/collision.ts` and `src/zone-history.ts` export a type named `ZoneSnapshot` with different shapes (collision adds `zoneId` + `ghostShip`; history has `hp` + no zone metadata). The integrator must alias one on import (or rename in source) before consumers can import both.
2. **Boundary-midpoint API overlap**: `src/time-travel.ts::boundaryMidpoints` returns point-midpoints while `src/zone-renderer.ts::computeBoundaryMidpoints` returns full boundary endpoint pairs. The integrator must choose which to call directly from the draw loop.
3. **Ghost-vs-live ship surfacing**: `TimeTravelState.inTimeTravel` plus `visibleSnapshot.ship` together expose "ghost or live" but no single helper does it; the integrator should add a one-line helper or inline the conditional.
4. **`sketch.ts` doesn't use `game.ts` yet**: the placeholder lobby/game-over state machine in `sketch.ts` duplicates `game.ts`. Replace with calls into `game.ts`.

Once those are resolved, the per-frame loop assembly is mechanical (read input → tick game state → update entities → record history → draw in spec'd order). No new design decisions required.

### Suggested follow-on test additions (from audit)

Not blocking, but high value for catching regressions:
- T-03: y-axis canvas wrap; ghost-alpha render verification.
- T-04: horizontal bisector edge case; tie exactly at midpoint.
- T-05: non-overlapping polygon coverage; horizontal-bisector boundary.
- T-06: split children never overlap on non-zero parent velocity; medium→small split.
- T-07: cooldown decrements regardless of fire state.
- T-08: same-tick multiple bullets on one asteroid; same-tick split children inert.
- T-09: sibling-subtree freeing on eviction; `rewind(n > depth)` doesn't throw.
- T-10: `inTimeTravel === false` after frontier; boost cap; `recordPresent` no-op while in time travel.
- T-11: regen mutually exclusive with deduction per frame.
- T-12: simultaneous P1/P2 HP-zero priority; `winner` cleared on return-to-lobby.
- T-13: spinner-delta flow-through; `selectSystemInput` non-null in LOBBY/GAME_OVER.
- T-14: large-offset clock label; negative-hp clamp.
