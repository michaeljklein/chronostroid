# Design Interview Convention

Game design decisions are locked via `AskUserQuestion` interviews before implementation begins.

## When to run a design interview

- Before implementing any feature with unclear scope, ambiguous mechanics, or tradeoffs
- When the TODO item says "interview required" or "spec open"
- When two reasonable implementations exist and the choice affects gameplay feel

## Format

Use `AskUserQuestion` with 1–4 questions per call (tool limit). Organize around:
1. The core mechanic / behavior
2. Edge cases and boundary conditions
3. Tradeoffs (performance vs. feel, simplicity vs. depth, etc.)
4. Visual/audio feedback

After the interview, append a "Locked spec (YYYY-MM-DD interview)" block to the relevant TODO item before implementing.

## Open design questions (to be covered in the next-session interview)

See `TODO.md` item **D-INTERVIEW-1** for the full agenda.

Topics that are already partially resolved:
- **Time travel zones (v1):** Left half of screen = P1's rewind zone; right half = P2's rewind zone.
- **Spinner input:** P1 spinner rewinds/fast-forwards P1's zone; P2 spinner rewinds/fast-forwards P2's zone (symmetric — pending confirmation in interview).
- **Button mapping:** A = activate ship thruster; B = shoot ship weapon (per player).
- **Field topology:** Undecided (shared field vs. separate halves — interview agenda item).
- **Spinner mechanics depth:** How far back, cost/limits, cross-boundary behavior — interview agenda items.
