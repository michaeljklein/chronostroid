import type { ShipState } from "./ship";

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
