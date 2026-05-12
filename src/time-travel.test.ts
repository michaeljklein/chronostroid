import { describe, it, expect } from "vitest";
import CONSTANTS from "./constants.json";
import {
    createTimeTravelState,
    tickTimeTravel,
    recordPresent,
    boundaryMidpoints,
    type TimeTravelState,
} from "./time-travel";
import { currentSnapshot } from "./zone-history";
import type { ZoneSnapshot } from "./zone-history";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(x: number, y: number, angle = 0): ZoneSnapshot {
    return {
        ship: { x, y, vx: 0, vy: 0, angle, hp: 10 },
        asteroids: [],
        bullets: [],
        hp: 10,
    };
}

/**
 * Build a TimeTravelState with `n` ticks recorded and still at frontier
 * (not in time travel). Ships move by +1 x per tick so snapshots differ.
 */
function buildStateWithHistory(n: number): TimeTravelState {
    const initial = makeSnapshot(0, 0);
    let state = createTimeTravelState(initial);
    for (let i = 1; i <= n; i++) {
        const snap = makeSnapshot(i, 0);
        state = recordPresent(state, snap);
    }
    return state;
}

// ---------------------------------------------------------------------------
// T-10 Tests
// ---------------------------------------------------------------------------

const { TICKS_PER_SPIN } = CONSTANTS.REWIND;
const { COST_PER_TICK } = CONSTANTS.ENERGY;

describe("T-10 Spinner time-travel controller", () => {
    // Test 1: Spinner delta=2 traverses exactly 2×TICKS_PER_SPIN steps
    it("spinner delta=-2 traverses exactly 2×TICKS_PER_SPIN steps back", () => {
        // Record 100 ticks so there's plenty of history
        const state = buildStateWithHistory(100);

        // Current snapshot should be x=100 (frontier)
        expect(currentSnapshot(state.history).ship.x).toBe(100);

        // Rewind by delta=-2 → should traverse 2 × TICKS_PER_SPIN = 24 steps back
        const { state: newState, visibleSnapshot } = tickTimeTravel(state, -2);

        const expectedSteps = 2 * TICKS_PER_SPIN;
        // We started at x=100, moved back 24 steps → should be at x=76
        expect(visibleSnapshot.ship.x).toBe(100 - expectedSteps);
        expect(currentSnapshot(newState.history).ship.x).toBe(100 - expectedSteps);
    });

    // Test 2: Energy deducted = |delta| × TICKS_PER_SPIN × COST_PER_TICK per frame
    it("energy deducted equals |delta| × TICKS_PER_SPIN × COST_PER_TICK", () => {
        const state = buildStateWithHistory(100);
        const initialEnergy = state.energy.value;

        const { state: newState } = tickTimeTravel(state, -3);

        const expectedDeduction = 3 * TICKS_PER_SPIN * COST_PER_TICK;
        expect(newState.energy.value).toBe(initialEnergy - expectedDeduction);
    });

    // Test 3: Energy hits 0 mid-traversal: partial traversal, no forced return
    it("energy at 0 blocks all traversal; partial energy allows partial traversal only", () => {
        // Set energy to allow only a few ticks
        const state = buildStateWithHistory(100);
        // Manually set energy to exactly 5 ticks worth
        const partialEnergy = 5 * COST_PER_TICK; // exactly 5 ticks
        const stateWithLowEnergy: TimeTravelState = {
            ...state,
            energy: { value: partialEnergy },
        };

        // Request a large delta (e.g., delta=-50 → 50 × TICKS_PER_SPIN ticks)
        const { state: newState, boost } = tickTimeTravel(stateWithLowEnergy, -50);

        // Should only traverse 5 ticks (energy cap)
        expect(newState.ticksSpunThisFrame).toBe(5);
        // Energy should be depleted
        expect(newState.energy.value).toBe(0);
        // Still in time travel (partial traversal, not at present)
        expect(newState.inTimeTravel).toBe(true);
        // No boost (did not reach frontier)
        expect(boost).toBeNull();
    });

    // Test 4: FF boost = null when spinnerDelta=0 and zone was never in time travel
    it("boost is null when spinnerDelta=0 (no movement) and already at frontier", () => {
        const state = buildStateWithHistory(10);
        // Never entered time travel; call with delta=0
        expect(state.inTimeTravel).toBe(false);

        const { boost } = tickTimeTravel(state, 0);
        expect(boost).toBeNull();
    });

    // Test 5: solidBoundaryMidpoint unchanged while rewinding
    it("solidBoundaryMidpoint is unchanged while rewinding (anchored to lastPresentPos)", () => {
        const state = buildStateWithHistory(50);

        // Enter time travel by rewinding
        const { state: state1 } = tickTimeTravel(state, -1);
        expect(state1.inTimeTravel).toBe(true);

        // Capture the lastPresentSnapshot that was saved on entry
        const lastPresent = state1.lastPresentSnapshot;
        const other = { x: 200, y: 100 };

        // Compute solid boundary midpoint after first rewind step
        const midpoints1 = boundaryMidpoints(lastPresent.ship, null, other, null);

        // Rewind more
        const { state: state2 } = tickTimeTravel(state1, -1);
        const midpoints2 = boundaryMidpoints(state2.lastPresentSnapshot.ship, null, other, null);

        // Solid midpoint should be identical — lastPresentSnapshot doesn't change during rewind
        expect(midpoints1.solid.x).toBe(midpoints2.solid.x);
        expect(midpoints1.solid.y).toBe(midpoints2.solid.y);
    });

    // Test 6: ghostBoundaryMidpoint shifts each step as ghost position updates
    it("ghostBoundaryMidpoint shifts each rewind step as ghost ship position changes", () => {
        const state = buildStateWithHistory(50);

        // Enter time travel by rewinding
        const { state: state1, visibleSnapshot: vis1 } = tickTimeTravel(state, -1);
        expect(state1.inTimeTravel).toBe(true);

        const other = { x: 200, y: 100 };
        const lastPresent1 = state1.lastPresentSnapshot;

        // Ghost is at the current visible snapshot's ship position
        const ghost1 = vis1.ship;
        const midpoints1 = boundaryMidpoints(lastPresent1.ship, ghost1, other, null);

        // Rewind one more step
        const { state: state2, visibleSnapshot: vis2 } = tickTimeTravel(state1, -1);
        const ghost2 = vis2.ship;
        const midpoints2 = boundaryMidpoints(state2.lastPresentSnapshot.ship, ghost2, other, null);

        // Ghost midpoint should have changed since ghost ship position changed
        // (ghost moved back 1 tick = 1 unit in x based on our snapshot setup)
        expect(midpoints1.ghost).toBeDefined();
        expect(midpoints2.ghost).toBeDefined();
        expect(midpoints1.ghost!.x).not.toBe(midpoints2.ghost!.x);
    });

    // T-10 follow-on: after fast-forwarding past the frontier, inTimeTravel === false
    it("after fast-forwarding past the frontier, inTimeTravel becomes false", () => {
        const state = buildStateWithHistory(100);
        // Enter time travel by rewinding deeply
        const { state: rewoundState } = tickTimeTravel(state, -5);
        expect(rewoundState.inTimeTravel).toBe(true);

        // Fast-forward way past the frontier (large positive delta)
        const { state: fwdState } = tickTimeTravel(rewoundState, 999);
        expect(fwdState.inTimeTravel).toBe(false);
    });

    // T-10 follow-on: boost magnitude capped at MAX_BOOST_SPEED
    it("FF boost magnitude is capped at REWIND.MAX_BOOST_SPEED", () => {
        const state = buildStateWithHistory(200);
        // Rewind far first
        const { state: rewoundState } = tickTimeTravel(state, -10);
        expect(rewoundState.inTimeTravel).toBe(true);

        // Fast-forward enough to reach frontier; with a huge delta the raw
        // boost magnitude FF_BOOST_SCALE * (ticks / TICKS_PER_SPIN) far exceeds
        // the cap, so the returned magnitude must equal MAX_BOOST_SPEED.
        const { boost } = tickTimeTravel(rewoundState, 999);
        expect(boost).not.toBeNull();
        const mag = Math.hypot(boost!.x, boost!.y);
        expect(mag).toBeLessThanOrEqual(CONSTANTS.REWIND.MAX_BOOST_SPEED + 1e-9);
        // And we expect it to actually hit the cap with such a large delta.
        expect(mag).toBeCloseTo(CONSTANTS.REWIND.MAX_BOOST_SPEED, 6);
    });

    // T-10 follow-on: recordPresent while inTimeTravel === true is a no-op
    it("recordPresent while inTimeTravel === true is a no-op (history unchanged)", () => {
        const state = buildStateWithHistory(50);
        const { state: rewoundState } = tickTimeTravel(state, -1);
        expect(rewoundState.inTimeTravel).toBe(true);

        const historyBefore = rewoundState.history;
        const currentBefore = currentSnapshot(rewoundState.history);

        const afterRecord = recordPresent(rewoundState, makeSnapshot(999, 999));

        // History reference should be unchanged
        expect(afterRecord.history).toBe(historyBefore);
        // Current snapshot is the same reference
        expect(currentSnapshot(afterRecord.history)).toBe(currentBefore);
        // lastPresentSnapshot should not have been overwritten with the new snapshot
        expect(afterRecord.lastPresentSnapshot).toBe(rewoundState.lastPresentSnapshot);
    });

    // Bonus: Dual-rewind — when both zones are rewound, opponentGhostOrPresent = otherGhost
    it("dual-rewind: solid boundary uses otherGhost when both zones are rewound", () => {
        const selfLastPresent = { x: 50, y: 100 };
        const selfGhost = { x: 40, y: 100 };
        const other = { x: 250, y: 100 }; // live present (not used when otherGhost is provided)
        const otherGhost = { x: 230, y: 100 }; // opponent is also rewound

        const midpoints = boundaryMidpoints(selfLastPresent, selfGhost, other, otherGhost);

        // solid = midpoint(selfLastPresent, otherGhost) — NOT midpoint(selfLastPresent, other)
        const expectedSolidX = (selfLastPresent.x + otherGhost.x) / 2;
        const expectedSolidY = (selfLastPresent.y + otherGhost.y) / 2;
        expect(midpoints.solid.x).toBe(expectedSolidX);
        expect(midpoints.solid.y).toBe(expectedSolidY);

        // ghost = midpoint(selfGhost, otherGhost)
        const expectedGhostX = (selfGhost.x + otherGhost.x) / 2;
        const expectedGhostY = (selfGhost.y + otherGhost.y) / 2;
        expect(midpoints.ghost).toBeDefined();
        expect(midpoints.ghost!.x).toBe(expectedGhostX);
        expect(midpoints.ghost!.y).toBe(expectedGhostY);
    });
});
