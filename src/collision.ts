import CONSTANTS from "./constants.json";
import type { ShipState } from "./ship";
import type { BulletState } from "./bullet";
import type { AsteroidState } from "./asteroid";
import { tierRadius, splitAsteroid } from "./asteroid";

const BULLET_RADIUS = CONSTANTS.BULLET.RADIUS;
const SHIP_RADIUS = CONSTANTS.SHIP.COLLISION_RADIUS;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CollisionSnapshot = {
    zoneId: 1 | 2;
    ship: ShipState;
    ghostShip?: ShipState;
    asteroids: AsteroidState[];
    bullets: BulletState[];
};

export type CollisionEvent =
    | { kind: "bullet-hit-asteroid"; bulletOwner: 1 | 2 }
    | { kind: "bullet-hit-ship"; bulletOwner: 1 | 2 }
    | { kind: "bullet-despawned-by-ghost"; bulletOwner: 1 | 2 }
    | { kind: "asteroid-hit-ship" }
    | { kind: "asteroid-despawned-by-ghost" };

export type CollisionResult = {
    ship: ShipState;
    ghostShip?: ShipState;
    asteroids: AsteroidState[];
    bullets: BulletState[];
    events: CollisionEvent[];
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function dist(ax: number, ay: number, bx: number, by: number): number {
    return Math.hypot(ax - bx, ay - by);
}

// ---------------------------------------------------------------------------
// Main collision resolver
// ---------------------------------------------------------------------------

/**
 * Pure function: resolves all collisions within a single zone snapshot for
 * one tick. Returns fresh state — input arrays/objects are never mutated.
 *
 * Processing order:
 *   1. Bullet vs asteroids
 *   2. Bullet vs ships (live then ghost)
 *   3. Asteroid vs ships (live then ghost)
 */
export function resolveCollisions(
    snapshot: CollisionSnapshot,
    rng: () => number
): CollisionResult {
    const events: CollisionEvent[] = [];

    // Working copies — these sets track which bullets/asteroids have been consumed.
    // We build up the final arrays incrementally.
    const removedBulletIdxs = new Set<number>();
    const removedAsteroidIdxs = new Set<number>();
    const addedAsteroids: AsteroidState[] = []; // split children

    let ship = snapshot.ship;
    // ghostShip is never mutated (ghosts take no HP)
    const ghostShip = snapshot.ghostShip;

    // -------------------------------------------------------------------------
    // Phase 1: Bullet vs asteroids
    // -------------------------------------------------------------------------
    for (let bi = 0; bi < snapshot.bullets.length; bi++) {
        if (removedBulletIdxs.has(bi)) continue;
        const bullet = snapshot.bullets[bi];

        for (let ai = 0; ai < snapshot.asteroids.length; ai++) {
            if (removedAsteroidIdxs.has(ai)) continue;
            const asteroid = snapshot.asteroids[ai];

            const threshold = BULLET_RADIUS + tierRadius(asteroid.tier);
            if (dist(bullet.x, bullet.y, asteroid.x, asteroid.y) < threshold) {
                // Bullet hit asteroid: split asteroid, remove bullet
                removedBulletIdxs.add(bi);
                removedAsteroidIdxs.add(ai);
                const children = splitAsteroid(asteroid, rng);
                for (const child of children) addedAsteroids.push(child);
                events.push({ kind: "bullet-hit-asteroid", bulletOwner: bullet.owner });
                break; // bullet is consumed — move to next bullet
            }
        }
    }

    // -------------------------------------------------------------------------
    // Phase 2: Bullet vs live ship, then bullet vs ghost ship
    // -------------------------------------------------------------------------
    for (let bi = 0; bi < snapshot.bullets.length; bi++) {
        if (removedBulletIdxs.has(bi)) continue;
        const bullet = snapshot.bullets[bi];

        const shipThreshold = BULLET_RADIUS + SHIP_RADIUS;

        // Check live ship
        if (dist(bullet.x, bullet.y, ship.x, ship.y) < shipThreshold) {
            removedBulletIdxs.add(bi);
            ship = { ...ship, hp: ship.hp - 1 };
            events.push({ kind: "bullet-hit-ship", bulletOwner: bullet.owner });
            continue;
        }

        // Check ghost ship (if present)
        if (
            ghostShip !== undefined &&
            dist(bullet.x, bullet.y, ghostShip.x, ghostShip.y) < shipThreshold
        ) {
            removedBulletIdxs.add(bi);
            events.push({ kind: "bullet-despawned-by-ghost", bulletOwner: bullet.owner });
        }
    }

    // -------------------------------------------------------------------------
    // Phase 3: Asteroid vs live ship, then asteroid vs ghost ship
    // -------------------------------------------------------------------------
    for (let ai = 0; ai < snapshot.asteroids.length; ai++) {
        if (removedAsteroidIdxs.has(ai)) continue;
        const asteroid = snapshot.asteroids[ai];
        const asteroidR = tierRadius(asteroid.tier);

        const shipThreshold = asteroidR + SHIP_RADIUS;

        // Check live ship
        if (dist(asteroid.x, asteroid.y, ship.x, ship.y) < shipThreshold) {
            removedAsteroidIdxs.add(ai);
            ship = { ...ship, hp: ship.hp - 1 };
            events.push({ kind: "asteroid-hit-ship" });
            continue;
        }

        // Check ghost ship (if present)
        if (
            ghostShip !== undefined &&
            dist(asteroid.x, asteroid.y, ghostShip.x, ghostShip.y) < shipThreshold
        ) {
            removedAsteroidIdxs.add(ai);
            events.push({ kind: "asteroid-despawned-by-ghost" });
        }
    }

    // -------------------------------------------------------------------------
    // Build result arrays
    // -------------------------------------------------------------------------
    const survivingBullets = snapshot.bullets.filter(
        (_, i) => !removedBulletIdxs.has(i)
    );

    const survivingAsteroids = snapshot.asteroids.filter(
        (_, i) => !removedAsteroidIdxs.has(i)
    );
    const finalAsteroids = [...survivingAsteroids, ...addedAsteroids];

    return {
        ship,
        ghostShip,
        asteroids: finalAsteroids,
        bullets: survivingBullets,
        events,
    };
}
