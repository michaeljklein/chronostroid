# Future Work

Long-horizon items not in the initial prototype scope. Each entry: rationale, open questions, when to revisit, acceptance criteria.

---

## ~~FW-1 — Voronoi-cell time travel zones~~ *(promoted to v1 scope, 2026-05-12)*

This item was brought into the initial prototype during the D-INTERVIEW-1 design interview. See the locked spec in `COMPLETED.md → D-INTERVIEW-1` for full details. All open questions from this entry were resolved in that interview.

---

## FW-2 — Persistence plugin (high scores)

- **Concept**: Use an RCade persistence plugin (planned by RCade maintainers) to save high scores or win/loss records across sessions.
- **Why deferred**: RCade's sandbox blocks `localStorage`. The persistence plugin does not yet exist as of 2026-05-12.
- **Revisit when**: RCade ships a persistence plugin.

---

## FW-3 — Multiplayer networking

- **Concept**: Online multiplayer via an RCade networking plugin, so two people on separate cabinets (or remote) can play.
- **Why deferred**: Same as FW-2 — RCade networking plugin not yet available.
- **Revisit when**: RCade ships a networking plugin.

---

## FW-4 — Playwright browser smoke + scenario suite

- **Concept**: A Playwright-driven browser test suite (MCP `playwright` server already in tool list) that drives the Vite dev server against a real browser. Coverage target: (a) **lobby smoke** — load page, screenshot, assert `CHRONOSTROID` title renders; (b) **start flow** — press 2P-Start key, verify transition to `PLAYING` with two ships visible; (c) **game-over flow** — script enough input or seed enough damage to drive HP to 0, verify `P1/P2 WINS` overlay and return-to-lobby on 2P-Start.
- **Why deferred**: Unit tests cover pure modules; they cannot catch canvas-init / RCade plugin handshake / p5 instance-mode wiring regressions. Browser tests can. Deferred from the 2026-05-12 integration interview to keep the prototype landing first; user selected the fuller-suite approach over a one-shot lobby smoke.
- **Open questions**:
  - Run against `npm run dev` (Vite) or against the production `npm run build` output?
  - How to script the game-over scenario deterministically — fake input feed vs. seed an end-state via a test-only constants override?
  - CI integration: skip browser tests in CI (headless flake risk) or run them on a separate workflow?
- **Revisit when**: The prototype is playable end-to-end and stable enough that regressions are the dominant risk.
- **Acceptance criteria**:
  - Three Playwright specs (lobby, start, game-over) passing locally.
  - Screenshots of each scenario archived to `references/` for visual diffing.
  - Documented run command in `scripts/`.
