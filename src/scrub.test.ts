import { describe, it, expect } from "vitest";
import { applyScrubHp, detectHeal } from "./scrub";
import {
    createTimeTravelState,
    recordPresent,
    tickTimeTravel,
} from "./time-travel";
import type { ZoneSnapshot } from "./zone-history";
import { createShip, type ShipState } from "./ship";
function snap(ship: ShipState): ZoneSnapshot {
    return { ship: { ...ship }, asteroids: [], bullets: [], hp: ship.hp };
}

describe("applyScrubHp", () => {
    it("is a no-op when not in time travel", () => {
        const ship = createShip(0, 0, 0, 5);
        const out = applyScrubHp(ship, 9, false);
        expect(out).toBe(ship); // identity — no allocation
        expect(out.hp).toBe(5);
    });

    it("overwrites live HP with snapshot HP when in TT", () => {
        const ship = createShip(0, 0, 0, 3);
        const out = applyScrubHp(ship, 9, true);
        expect(out.hp).toBe(9);
    });

    it("is identity when in TT but HP already matches", () => {
        const ship = createShip(0, 0, 0, 7);
        const out = applyScrubHp(ship, 7, true);
        expect(out).toBe(ship);
    });
});

describe("detectHeal", () => {
    it("returns true when snapshot HP rose", () => {
        expect(detectHeal(5, 7)).toBe(true);
    });
    it("returns false on no change or drop", () => {
        expect(detectHeal(7, 7)).toBe(false);
        expect(detectHeal(7, 6)).toBe(false);
    });
});

describe("T-17 integration: rewind across damage restores HP", () => {
    // Drive a small loop:
    //   - record N healthy ticks
    //   - take damage (record one tick at lower HP)
    //   - rewind across the damage tick → applyScrubHp must restore HP
    //   - fast-forward across the damage tick → applyScrubHp must re-apply
    //   - reach frontier → applyScrubHp is a no-op (snapshot.hp == live.hp)
    it("rewind restores HP; FF re-applies it; frontier is a no-op", () => {
        // Build live + history with HP 10 for 5 ticks, then HP 9 for 5 ticks.
        let live = createShip(100, 100, 0, 10);
        let tt = createTimeTravelState(snap(live));

        // 5 healthy ticks at the frontier
        for (let i = 0; i < 5; i++) {
            tt = recordPresent(tt, snap(live));
        }
        // Damage event
        live = { ...live, hp: 9 };
        tt = recordPresent(tt, snap(live));
        // 4 more ticks at HP 9
        for (let i = 0; i < 4; i++) {
            tt = recordPresent(tt, snap(live));
        }

        // Live HP is 9, at frontier (no TT)
        expect(tt.inTimeTravel).toBe(false);
        let scrubbed = applyScrubHp(live, 9, tt.inTimeTravel);
        expect(scrubbed.hp).toBe(9);

        // Rewind across the damage: spinnerDelta = -1 spin moves back by TPS ticks.
        // We need to go back at least 5 ticks (past the damage). With TPS=12 a
        // single negative spin overshoots; once landed, snapshot HP at that
        // earlier tick is 10.
        const r1 = tickTimeTravel(tt, -1);
        tt = r1.state;
        expect(tt.inTimeTravel).toBe(true);
        expect(r1.visibleSnapshot.ship.hp).toBe(10);

        scrubbed = applyScrubHp(live, r1.visibleSnapshot.ship.hp, tt.inTimeTravel);
        expect(scrubbed.hp).toBe(10); // restored!

        // Fast-forward back toward the frontier (re-apply the damage).
        const r2 = tickTimeTravel(tt, +1);
        tt = r2.state;
        // After one positive spin we may or may not have reached frontier;
        // either way the snapshot HP at the new position reflects history.
        scrubbed = applyScrubHp(live, r2.visibleSnapshot.ship.hp, tt.inTimeTravel);
        // If we crossed back past the damage tick, scrubbed HP should be 9.
        // If we didn't quite reach it (TPS overshoot from the other side),
        // it could still be 10. Either is consistent — assert it never exceeds
        // the recorded snapshot HP.
        expect(scrubbed.hp).toBe(r2.visibleSnapshot.ship.hp);

        // FF more aggressively to guarantee we reach frontier.
        for (let i = 0; i < 5; i++) {
            const rN = tickTimeTravel(tt, +1);
            tt = rN.state;
        }
        expect(tt.inTimeTravel).toBe(false);

        // At frontier, snapshot HP matches live HP (9). Scrubbing is a no-op.
        const frontierSnap = snap(live);
        scrubbed = applyScrubHp(live, frontierSnap.ship.hp, tt.inTimeTravel);
        expect(scrubbed).toBe(live);
        expect(scrubbed.hp).toBe(9);
    });
});
