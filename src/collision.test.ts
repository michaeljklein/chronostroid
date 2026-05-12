import { describe, it, expect } from "vitest";
import { resolveCollisions } from "./collision";
import type { ZoneSnapshot } from "./collision";
import type { ShipState } from "./ship";
import type { BulletState } from "./bullet";
import type { AsteroidState } from "./asteroid";
import { tierRadius } from "./asteroid";
import CONSTANTS from "./constants.json";

// Deterministic no-op rng (splits should not need randomness in these tests)
const rng = (): number => 0.5;

const BULLET_RADIUS = CONSTANTS.BULLET.RADIUS;
const SHIP_RADIUS = CONSTANTS.SHIP.COLLISION_RADIUS;

// ---------------------------------------------------------------------------
// Helpers to build minimal state objects
// ---------------------------------------------------------------------------

function makeShip(x: number, y: number, hp = CONSTANTS.HP.INITIAL): ShipState {
    return { x, y, vx: 0, vy: 0, angle: 0, hp };
}

function makeBullet(x: number, y: number, owner: 1 | 2 = 1): BulletState {
    return { x, y, vx: 0, vy: 0, ticksRemaining: CONSTANTS.BULLET.LIFETIME, owner };
}

function makeAsteroid(
    x: number,
    y: number,
    tier: AsteroidState["tier"] = "large"
): AsteroidState {
    return { x, y, vx: 0, vy: 0, tier, vertices: [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("T-08 — Collision detection", () => {
    // -----------------------------------------------------------------------
    // Test 1: dist === sum of radii → no collision (strict <)
    // -----------------------------------------------------------------------
    it("bullet-asteroid: dist exactly equal to sum of radii does NOT trigger collision", () => {
        const asteroidTier: AsteroidState["tier"] = "large";
        const asteroidR = tierRadius(asteroidTier);
        const separation = BULLET_RADIUS + asteroidR; // exact boundary

        const bullet = makeBullet(0, 0);
        const asteroid = makeAsteroid(separation, 0, asteroidTier);

        const snapshot: ZoneSnapshot = {
            zoneId: 1,
            ship: makeShip(200, 200),
            asteroids: [asteroid],
            bullets: [bullet],
        };

        const result = resolveCollisions(snapshot, rng);

        // No collision: both bullet and asteroid survive
        expect(result.bullets).toHaveLength(1);
        expect(result.asteroids).toHaveLength(1);
        expect(result.events).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Test 2: dist === sum of radii - 0.1 → collision triggers
    // -----------------------------------------------------------------------
    it("bullet-asteroid: dist = sum of radii - 0.1 triggers collision", () => {
        const asteroidTier: AsteroidState["tier"] = "large";
        const asteroidR = tierRadius(asteroidTier);
        const separation = BULLET_RADIUS + asteroidR - 0.1; // just inside boundary

        const bullet = makeBullet(0, 0);
        const asteroid = makeAsteroid(separation, 0, asteroidTier);

        const snapshot: ZoneSnapshot = {
            zoneId: 1,
            ship: makeShip(200, 200),
            asteroids: [asteroid],
            bullets: [bullet],
        };

        const result = resolveCollisions(snapshot, rng);

        // Bullet consumed
        expect(result.bullets).toHaveLength(0);
        // Large asteroid splits into 2 medium children (original removed)
        const originalGone = result.asteroids.every((a) => a !== asteroid);
        expect(originalGone).toBe(true);
        expect(result.asteroids).toHaveLength(2); // 2 medium children
        expect(result.events).toHaveLength(1);
        expect(result.events[0].kind).toBe("bullet-hit-asteroid");
    });

    // -----------------------------------------------------------------------
    // Test 3: Ghost ship + bullet → bullet removed, live ship HP unchanged
    // -----------------------------------------------------------------------
    it("bullet vs ghost ship: bullet removed, live ship HP unchanged", () => {
        const ghostShip = makeShip(50, 50);
        // Place bullet exactly on the ghost ship (well within radius)
        const bullet = makeBullet(50, 50);
        const liveShip = makeShip(200, 200, 7);

        const snapshot: ZoneSnapshot = {
            zoneId: 1,
            ship: liveShip,
            ghostShip,
            asteroids: [],
            bullets: [bullet],
        };

        const result = resolveCollisions(snapshot, rng);

        // Bullet removed by ghost
        expect(result.bullets).toHaveLength(0);
        // Live ship HP unchanged
        expect(result.ship.hp).toBe(7);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].kind).toBe("bullet-despawned-by-ghost");
    });

    // -----------------------------------------------------------------------
    // Test 4: Ghost ship + asteroid → asteroid removed, live ship HP unchanged
    // -----------------------------------------------------------------------
    it("asteroid vs ghost ship: asteroid removed, live ship HP unchanged", () => {
        const ghostShip = makeShip(50, 50);
        // Place small asteroid exactly on the ghost ship
        const asteroid = makeAsteroid(50, 50, "small");
        const liveShip = makeShip(200, 200, 7);

        const snapshot: ZoneSnapshot = {
            zoneId: 1,
            ship: liveShip,
            ghostShip,
            asteroids: [asteroid],
            bullets: [],
        };

        const result = resolveCollisions(snapshot, rng);

        // Asteroid removed
        expect(result.asteroids).toHaveLength(0);
        // Live ship HP unchanged
        expect(result.ship.hp).toBe(7);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].kind).toBe("asteroid-despawned-by-ghost");
    });

    // -----------------------------------------------------------------------
    // Test 5: Asteroid + live ship → HP decreases by 1, asteroid removed
    // -----------------------------------------------------------------------
    it("asteroid vs live ship: HP decreases by 1, asteroid removed", () => {
        const initialHp = 8;
        const liveShip = makeShip(100, 100, initialHp);
        const asteroidTier: AsteroidState["tier"] = "medium";
        const asteroidR = tierRadius(asteroidTier);
        // Place asteroid so dist < asteroidR + SHIP_RADIUS
        const separation = asteroidR + SHIP_RADIUS - 0.1;
        const asteroid = makeAsteroid(100 + separation, 100, asteroidTier);

        const snapshot: ZoneSnapshot = {
            zoneId: 1,
            ship: liveShip,
            asteroids: [asteroid],
            bullets: [],
        };

        const result = resolveCollisions(snapshot, rng);

        expect(result.ship.hp).toBe(initialHp - 1);
        expect(result.asteroids).toHaveLength(0);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].kind).toBe("asteroid-hit-ship");
    });

    // -----------------------------------------------------------------------
    // Test 6: Cross-zone isolation
    //   asteroidX lives only in P1's snapshot. P2's snapshot has a bullet
    //   aimed at asteroidX's position but asteroidX is NOT in P2's asteroid
    //   array. resolveCollisions on P2's snapshot must not touch asteroidX.
    // -----------------------------------------------------------------------
    it("cross-zone isolation: bullet in P2 zone does not affect asteroidX in P1 zone", () => {
        // asteroidX belongs to P1's zone
        const asteroidX = makeAsteroid(150, 130, "large");

        // P1 snapshot contains asteroidX
        const p1Snapshot: ZoneSnapshot = {
            zoneId: 1,
            ship: makeShip(84, 131),
            asteroids: [asteroidX],
            bullets: [],
        };

        // P2 snapshot has a bullet aimed exactly at asteroidX's position,
        // but asteroidX is NOT in p2Snapshot.asteroids
        const bulletAtAsteroidX = makeBullet(asteroidX.x, asteroidX.y, 2);
        const p2Snapshot: ZoneSnapshot = {
            zoneId: 2,
            ship: makeShip(252, 131),
            asteroids: [], // asteroidX is absent here
            bullets: [bulletAtAsteroidX],
        };

        // Resolve only P2's snapshot
        const p2Result = resolveCollisions(p2Snapshot, rng);

        // No asteroid in P2's snapshot was hit (there were none)
        expect(p2Result.asteroids).toHaveLength(0);
        // The bullet found nothing to hit — it should still be present
        // (no live ship or ghost ship near it in p2Snapshot)
        expect(p2Result.bullets).toHaveLength(1);
        expect(p2Result.events).toHaveLength(0);

        // asteroidX is unmodified (it was never passed to resolveCollisions for P2)
        expect(asteroidX.x).toBe(150);
        expect(asteroidX.y).toBe(130);
        expect(asteroidX.tier).toBe("large");

        // P1 snapshot is also unaffected by P2's resolution
        expect(p1Snapshot.asteroids).toHaveLength(1);
        expect(p1Snapshot.asteroids[0]).toBe(asteroidX);
    });
});
