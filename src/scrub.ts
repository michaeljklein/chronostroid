import type { ShipState } from "./ship";
import type { Vec2 } from "./voronoi";

/**
 * T-17 HP-scrubbing helper: while a zone is in time travel, the live ship's HP
 * is overwritten by the visible snapshot's HP so that rewinding past a hit
 * actually restores the lost HP. When not in time travel, the live HP is
 * authoritative and this is a no-op.
 */
export function applyScrubHp(
    ship: ShipState,
    snapshotHp: number,
    inTimeTravel: boolean,
): ShipState {
    if (!inTimeTravel) return ship;
    if (ship.hp === snapshotHp) return ship;
    return { ...ship, hp: snapshotHp };
}

/**
 * Heal-event detector for audio: a positive delta in the visible snapshot's
 * HP between frames means the player is rewinding across a damage tick.
 */
export function detectHeal(prevSnapshotHp: number, currentSnapshotHp: number): boolean {
    return currentSnapshotHp > prevSnapshotHp;
}

/**
 * T-18 Voronoi-rewind helper: returns the position used for bisector +
 * asteroid/bullet partitioning in this zone. While in TT it is the ghost
 * (scrubbed-tick) position; otherwise it is the live position. The live
 * ship's own boundary clamp continues to use live positions — display
 * positions only drive the (virtual) bisector that the world's objects
 * partition against, which is what enables a rewind to redirect asteroids
 * onto the opponent.
 */
export function displayPosition(
    livePos: Vec2,
    ghostPos: Vec2,
    inTimeTravel: boolean,
): Vec2 {
    return inTimeTravel ? ghostPos : livePos;
}
