# TODO

Open work toward the initial prototype. On completion, items move **verbatim** to `COMPLETED.md` (per CLAUDE.md convention). Long-horizon items live in `FUTURE_WORK.md`.

## Session pointer

**Most recent session**: 2026-05-12 (Voronoi rewind + tuning + loading gate). 165/165 tests; tsc + eslint clean; vite build OK. Live cabinet smoke test passed earlier in the day. Git HEAD: see `git log -1`.

---

## Open items

### T-16 — Playtest tuning pass

- **Deps**: T-15, T-17, T-18.
- **Rationale**: Several tuning changes landed this session blind (asteroid sizes/spawn halved, velocities halved, energy regen halved, FF boost preserved at full strength). Needs live-cabinet playtest to see whether the new feel is balanced.
- **Acceptance**: Adjust constants in `src/constants.json` after playtest. Candidates remaining: ship rotation speed, bullet cooldown / lifetime, ghost vs. live alpha contrast, exact balance of summon mechanic vs. T-17 scrub immunity (does "rewind to dodge a summon" feel cheap?), whether to add a small damage scalar so summoned asteroids deal 0 or 0.5 instead of 1 (would require HP to be a float).
