import { describe, it, expect } from "vitest";
import CONSTANTS from "./constants.json";
import {
    createBulletFiringState,
    tickBullets,
    tryFire,
    type BulletFiringState,
} from "./bullet";

const DEG_TO_RAD = Math.PI / 180;

// A ship centered at the canvas, facing right (0°)
const DEFAULT_SHIP = {
    x: CONSTANTS.CANVAS.WIDTH / 2,
    y: CONSTANTS.CANVAS.HEIGHT / 2,
    angle: 0,
};

// Fire one bullet and return the resulting state
function fireOne(angle: number = 0): BulletFiringState {
    const state = createBulletFiringState();
    const ship = { ...DEFAULT_SHIP, angle };
    return tryFire(state, ship, 1);
}

describe("Bullet system", () => {
    it("bullet position advances by exactly BULLET.SPEED px/tick along firing direction", () => {
        const angle = 45; // arbitrary non-axis direction
        const rad = angle * DEG_TO_RAD;
        const state = fireOne(angle);

        expect(state.active).toHaveLength(1);
        const bullet = state.active[0];
        const startX = bullet.x;
        const startY = bullet.y;

        const advanced = tickBullets(state, false, DEFAULT_SHIP, 1);

        expect(advanced.active).toHaveLength(1);
        const b = advanced.active[0];
        expect(b.x).toBeCloseTo(startX + Math.cos(rad) * CONSTANTS.BULLET.SPEED, 10);
        expect(b.y).toBeCloseTo(startY + Math.sin(rad) * CONSTANTS.BULLET.SPEED, 10);
    });

    it("bullet removed exactly at BULLET.LIFETIME ticks", () => {
        // Inject a stationary bullet at canvas center so it never exits due to position.
        // This isolates the ticksRemaining expiry logic.
        const stationaryBullet = {
            x: CONSTANTS.CANVAS.WIDTH / 2,
            y: CONSTANTS.CANVAS.HEIGHT / 2,
            vx: 0,
            vy: 0,
            ticksRemaining: CONSTANTS.BULLET.LIFETIME,
            owner: 1 as const,
        };
        let state: BulletFiringState = { cooldown: 0, active: [stationaryBullet] };
        const ship = DEFAULT_SHIP;

        // Advance LIFETIME - 1 ticks; bullet should still exist
        for (let i = 0; i < CONSTANTS.BULLET.LIFETIME - 1; i++) {
            state = tickBullets(state, false, ship, 1);
        }
        expect(state.active).toHaveLength(1);
        expect(state.active[0].ticksRemaining).toBe(1);

        // One more tick: ticksRemaining goes to 0 → removed
        state = tickBullets(state, false, ship, 1);
        expect(state.active).toHaveLength(0);
    });

    it("firing at cap (3 active bullets): no new bullet created", () => {
        // Fire 3 bullets manually (bypassing cooldown by using tryFire directly each time)
        let state = createBulletFiringState();
        const ship = DEFAULT_SHIP;

        // First bullet: cooldown = 0
        state = tryFire(state, ship, 1);
        expect(state.active).toHaveLength(1);

        // Reset cooldown to 0 to test cap enforcement
        state = { cooldown: 0, active: state.active };
        state = tryFire(state, ship, 1);
        expect(state.active).toHaveLength(2);

        state = { cooldown: 0, active: state.active };
        state = tryFire(state, ship, 1);
        expect(state.active).toHaveLength(3);

        // Attempt fourth fire at cap
        state = { cooldown: 0, active: state.active };
        const before = state.active;
        state = tryFire(state, ship, 1);
        expect(state.active).toHaveLength(3);
        expect(state.active).toBe(before); // unchanged reference
    });

    it("firing before cooldown expires: no new bullet created", () => {
        const state = fireOne();
        expect(state.cooldown).toBe(CONSTANTS.BULLET.COOLDOWN);
        expect(state.active).toHaveLength(1);

        // cooldown is still > 0 — tryFire should not add a bullet
        const before = state.active;
        const attempted = tryFire(state, DEFAULT_SHIP, 1);
        expect(attempted.active).toHaveLength(1);
        expect(attempted.active).toBe(before); // unchanged reference (returned original state)
    });

    it("bullet at canvas edge removed on the tick it exits", () => {
        // Place a bullet one step away from the right edge
        const speed = CONSTANTS.BULLET.SPEED;
        const width = CONSTANTS.CANVAS.WIDTH;
        const height = CONSTANTS.CANVAS.HEIGHT;

        // Bullet traveling right: x will become > WIDTH after advance
        const edgeBullet = {
            x: width - speed + 0.001, // one tick away from exiting right edge
            y: height / 2,
            vx: speed,
            vy: 0,
            ticksRemaining: CONSTANTS.BULLET.LIFETIME,
            owner: 1 as const,
        };

        const state: BulletFiringState = { cooldown: 0, active: [edgeBullet] };
        const advanced = tickBullets(state, false, DEFAULT_SHIP, 1);

        // After advance: x = (width - speed + 0.001) + speed = width + 0.001 > WIDTH → removed
        expect(advanced.active).toHaveLength(0);
    });

    it("cooldown decrements every tick regardless of whether the player holds fire", () => {
        // Start with a manually-set cooldown high enough that holding fire still cannot fire
        // (because cooldown > 0). With NOT holding fire, cooldown must also decrement.
        const startCooldown = CONSTANTS.BULLET.COOLDOWN;

        // Case A: bHeld = false
        let stateA: BulletFiringState = { cooldown: startCooldown, active: [] };
        for (let i = 1; i <= 5; i++) {
            stateA = tickBullets(stateA, false, DEFAULT_SHIP, 1);
            expect(stateA.cooldown).toBe(startCooldown - i);
        }

        // Case B: bHeld = true. With pre-existing cooldown, tryFire is a no-op,
        // so the cooldown should still decrement by 1 each tick.
        let stateB: BulletFiringState = { cooldown: startCooldown, active: [] };
        for (let i = 1; i <= 5; i++) {
            stateB = tickBullets(stateB, true, DEFAULT_SHIP, 1);
            expect(stateB.cooldown).toBe(startCooldown - i);
        }
    });

    it("holding B with cooldown 0: fires exactly once per BULLET.COOLDOWN ticks", () => {
        // Start fresh with cooldown = 0
        let state = createBulletFiringState();
        const ship = DEFAULT_SHIP;

        // Detect fires by watching cooldown reset to BULLET.COOLDOWN.
        // Tick order: decrement cooldown → advance bullets → tryFire if bHeld.
        // Tick 1: cooldown 0→0, tryFire fires → cooldown = COOLDOWN.
        // Ticks 2..COOLDOWN: cooldown decrements down to 1.
        // Tick COOLDOWN+1: cooldown 1→0, tryFire fires again → cooldown = COOLDOWN.
        // So fire intervals are exactly COOLDOWN ticks apart.

        let fireCount = 0;
        let prevCooldown = state.cooldown;

        const totalTicks = CONSTANTS.BULLET.COOLDOWN * 3;
        for (let i = 0; i < totalTicks; i++) {
            state = tickBullets(state, true, ship, 1);
            // A fire occurred when cooldown jumped up to BULLET.COOLDOWN from a lower value
            if (state.cooldown === CONSTANTS.BULLET.COOLDOWN && prevCooldown < CONSTANTS.BULLET.COOLDOWN) {
                fireCount++;
            }
            prevCooldown = state.cooldown;
        }

        // After COOLDOWN*3 ticks holding B: should fire exactly 3 times
        expect(fireCount).toBe(3);
    });
});
