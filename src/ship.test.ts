import { describe, it, expect } from "vitest";
import { createShip, updateShip } from "./ship";
import CONSTANTS from "./constants.json";

// A no-op boundary that is degenerate (selfX === otherX, selfY === otherY) → clamping skipped.
const NO_BOUNDARY = { selfX: 0, selfY: 0, otherX: 0, otherY: 0 };

// Input helpers
const noInput = { rotateLeft: false, rotateRight: false, thrust: false };
const thrustOnly = { rotateLeft: false, rotateRight: false, thrust: true };
const bothRotate = { rotateLeft: true, rotateRight: true, thrust: false };

describe("Ship entity (T-03)", () => {
    it("thrust below max speed: no drag; velocity accumulates linearly", () => {
        // Ship facing right (angle=0), thrust for several ticks, speed stays below MAX_SPEED
        let state = createShip(100, 100, 0, CONSTANTS.HP.INITIAL);

        // Thrust for a few ticks (THRUST_ACCEL = 0.1, MAX_SPEED = 4 → safe for <40 ticks)
        const ticks = 5;
        for (let i = 0; i < ticks; i++) {
            state = updateShip(state, thrustOnly, NO_BOUNDARY);
        }

        const expectedVx = CONSTANTS.SHIP.THRUST_ACCEL * ticks;
        // No drag applied below MAX_SPEED
        expect(state.vx).toBeCloseTo(expectedVx, 10);
        expect(state.vy).toBeCloseTo(0, 10);
    });

    it("thrust above max speed: drag applied; speed asymptotically approaches MAX_SPEED", () => {
        // Start with velocity well above MAX_SPEED, then apply thrust for 1 tick
        const overSpeed = CONSTANTS.SHIP.MAX_SPEED + 2;
        let state = createShip(100, 100, 0, CONSTANTS.HP.INITIAL);
        // Manually set velocity above MAX_SPEED
        state = { ...state, vx: overSpeed, vy: 0 };

        const before = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
        expect(before).toBeGreaterThan(CONSTANTS.SHIP.MAX_SPEED);

        // One tick with thrust: thrust applied first, then drag fires (speed still > MAX_SPEED)
        state = updateShip(state, thrustOnly, NO_BOUNDARY);

        // After thrust: vx = overSpeed + THRUST_ACCEL, then drag fires
        const expectedVx =
            (overSpeed + CONSTANTS.SHIP.THRUST_ACCEL) * CONSTANTS.SHIP.DRAG_FACTOR;
        expect(state.vx).toBeCloseTo(expectedVx, 10);

        // Run many more ticks with no thrust to verify speed converges toward (not above) MAX_SPEED
        state = { ...state, vx: overSpeed * 2, vy: 0 };
        for (let i = 0; i < 200; i++) {
            state = updateShip(state, noInput, NO_BOUNDARY);
        }
        const finalSpeed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
        expect(finalSpeed).toBeLessThanOrEqual(CONSTANTS.SHIP.MAX_SPEED);
    });

    it("canvas wrap: ship at x = CANVAS.WIDTH + 1 wraps to x = 1", () => {
        // Place ship just outside right edge with no velocity (vx=0), so position wraps
        // x = WIDTH + 1 wraps to 1; to reach that position set vx=1 from x=WIDTH
        let state = createShip(CONSTANTS.CANVAS.WIDTH, 100, 0, CONSTANTS.HP.INITIAL);
        state = { ...state, vx: 1, vy: 0 };

        state = updateShip(state, noInput, NO_BOUNDARY);

        // x was CANVAS.WIDTH, vx=1 → x becomes CANVAS.WIDTH+1 → wraps to 1
        expect(state.x).toBeCloseTo(1, 10);
    });

    it("both D-pad directions held: no rotation", () => {
        const initialAngle = 45;
        let state = createShip(100, 100, initialAngle, CONSTANTS.HP.INITIAL);

        state = updateShip(state, bothRotate, NO_BOUNDARY);

        expect(state.angle).toBe(initialAngle);
    });

    it("boundary clamp: crossed ship repositioned to boundary; perpendicular velocity zeroed; tangential unchanged", () => {
        // Setup: self at (84, 131), other at (252, 131) — midpoint x=168, bisector is vertical line x=168
        // Push ship to x=200 (other side) with vx=5 (perpendicular to bisector), vy=3 (tangential)
        const selfX = 84;
        const selfY = 131;
        const otherX = 252;
        const otherY = 131;
        const boundary = { selfX, selfY, otherX, otherY };

        // Position ship on self's side, give it velocity that will cross bisector this tick.
        // Bisector is at x=168. Put ship at x=166, vx=3 vy=1 — speed=sqrt(10)≈3.16 < MAX_SPEED,
        // so drag does NOT fire. After integration: x=169 > 168 → crosses boundary.
        const state = createShip(166, 131, 0, CONSTANTS.HP.INITIAL);
        const stateWithVel = { ...state, vx: 3, vy: 1 };

        const result = updateShip(stateWithVel, noInput, boundary);

        // Ship clamped to bisector line x=168.
        expect(result.x).toBeCloseTo(168, 5);

        // Perpendicular to bisector is horizontal (x-axis). vx should be ~0.
        expect(result.vx).toBeCloseTo(0, 5);

        // Tangential component (vy) should be unchanged (no drag, no perpendicular removal).
        expect(result.vy).toBeCloseTo(1, 5);
    });
});
