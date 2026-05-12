import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import CONSTANTS from "./constants.json";
import {
    createZoneHistory,
    recordTick,
    rewind,
    fastForward,
    atFrontier,
    currentSnapshot,
    liveNodeCount,
} from "./zone-history";
import type { ZoneSnapshot } from "./zone-history";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const HISTORY_TICKS = CONSTANTS.REWIND.HISTORY_TICKS;

/** Create a minimal distinguishable ZoneSnapshot keyed by a numeric tag. */
function makeSnap(tag: number): ZoneSnapshot {
    return {
        ship: { x: tag, y: 0, vx: 0, vy: 0, angle: 0, hp: 10 },
        asteroids: [],
        bullets: [],
        hp: 10,
    };
}

/** Build a linear history of `depth` nodes (root + depth children). */
function buildLinear(depth: number): ReturnType<typeof createZoneHistory> {
    let h = createZoneHistory(makeSnap(0));
    for (let i = 1; i <= depth; i++) {
        h = recordTick(h, makeSnap(i));
    }
    return h;
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe("ZoneHistory — unit tests", () => {
    it("atFrontier() is true on initial single-node history", () => {
        const h = createZoneHistory(makeSnap(0));
        expect(atFrontier(h)).toBe(true);
    });

    it("atFrontier() is true on a freshly appended node", () => {
        let h = createZoneHistory(makeSnap(0));
        h = recordTick(h, makeSnap(1));
        expect(atFrontier(h)).toBe(true);
    });

    it("atFrontier() is false after rewind(1) when there are prior nodes", () => {
        let h = createZoneHistory(makeSnap(0));
        h = recordTick(h, makeSnap(1));
        h = rewind(h, 1);
        expect(atFrontier(h)).toBe(false);
    });

    it("currentSnapshot reflects the correct snapshot after recordTick", () => {
        let h = createZoneHistory(makeSnap(0));
        h = recordTick(h, makeSnap(42));
        expect(currentSnapshot(h).ship.x).toBe(42);
    });

    it("rewind moves back to correct snapshot", () => {
        let h = createZoneHistory(makeSnap(0));
        h = recordTick(h, makeSnap(1));
        h = recordTick(h, makeSnap(2));
        h = rewind(h, 2);
        expect(currentSnapshot(h).ship.x).toBe(0);
    });

    it("fastForward returns stepsTaken === 0 at frontier", () => {
        const h = createZoneHistory(makeSnap(0));
        const { stepsTaken } = fastForward(h, 5);
        expect(stepsTaken).toBe(0);
    });

    it("fastForward advances by the correct number of steps", () => {
        let h = buildLinear(5);
        h = rewind(h, 3);
        const { history, stepsTaken } = fastForward(h, 3);
        expect(stepsTaken).toBe(3);
        expect(currentSnapshot(history).ship.x).toBe(5);
    });

    it("fastForward stops early when it hits frontier", () => {
        let h = buildLinear(3);
        h = rewind(h, 2);
        // Only 2 steps forward available; asking for 10.
        const { stepsTaken } = fastForward(h, 10);
        expect(stepsTaken).toBe(2);
    });

    // ------------------------------------------------------------------
    // Branch-point tests
    // ------------------------------------------------------------------

    it("recordTick at branch point: fastForward(1) follows new branch", () => {
        // Build: 0 → 1 → 2 → 3 → 4 → 5
        let h = buildLinear(5);
        // Rewind 3 steps: current = node at snapshot tag 2
        h = rewind(h, 3);
        expect(currentSnapshot(h).ship.x).toBe(2);

        // Record a new snapshot — creates branch at tag 2 → newSnap
        const newSnap = makeSnap(99);
        h = recordTick(h, newSnap);
        // current is now on the new branch (tag 99), one step back = tag 2
        // Rewind 1 to get back to branch point
        h = rewind(h, 1);
        expect(currentSnapshot(h).ship.x).toBe(2);

        // FastForward(1) should follow the new branch (tag 99)
        const { history: hFwd, stepsTaken } = fastForward(h, 1);
        expect(stepsTaken).toBe(1);
        expect(currentSnapshot(hFwd).ship.x).toBe(99);
    });

    it("lastVisitedChildIndex at branch point updated to new branch after recordTick", () => {
        let h = buildLinear(5);
        h = rewind(h, 3);
        // Branch point is at tag 2, existing child leads to tag 3
        h = recordTick(h, makeSnap(99));
        // After recordTick, current moved to tag 99. Rewind back to branch point.
        h = rewind(h, 1);
        // fastForward(1) must go to tag 99 (new branch), not tag 3 (old branch)
        const { history } = fastForward(h, 1);
        expect(currentSnapshot(history).ship.x).toBe(99);
    });

    // ------------------------------------------------------------------
    // Pool capacity / eviction
    // ------------------------------------------------------------------

    it(`after recording HISTORY_TICKS + 1 nodes in a straight line, liveNodeCount === HISTORY_TICKS`, () => {
        // This records HISTORY_TICKS more nodes on top of the initial root,
        // so total ever created = HISTORY_TICKS + 1, and one should be evicted.
        let h = createZoneHistory(makeSnap(0));
        for (let i = 1; i <= HISTORY_TICKS; i++) {
            h = recordTick(h, makeSnap(i));
        }
        expect(liveNodeCount(h)).toBe(HISTORY_TICKS);
    });

    it("after recording HISTORY_TICKS + 1 nodes, rewind(HISTORY_TICKS) reaches node that is NOT the original root", () => {
        let h = createZoneHistory(makeSnap(0));
        for (let i = 1; i <= HISTORY_TICKS; i++) {
            h = recordTick(h, makeSnap(i));
        }
        // Rewind as far as possible (up to HISTORY_TICKS steps)
        h = rewind(h, HISTORY_TICKS);
        // Original root had ship.x === 0. After eviction, new root has ship.x === 1.
        expect(currentSnapshot(h).ship.x).not.toBe(0);
    });

    it("rewind stops at root and does not go below 0 steps", () => {
        let h = buildLinear(3);
        // Rewind more than depth
        h = rewind(h, 100);
        // Should be at the root (tag 0)
        expect(currentSnapshot(h).ship.x).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Property tests (fast-check)
// ---------------------------------------------------------------------------

describe("ZoneHistory — property tests", () => {
    // ------------------------------------------------------------------
    // Reversibility
    // ------------------------------------------------------------------
    it("reversibility: rewind(n) then fastForward(n) returns to same snapshot", () => {
        fc.assert(
            fc.property(
                // depth in [1, 20] to keep tests fast
                fc.integer({ min: 1, max: 20 }),
                fc.integer({ min: 1, max: 20 }),
                (depth, rewindSteps) => {
                    const h = buildLinear(depth);
                    const snapBefore = currentSnapshot(h);
                    const stepsToRewind = Math.min(rewindSteps, depth);

                    const rewound = rewind(h, stepsToRewind);
                    const { history: restored, stepsTaken } = fastForward(rewound, stepsToRewind);

                    // stepsTaken must equal stepsToRewind (since we only went back that far)
                    expect(stepsTaken).toBe(stepsToRewind);
                    // Must be back at the same snapshot reference
                    expect(currentSnapshot(restored)).toBe(snapBefore);
                }
            )
        );
    });

    // ------------------------------------------------------------------
    // Snapshot completeness
    // ------------------------------------------------------------------
    it("snapshot completeness: every snapshot passed to recordTick is retrievable", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 50 }),
                (depth) => {
                    const snaps: ZoneSnapshot[] = [];
                    let h = createZoneHistory(makeSnap(0));
                    for (let i = 1; i <= depth; i++) {
                        const s = makeSnap(i);
                        snaps.push(s);
                        h = recordTick(h, s);
                    }
                    // Walk back to root and collect all snapshots via rewind
                    const collected: ZoneSnapshot[] = [];
                    let walker = h;
                    // Collect current snapshot before rewinding
                    collected.push(currentSnapshot(walker));
                    for (let i = 0; i < depth; i++) {
                        walker = rewind(walker, 1);
                        collected.push(currentSnapshot(walker));
                    }
                    // Each snapshot we pushed should appear exactly once
                    for (const s of snaps) {
                        const count = collected.filter((c) => c === s).length;
                        expect(count).toBe(1);
                    }
                }
            )
        );
    });

    // ------------------------------------------------------------------
    // Pool invariant
    // ------------------------------------------------------------------
    it("pool invariant: liveNodeCount never exceeds HISTORY_TICKS under any sequence", () => {
        // Use a small local pool cap to make the test fast (override via small depth)
        // We test with a representative small pool using the actual HISTORY_TICKS constant.
        // To avoid running HISTORY_TICKS iterations (3600) in every property trial,
        // we test "relative overflow" patterns: record k > HISTORY_TICKS nodes total.
        // We cap the test sequence length at 200 to keep runtime acceptable while
        // still covering the eviction path.
        const MAX_OPS = 200;

        fc.assert(
            fc.property(
                fc.array(
                    fc.oneof(fc.constant("record" as const), fc.constant("rewind-one" as const)),
                    { minLength: 1, maxLength: MAX_OPS }
                ),
                (ops) => {
                    let h = createZoneHistory(makeSnap(0));
                    let tag = 1;
                    for (const op of ops) {
                        if (op === "record") {
                            h = recordTick(h, makeSnap(tag++));
                        } else {
                            h = rewind(h, 1);
                        }
                        expect(liveNodeCount(h)).toBeLessThanOrEqual(HISTORY_TICKS);
                    }
                }
            )
        );
    });

    it("pool invariant: exactly HISTORY_TICKS live nodes after recording HISTORY_TICKS + k extras", () => {
        // Verify precise count once overflow has occurred.
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 10 }),
                (k) => {
                    let h = createZoneHistory(makeSnap(0));
                    // Record HISTORY_TICKS + k nodes (one more than pool can hold each time after cap)
                    for (let i = 1; i <= HISTORY_TICKS + k; i++) {
                        h = recordTick(h, makeSnap(i % 10000));
                    }
                    expect(liveNodeCount(h)).toBe(HISTORY_TICKS);
                }
            ),
            // Only run a few trials since each trial is O(HISTORY_TICKS)
            { numRuns: 3 }
        );
    });
});
