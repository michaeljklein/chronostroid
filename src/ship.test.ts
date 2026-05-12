import { describe, it, expect } from "vitest";
import { createShip, updateShip, drawShip } from "./ship";
import type p5 from "p5";
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

    it("y-axis canvas wrap: ship at y=-1 wraps to y=CANVAS.HEIGHT-1 and y=CANVAS.HEIGHT wraps to 0", () => {
        // First case: ship at y=0 moving up with vy=-1 → y becomes -1 → wraps to HEIGHT-1
        let state = createShip(100, 0, 0, CONSTANTS.HP.INITIAL);
        state = { ...state, vx: 0, vy: -1 };
        state = updateShip(state, noInput, NO_BOUNDARY);
        expect(state.y).toBeCloseTo(CONSTANTS.CANVAS.HEIGHT - 1, 10);

        // Second case: ship at y=HEIGHT-1 moving down with vy=1 → y becomes HEIGHT → wraps to 0
        let state2 = createShip(100, CONSTANTS.CANVAS.HEIGHT - 1, 0, CONSTANTS.HP.INITIAL);
        state2 = { ...state2, vx: 0, vy: 1 };
        state2 = updateShip(state2, noInput, NO_BOUNDARY);
        // y was HEIGHT-1, vy=1 → y becomes HEIGHT (>= HEIGHT) → wraps to 0
        expect(state2.y).toBeCloseTo(0, 10);
    });

    it("drawShip plumbs the alpha parameter through to fill color", () => {
        // Minimal p5 mock recording fill calls (and color construction)
        const fillCalls: unknown[][] = [];
        const colorArgs: unknown[][] = [];
        const mock = {
            push: () => {},
            pop: () => {},
            translate: () => {},
            rotate: () => {},
            beginShape: () => {},
            endShape: () => {},
            vertex: () => {},
            noStroke: () => {},
            stroke: () => {},
            noFill: () => {},
            line: () => {},
            triangle: () => {},
            CLOSE: "CLOSE",
            color: (...args: unknown[]) => {
                colorArgs.push(args);
                // Return a tagged object as the resulting color
                return { _color: args } as unknown;
            },
            fill: (...args: unknown[]) => {
                fillCalls.push(args);
            },
            red: () => 255,
            green: () => 0,
            blue: () => 0,
        } as unknown as p5;

        const state = createShip(50, 50, 0, CONSTANTS.HP.INITIAL);
        const fakeColor = {} as unknown as p5.Color;
        const customAlpha = 77;
        drawShip(mock, state, fakeColor, customAlpha);

        // Verify the color builder was called with our alpha as the last arg
        expect(colorArgs.length).toBeGreaterThan(0);
        const args = colorArgs[0];
        expect(args[args.length - 1]).toBe(customAlpha);
    });

    it("drawShip default alpha is 255 (opaque) when omitted", () => {
        const colorArgs: unknown[][] = [];
        const mock = {
            push: () => {},
            pop: () => {},
            beginShape: () => {},
            endShape: () => {},
            vertex: () => {},
            noStroke: () => {},
            stroke: () => {},
            noFill: () => {},
            line: () => {},
            triangle: () => {},
            translate: () => {},
            rotate: () => {},
            CLOSE: "CLOSE",
            color: (...args: unknown[]) => {
                colorArgs.push(args);
                return {} as unknown;
            },
            fill: () => {},
            red: () => 0,
            green: () => 0,
            blue: () => 255,
        } as unknown as p5;

        const state = createShip(50, 50, 0, CONSTANTS.HP.INITIAL);
        drawShip(mock, state, {} as unknown as p5.Color);

        expect(colorArgs.length).toBeGreaterThan(0);
        const args = colorArgs[0];
        expect(args[args.length - 1]).toBe(255);
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
