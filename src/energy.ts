import CONSTANTS from './constants.json';

const { ENERGY } = CONSTANTS;

export type EnergyState = { value: number };

export function createEnergy(): EnergyState {
  return { value: ENERGY.MAX };
}

/**
 * Pure tick function. Returns a new EnergyState.
 *
 * @param state              Current energy state.
 * @param spinnerTicksThisFrame  Already-resolved tick count (|delta| × TICKS_PER_SPIN).
 *                           Pass 0 when the player is not time-traveling this frame.
 */
export function tickEnergy(
  state: EnergyState,
  spinnerTicksThisFrame: number,
): EnergyState {
  if (spinnerTicksThisFrame === 0) {
    // Regen tick — clamp to [0, MAX]
    const next = Math.min(state.value + ENERGY.REGEN_PER_TICK, ENERGY.MAX);
    return { value: next };
  }

  // Deduction — clamp at 0, no regen this frame
  const cost = Math.abs(spinnerTicksThisFrame) * ENERGY.COST_PER_TICK;
  const next = Math.max(state.value - cost, 0);
  return { value: next };
}

/** Returns true when the player has any energy left to time-travel. */
export function canTimeTravel(state: EnergyState): boolean {
  return state.value > 0;
}

/** Returns energy as a fraction of MAX, in [0, 1]. */
export function energyFraction(state: EnergyState): number {
  return state.value / ENERGY.MAX;
}
