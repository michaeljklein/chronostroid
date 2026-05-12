# TODO

Open work toward the initial prototype. On completion, items move **verbatim** to `COMPLETED.md` (per CLAUDE.md convention). Long-horizon items live in `FUTURE_WORK.md`.

## Session pointer

**Most recent session**: 2026-05-12 (audio + heal-via-rewind). Live cabinet smoke test passed before this session. Git HEAD: see `git log -1`.

---

## Open items

### T-15 — In-game audio (CC0 sci-fi sample set)

- **Deps**: integration complete (✅).
- **Source set**: `https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds/tree/main/50-cc0-sci-fi-sfx` (CC0 / public domain).
- **Event → bucket mapping** (one sample per event, non-repeating shuffle queue per bucket):
  - Ship damage (`bullet-hit-ship` ∪ `asteroid-hit-ship`) → `retro_beep_*.ogg` (6 files).
  - Asteroid damage (`bullet-hit-asteroid`, all tiers) → `explosion_*.ogg` (2 files).
  - Bullet fired (per spawn) → `retro_laser_*.ogg` (2 files).
  - Ship healed (HP delta > 0 in this player's visible snapshot, during TT — see T-17) → `beep_*.ogg` (3 files).
- **Locked spec (2026-05-12 interview)**:
  - Audio engine: **p5.sound** (p5 1.x addon, bundled in `node_modules/p5/lib/addons`).
  - Loudness pre-processing: **ffmpeg loudnorm at -16 LUFS integrated, -1 dBTP peak**.
  - Silence trim: head + tail at -50 dB threshold.
  - Polyphony: **unlimited overlap** — each trigger plays a fresh instance.
  - Selection: **non-repeating shuffle** (Fisher–Yates queue, refill on exhaust).
  - Damage trigger: both bullet- and asteroid-hit-ship.
  - Small asteroids emit explosion too (every `bullet-hit-asteroid` event = one explosion).
- **Acceptance**:
  - Samples vendored to `assets/audio/<bucket>/` plus `LICENSE` from upstream repo root.
  - `src/audio.ts` module exposes a setup-time loader and `playLaser/playExplosion/playShipDamage/playHeal` functions.
  - Wired into `src/sketch.ts` at bullet-fire detection, collision event iteration, and per-zone visible-snapshot HP delta.
  - Unit tests verify (a) every expected file exists, (b) each bucket is non-empty, (c) the shuffle queue picker returns a member of the bucket and exhausts before repeating.
  - `vite.config.js` includes `.ogg` in assets (default behavior; verify) and the dev server serves them.

### T-17 — HP scrubbing during time travel (heal mechanic)

- **Promoted from**: FW-5 (heal-via-rewind clarification from user).
- **Deps**: none.
- **Locked spec (2026-05-12)**:
  - While a zone is in TT (`tt.inTimeTravel === true`), the live ship's HP is **overwritten each frame** with `visibleSnapshot.ship.hp`. This makes rewinding past a hit actually restore the lost HP; fast-forwarding back through the hit re-applies it; reaching the frontier is a no-op (snapshot HP = current live HP).
  - Side effect: new damage taken during TT is overwritten the next frame — the ghost is effectively invulnerable until exit. Acceptable for v1.
  - Heal event for audio: per zone, compare current frame's `visibleSnapshot.ship.hp` to previous frame's; if it rose, play one heal sample.
- **Acceptance**:
  - `src/sketch.ts` `tickPlayingFrame` overwrites live HP from visible snapshot during TT.
  - Heal SFX fires on positive HP delta in the visible snapshot.
  - Unit test exercises: rewind across damage → live HP rises; FF back across damage → live HP drops; exit at frontier → no spurious change.

### T-16 — Playtest tuning pass

- **Deps**: T-15, T-17.
- **Rationale**: First live cabinet test surfaced subjective tuning needs. Run a single pass after audio + heal land.
- **Acceptance**: Adjust constants in `src/constants.json` (asteroid density already halved). Candidates: FF boost magnitude, energy regen rate, ship max speed, ghost vs. live alpha contrast, bullet cooldown / lifetime.
