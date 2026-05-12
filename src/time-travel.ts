import CONSTANTS from "./constants.json";
import {
    type ZoneHistory,
    type ZoneSnapshot,
    createZoneHistory,
    recordTick,
    rewind,
    fastForward,
    atFrontier,
    currentSnapshot,
} from "./zone-history";
import {
    type EnergyState,
    createEnergy,
    tickEnergy,
    canTimeTravel,
} from "./energy";

// Re-export for convenience
export type { ZoneSnapshot } from "./zone-history";
export type { EnergyState } from "./energy";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TimeTravelState = {
    history: ZoneHistory;
    energy: EnergyState;
    /** true while current node !== frontier from rewinds */
    inTimeTravel: boolean;
    /** snapshot at the frontier when entering time travel */
    lastPresentSnapshot: ZoneSnapshot;
    /** for HUD/tests; resolved per-frame */
    ticksSpunThisFrame: number;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTimeTravelState(initialSnapshot: ZoneSnapshot): TimeTravelState {
    return {
        history: createZoneHistory(initialSnapshot),
        energy: createEnergy(),
        inTimeTravel: false,
        lastPresentSnapshot: initialSnapshot,
        ticksSpunThisFrame: 0,
    };
}

// ---------------------------------------------------------------------------
// recordPresent
// ---------------------------------------------------------------------------

/**
 * Called by the game loop when this zone is at the frontier (not in time travel)
 * and a fresh tick of live state has been produced.
 *
 * Contract: caller must only invoke when `!state.inTimeTravel`.
 * Silently returns state unchanged if called while inTimeTravel (defensive).
 */
export function recordPresent(
    state: TimeTravelState,
    snapshot: ZoneSnapshot,
): TimeTravelState {
    if (state.inTimeTravel) {
        // Defensive: caller should not invoke this during time travel.
        return state;
    }
    return {
        ...state,
        history: recordTick(state.history, snapshot),
        lastPresentSnapshot: snapshot,
    };
}

// ---------------------------------------------------------------------------
// tickTimeTravel
// ---------------------------------------------------------------------------

export function tickTimeTravel(
    state: TimeTravelState,
    spinnerDelta: number,
): {
    state: TimeTravelState;
    boost: { x: number; y: number } | null;
    visibleSnapshot: ZoneSnapshot;
} {
    const ticks = Math.abs(spinnerDelta) * CONSTANTS.REWIND.TICKS_PER_SPIN;

    // --- Case 1: No spinner movement ---
    if (ticks === 0) {
        const newEnergy = tickEnergy(state.energy, 0);
        const newState: TimeTravelState = {
            ...state,
            energy: newEnergy,
            ticksSpunThisFrame: 0,
        };
        return {
            state: newState,
            boost: null,
            visibleSnapshot: currentSnapshot(state.history),
        };
    }

    // --- Case 2: Spinner moved but no energy ---
    if (!canTimeTravel(state.energy)) {
        // No traversal, no regen (player is trying to spin but blocked)
        const newState: TimeTravelState = {
            ...state,
            ticksSpunThisFrame: 0,
        };
        return {
            state: newState,
            boost: null,
            visibleSnapshot: currentSnapshot(state.history),
        };
    }

    // --- Case 3: Spinner moved and have energy ---

    // Cap by energy
    const energyCap = Math.floor(state.energy.value / CONSTANTS.ENERGY.COST_PER_TICK);
    const effectiveTicks = Math.min(ticks, energyCap);

    // Track whether we were at the frontier before traversal (for lastPresentSnapshot logic)
    const wasAtFrontier = atFrontier(state.history);

    let boost: { x: number; y: number } | null = null;
    let frontierReached = false;
    let updatedHistory: ZoneHistory;

    if (spinnerDelta < 0) {
        // Rewind
        updatedHistory = rewind(state.history, effectiveTicks);
    } else {
        // Fast-forward
        const result = fastForward(state.history, effectiveTicks);
        updatedHistory = result.history;
        if (result.stepsTaken < effectiveTicks) {
            // Frontier was reached this frame
            frontierReached = true;
        }
    }

    // Deduct energy for actual ticks traversed
    const newEnergy = tickEnergy(state.energy, effectiveTicks);

    // Determine if we're entering time travel this frame
    // (started at frontier but ended off it)
    const nowAtFrontier = atFrontier(updatedHistory);

    let newInTimeTravel: boolean;
    let newLastPresentSnapshot = state.lastPresentSnapshot;

    if (frontierReached) {
        newInTimeTravel = false;
    } else if (nowAtFrontier) {
        // We moved but happen to still be at frontier (shouldn't occur on rewind, but be safe)
        newInTimeTravel = false;
    } else {
        newInTimeTravel = true;
    }

    // Save lastPresentSnapshot when transitioning from live → time-travel
    if (wasAtFrontier && !nowAtFrontier && spinnerDelta < 0) {
        // We just entered time travel — capture the frontier snapshot
        newLastPresentSnapshot = currentSnapshot(state.history);
    }

    // Compute boost vector if frontier was reached
    if (frontierReached) {
        const snapshot = currentSnapshot(updatedHistory);
        const angleRad = snapshot.ship.angle * (Math.PI / 180);
        const rawMagnitude =
            CONSTANTS.REWIND.FF_BOOST_SCALE *
            (effectiveTicks / CONSTANTS.REWIND.TICKS_PER_SPIN);
        const magnitude = Math.min(rawMagnitude, CONSTANTS.REWIND.MAX_BOOST_SPEED);
        boost = {
            x: magnitude * Math.cos(angleRad),
            y: magnitude * Math.sin(angleRad),
        };
    }

    const newState: TimeTravelState = {
        history: updatedHistory,
        energy: newEnergy,
        inTimeTravel: newInTimeTravel,
        lastPresentSnapshot: newLastPresentSnapshot,
        ticksSpunThisFrame: effectiveTicks,
    };

    return {
        state: newState,
        boost,
        visibleSnapshot: currentSnapshot(updatedHistory),
    };
}

// ---------------------------------------------------------------------------
// boundaryMidpoints
// ---------------------------------------------------------------------------

/**
 * Returns the midpoints used by the zone renderer for drawing solid and ghost
 * boundary lines for one player's zone.
 *
 * - `solid = midpoint(selfLastPresent, opponentGhostOrPresent)`
 * - `ghost = midpoint(selfGhost, opponentGhostOrPresent)` (only when selfGhost != null)
 *
 * "opponentGhostOrPresent" = otherGhost if provided, else other (live present).
 */
export function boundaryMidpoints(
    selfLastPresent: { x: number; y: number },
    selfGhost: { x: number; y: number } | null,
    other: { x: number; y: number },
    otherGhost: { x: number; y: number } | null,
): { solid: { x: number; y: number }; ghost?: { x: number; y: number } } {
    const opponentRef = otherGhost ?? other;

    const solid = {
        x: (selfLastPresent.x + opponentRef.x) / 2,
        y: (selfLastPresent.y + opponentRef.y) / 2,
    };

    if (selfGhost != null) {
        const ghost = {
            x: (selfGhost.x + opponentRef.x) / 2,
            y: (selfGhost.y + opponentRef.y) / 2,
        };
        return { solid, ghost };
    }

    return { solid };
}

// Re-export what tests and callers may need from dependencies
export { createZoneHistory, recordTick, rewind, fastForward, atFrontier, currentSnapshot };
export { createEnergy, tickEnergy, canTimeTravel };
