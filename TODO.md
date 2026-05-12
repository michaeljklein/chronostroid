# TODO

Open work toward the initial prototype. On completion, items move **verbatim** to `COMPLETED.md` (per CLAUDE.md convention). Long-horizon items live in `FUTURE_WORK.md`.

## Session pointer

**Most recent session**: 2026-05-12 (integration session). All T-01–T-14 modules wired into `src/sketch.ts`'s PLAYING branch via per-zone runtime state; dual asteroid pools with bisector-driven handoff; live + ghost ship rendering during TT. `ZoneSnapshot` rename + audit follow-on tests landed. 131/131 tests passing; tsc + eslint clean; `npm run build` succeeds. Git HEAD: see `git log -1`.

---

## Remaining work

No remaining prototype-blocking work known. Open future-facing items live in `FUTURE_WORK.md`. Next session should run the dev server on the RCade emulator (or browser) for a real-input playtest — that pass will surface any tuning needs (asteroid density, FF boost magnitude, ghost vs. live visual clarity, energy regen rate) and any cabinet-runtime regressions the unit suite can't catch.
