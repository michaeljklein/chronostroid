import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
    splitAsteroid,
    spawnLargeFromEdge,
    updateAsteroid,
    tierSpeedFormula,
    tierRadius,
    createPool,
    type AsteroidState,
} from "./asteroid.js";
import CONSTANTS from "./constants.json";

const A = CONSTANTS.ASTEROID;
const C = CONSTANTS.CANVAS;

// ---------------------------------------------------------------------------
// Deterministic RNG helpers
// ---------------------------------------------------------------------------

/** mulberry32 — seeded, deterministic PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s += 0x6d2b79f5;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
}

// A simple constant RNG for reproducible tests
const fixedRng = (value: number) => () => value;

// ---------------------------------------------------------------------------
// Helper: angle between two vectors in degrees
// ---------------------------------------------------------------------------
function angleBetweenDeg(
    ax: number,
    ay: number,
    bx: number,
    by: number
): number {
    const cross = ax * by - ay * bx;
    const dot = ax * bx + ay * by;
    return (Math.atan2(cross, dot) * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// Test 1: Splitting a large asteroid produces exactly 2 medium children
// ---------------------------------------------------------------------------
describe("splitAsteroid", () => {
    const rng = mulberry32(42);
    const parent: AsteroidState = {
        x: 100,
        y: 100,
        vx: 1,
        vy: 0,
        tier: "large",
        vertices: [],
    };

    it("large → 2 medium children", () => {
        const children = splitAsteroid(parent, rng);
        expect(children).toHaveLength(2);
        expect(children[0].tier).toBe("medium");
        expect(children[1].tier).toBe("medium");
    });

    // ---------------------------------------------------------------------------
    // Test 2: Each child speed equals parent speed (not tier formula result)
    // ---------------------------------------------------------------------------
    it("child speed equals parent speed (not tier formula)", () => {
        const rng2 = mulberry32(7);
        // Give parent a non-standard speed to distinguish from tier formula
        const parentSpeed = 0.77;
        const p2: AsteroidState = {
            x: 150,
            y: 150,
            vx: parentSpeed,
            vy: 0,
            tier: "large",
            vertices: [],
        };
        const children = splitAsteroid(p2, rng2);
        for (const child of children) {
            const childSpeed = Math.sqrt(child.vx ** 2 + child.vy ** 2);
            expect(childSpeed).toBeCloseTo(parentSpeed, 8);
        }
    });

    // ---------------------------------------------------------------------------
    // Test 3: Split children velocity directions differ from parent by
    //         ±SPLIT_DIVERGE_ANGLE ± [0, SPLIT_RANDOM_SPREAD] degrees
    // ---------------------------------------------------------------------------
    it("split child velocity angles are within expected range", () => {
        // Use a controlled RNG to check angle bounds
        // The random spread call draws from rng; we know the spread formula is:
        //   totalAngle = sign * DIVERGE + (rng() * 2 - 1) * SPREAD
        // So the angle in degrees is in [sign * DIVERGE - SPREAD, sign * DIVERGE + SPREAD]
        const pvx = 1;
        const pvy = 0;
        const speed = 1; // |v| = 1
        const p3: AsteroidState = {
            x: 168,
            y: 131,
            vx: pvx,
            vy: pvy,
            tier: "large",
            vertices: [],
        };
        // Run 20 splits and check all children are within bounds
        for (let i = 0; i < 20; i++) {
            const seededRng = mulberry32(i * 13 + 17);
            const pp = { ...p3, vx: pvx / speed, vy: pvy / speed };
            const kids = splitAsteroid(pp, seededRng);
            const angles = kids.map((k) =>
                angleBetweenDeg(pvx / speed, pvy / speed, k.vx, k.vy)
            );
            // First child: +sign, second child: -sign
            const minAngle = A.SPLIT_DIVERGE_ANGLE - A.SPLIT_RANDOM_SPREAD;
            const maxAngle = A.SPLIT_DIVERGE_ANGLE + A.SPLIT_RANDOM_SPREAD;
            // angles[0] should be positive (sign=+1), angles[1] negative (sign=-1)
            expect(Math.abs(angles[0])).toBeGreaterThanOrEqual(minAngle - 1e-9);
            expect(Math.abs(angles[0])).toBeLessThanOrEqual(maxAngle + 1e-9);
            expect(Math.abs(angles[1])).toBeGreaterThanOrEqual(minAngle - 1e-9);
            expect(Math.abs(angles[1])).toBeLessThanOrEqual(maxAngle + 1e-9);
        }
    });

    // ---------------------------------------------------------------------------
    // Test 4: Splitting a small asteroid produces 0 children
    // ---------------------------------------------------------------------------
    it("small asteroid → 0 children", () => {
        const rng4 = mulberry32(1);
        const small: AsteroidState = {
            x: 100,
            y: 100,
            vx: 1,
            vy: 0,
            tier: "small",
            vertices: [],
        };
        const children = splitAsteroid(small, rng4);
        expect(children).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Test 5: Pool invariant (property test, fast-check)
//         Large asteroid count always = POOL_SIZE after any sequence of
//         split/despawn events.
// ---------------------------------------------------------------------------
describe("Pool invariant (property test)", () => {
    it("large asteroid count always = POOL_SIZE", () => {
        fc.assert(
            fc.property(
                // Generate a sequence of events: 'split' | 'despawn' of length 1–50
                fc.array(
                    fc.record({
                        action: fc.constantFrom("split", "despawn") as fc.Arbitrary<"split" | "despawn">,
                        seed: fc.integer({ min: 0, max: 999999 }),
                    }),
                    { minLength: 1, maxLength: 50 }
                ),
                (events) => {
                    const rng = mulberry32(12345);
                    const pool = createPool(rng);

                    // Count initial large asteroids = POOL_SIZE
                    const countLarge = () =>
                        pool.getAll().filter((a) => a.tier === "large").length;
                    expect(countLarge()).toBe(A.POOL_SIZE);

                    for (const ev of events) {
                        const all = pool.getAll();
                        if (all.length === 0) continue;

                        // Pick a target asteroid (prefer large ones to exercise replacement)
                        const larges = all.filter((a) => a.tier === "large");
                        const nonLarges = all.filter((a) => a.tier !== "large");
                        // Alternate: pick large if available, else non-large
                        const target =
                            larges.length > 0
                                ? larges[ev.seed % larges.length]
                                : nonLarges[ev.seed % nonLarges.length];

                        if (ev.action === "split") {
                            pool.splitOne(target);
                        } else {
                            pool.despawn(target);
                        }

                        // Invariant: large count must always be exactly POOL_SIZE
                        expect(countLarge()).toBe(A.POOL_SIZE);
                    }
                }
            ),
            { numRuns: 200 }
        );
    });
});

// ---------------------------------------------------------------------------
// Test 6: Spawn position — new large asteroid center is exactly LARGE_RADIUS
//         outside the chosen canvas edge
// ---------------------------------------------------------------------------
describe("spawnLargeFromEdge", () => {
    it("center is exactly LARGE_RADIUS outside an edge", () => {
        // Test with many seeds to cover all 4 edges
        for (let seed = 0; seed < 40; seed++) {
            const rng = mulberry32(seed);
            const a = spawnLargeFromEdge(rng);

            const outsideTop = a.y === -A.LARGE_RADIUS;
            const outsideBottom = a.y === C.HEIGHT + A.LARGE_RADIUS;
            const outsideLeft = a.x === -A.LARGE_RADIUS;
            const outsideRight = a.x === C.WIDTH + A.LARGE_RADIUS;

            const onEdge = outsideTop || outsideBottom || outsideLeft || outsideRight;
            expect(onEdge).toBe(true);
        }
    });

    // ---------------------------------------------------------------------------
    // Test 7: Spawn direction — velocity points within ±SPAWN_ANGLE_SPREAD° of
    //         canvas center
    // ---------------------------------------------------------------------------
    it("velocity points within ±SPAWN_ANGLE_SPREAD° of canvas center", () => {
        const cx = C.WIDTH / 2;
        const cy = C.HEIGHT / 2;

        for (let seed = 0; seed < 40; seed++) {
            const rng = mulberry32(seed);
            const a = spawnLargeFromEdge(rng);

            // Vector from asteroid center toward canvas center
            const toCenter = { x: cx - a.x, y: cy - a.y };
            const toCenterLen = Math.sqrt(toCenter.x ** 2 + toCenter.y ** 2);

            // Angle between velocity and direction to canvas center
            const angleDeg = Math.abs(
                angleBetweenDeg(
                    a.vx,
                    a.vy,
                    toCenter.x / toCenterLen,
                    toCenter.y / toCenterLen
                )
            );

            expect(angleDeg).toBeLessThanOrEqual(A.SPAWN_ANGLE_SPREAD + 1e-9);
        }
    });

    // ---------------------------------------------------------------------------
    // Test 8: Spawn speed formula verification
    // ---------------------------------------------------------------------------
    it("large spawn speed = SPEED_MIN exactly", () => {
        const speed = tierSpeedFormula(A.LARGE_RADIUS);
        expect(speed).toBeCloseTo(A.SPEED_MIN, 10);
    });

    it("speed formula: MEDIUM_RADIUS ≈ 0.929 px/tick", () => {
        const speed = tierSpeedFormula(A.MEDIUM_RADIUS);
        // Formula: 0.5 + (1.5 - 0.5) * (1 - 16/28) = 0.5 + 1 * (12/28) = 0.5 + 3/7 ≈ 0.9286
        expect(speed).toBeCloseTo(0.9286, 3);
    });

    it("speed formula: SMALL_RADIUS ≈ 1.214 px/tick", () => {
        const speed = tierSpeedFormula(A.SMALL_RADIUS);
        // Formula: 0.5 + (1.5 - 0.5) * (1 - 8/28) = 0.5 + 1 * (20/28) = 0.5 + 5/7 ≈ 1.2143
        expect(speed).toBeCloseTo(1.2143, 3);
    });

    it("large spawn: actual velocity magnitude = SPEED_MIN", () => {
        const rng = mulberry32(55);
        const a = spawnLargeFromEdge(rng);
        const speed = Math.sqrt(a.vx ** 2 + a.vy ** 2);
        expect(speed).toBeCloseTo(A.SPEED_MIN, 8);
    });
});

// ---------------------------------------------------------------------------
// updateAsteroid wrap test
// ---------------------------------------------------------------------------
describe("updateAsteroid", () => {
    it("wraps correctly when moving off right edge", () => {
        const r = tierRadius("large");
        const a: AsteroidState = {
            x: C.WIDTH + r - 0.1, // just inside the wrap threshold
            y: 100,
            vx: 1,
            vy: 0,
            tier: "large",
            vertices: [],
        };
        // After one tick: x = C.WIDTH + r + 0.9, which is > C.WIDTH + r → wraps
        const updated = updateAsteroid(a);
        expect(updated.x).toBeLessThan(a.x);
    });

    it("wraps from left edge to right", () => {
        const r = tierRadius("large");
        const a: AsteroidState = {
            x: -r - 0.5, // past the left wrap threshold
            y: 100,
            vx: -1,
            vy: 0,
            tier: "large",
            vertices: [],
        };
        const updated = updateAsteroid(a);
        expect(updated.x).toBeGreaterThan(a.x);
    });

    it("tierRadius returns correct values", () => {
        expect(tierRadius("large")).toBe(A.LARGE_RADIUS);
        expect(tierRadius("medium")).toBe(A.MEDIUM_RADIUS);
        expect(tierRadius("small")).toBe(A.SMALL_RADIUS);
    });
});

// ---------------------------------------------------------------------------
// T-06 follow-on: split-children non-overlap after one tick (non-zero parent velocity)
// ---------------------------------------------------------------------------

describe("split children do not overlap after one tick", () => {
    it("children continue to separate after one tick when parent has non-zero velocity", () => {
        // Parent has non-zero velocity; verify children's center-to-center
        // distance after one tick is strictly greater than their initial
        // post-split separation (the diverge angle pushes them apart).
        for (let seed = 0; seed < 20; seed++) {
            const rng = mulberry32(seed * 31 + 7);
            const parent: AsteroidState = {
                x: 168,
                y: 131,
                vx: 1.2,
                vy: 0.4,
                tier: "large",
                vertices: [],
            };
            const kids = splitAsteroid(parent, rng);
            expect(kids).toHaveLength(2);

            const initialSep = Math.hypot(
                kids[0].x - kids[1].x,
                kids[0].y - kids[1].y,
            );

            const a = updateAsteroid(kids[0]);
            const b = updateAsteroid(kids[1]);
            const sepAfter = Math.hypot(a.x - b.x, a.y - b.y);

            // Children diverge — separation must grow each tick
            expect(sepAfter).toBeGreaterThan(initialSep);
        }
    });

    // -----------------------------------------------------------------------
    // T-06 follow-on: medium → 2 small children of correct tier/radius
    // -----------------------------------------------------------------------
    it("medium tier splits into 2 small children with SMALL_RADIUS", () => {
        const rng = mulberry32(123);
        const parent: AsteroidState = {
            x: 100,
            y: 100,
            vx: 1,
            vy: 0,
            tier: "medium",
            vertices: [],
        };
        const kids = splitAsteroid(parent, rng);
        expect(kids).toHaveLength(2);
        for (const k of kids) {
            expect(k.tier).toBe("small");
            expect(tierRadius(k.tier)).toBe(A.SMALL_RADIUS);
        }
    });
});

// Suppress the fixedRng unused warning (it is used in other potential tests)
void fixedRng;
