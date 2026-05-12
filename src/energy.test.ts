import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import CONSTANTS from './constants.json';
import {
  createEnergy,
  tickEnergy,
  canTimeTravel,
  energyFraction,
} from './energy';

const { ENERGY } = CONSTANTS;

// ---------------------------------------------------------------------------
// Property test — energy accounting / no floating-point drift
// ---------------------------------------------------------------------------

describe('energy accounting — property test', () => {
  it('after N spinner ticks each costing COST_PER_TICK, total deducted equals N × COST_PER_TICK (no drift over ≤3600 ticks)', () => {
    fc.assert(
      fc.property(
        // Array of per-frame tick counts; total sum ≤ 3600
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 36 }).filter(
          (arr) => arr.reduce((a, b) => a + b, 0) <= ENERGY.MAX / ENERGY.COST_PER_TICK,
        ),
        (tickCounts) => {
          const start = ENERGY.MAX; // full tank avoids clamping
          let state = createEnergy(); // starts at MAX
          expect(state.value).toBe(start);

          let totalDeducted = 0;
          for (const ticks of tickCounts) {
            state = tickEnergy(state, ticks);
            totalDeducted += ticks * ENERGY.COST_PER_TICK;
          }

          expect(state.value).toBe(start - totalDeducted);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('energy — regen never exceeds MAX', () => {
  it('energy stays at MAX when already full and regen ticks applied', () => {
    let state = createEnergy(); // full
    for (let i = 0; i < 100; i++) {
      state = tickEnergy(state, 0);
      expect(state.value).toBeLessThanOrEqual(ENERGY.MAX);
    }
  });

  it('energy approaches MAX from a near-full state without exceeding it', () => {
    // Start 1 REGEN_PER_TICK below MAX
    let state = { value: ENERGY.MAX - ENERGY.REGEN_PER_TICK };
    state = tickEnergy(state, 0);
    expect(state.value).toBe(ENERGY.MAX);

    // Another regen tick must not exceed MAX
    state = tickEnergy(state, 0);
    expect(state.value).toBe(ENERGY.MAX);
  });
});

describe('energy — deduction never goes below 0', () => {
  it('energy stays at 0 when over-depleted', () => {
    let state = { value: ENERGY.COST_PER_TICK * 0.5 }; // less than one tick cost
    state = tickEnergy(state, 1);
    expect(state.value).toBe(0);
  });

  it('energy stays at 0 on subsequent deductions', () => {
    let state = { value: 0 };
    for (let i = 0; i < 10; i++) {
      state = tickEnergy(state, 5);
      expect(state.value).toBe(0);
    }
  });
});

describe('energy — full regen from zero', () => {
  it('after full depletion, regen for MAX/REGEN_PER_TICK ticks returns energy to MAX', () => {
    let state = { value: 0 };
    const regenTicks = ENERGY.MAX / ENERGY.REGEN_PER_TICK;
    for (let i = 0; i < regenTicks; i++) {
      state = tickEnergy(state, 0);
    }
    expect(state.value).toBe(ENERGY.MAX);
  });
});

describe('canTimeTravel', () => {
  it('returns true when energy > 0', () => {
    expect(canTimeTravel({ value: 1 })).toBe(true);
    expect(canTimeTravel({ value: ENERGY.MAX })).toBe(true);
  });

  it('returns false when energy is 0', () => {
    expect(canTimeTravel({ value: 0 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-11 follow-on: regen and deduction are mutually exclusive per frame
// ---------------------------------------------------------------------------

describe('regen and deduction are mutually exclusive per frame', () => {
  it('spinner ticks > 0 → energy strictly decreases; ticks === 0 → energy increases (until MAX)', () => {
    // Start partway down so regen is observable
    const start = ENERGY.MAX / 2;

    // Deduction case: spinner ticks > 0 → must decrease
    let s1 = { value: start };
    s1 = tickEnergy(s1, 5);
    expect(s1.value).toBeLessThan(start);
    // Specifically: equals start - 5 * COST_PER_TICK
    expect(s1.value).toBe(start - 5 * ENERGY.COST_PER_TICK);

    // Regen case: spinner ticks === 0 → must increase
    let s2 = { value: start };
    s2 = tickEnergy(s2, 0);
    expect(s2.value).toBeGreaterThan(start);
    expect(s2.value).toBe(start + ENERGY.REGEN_PER_TICK);

    // Never both at once: same value cannot both regen AND deduct in one call
    // (by construction the two branches are mutually exclusive in tickEnergy).
  });
});

describe('energyFraction', () => {
  it('returns 1 when full', () => {
    expect(energyFraction(createEnergy())).toBe(1);
  });

  it('returns 0 when empty', () => {
    expect(energyFraction({ value: 0 })).toBe(0);
  });

  it('returns correct fraction', () => {
    expect(energyFraction({ value: ENERGY.MAX / 2 })).toBe(0.5);
  });
});
