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
