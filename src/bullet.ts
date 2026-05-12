import p5 from "p5";
import CONSTANTS from "./constants.json";

export type BulletOwner = 1 | 2;

export type BulletState = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ticksRemaining: number;
    owner: BulletOwner;
};

export type BulletFiringState = {
    cooldown: number;
    active: BulletState[];
};

const DEG_TO_RAD = Math.PI / 180;

export function createBulletFiringState(): BulletFiringState {
    return { cooldown: 0, active: [] };
}

export function tryFire(
    state: BulletFiringState,
    ship: { x: number; y: number; angle: number },
    owner: BulletOwner
): BulletFiringState {
    if (state.cooldown !== 0 || state.active.length >= CONSTANTS.BULLET.MAX_COUNT) {
        return state;
    }

    const rad = ship.angle * DEG_TO_RAD;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    const newBullet: BulletState = {
        x: ship.x + cosA * CONSTANTS.SHIP.NOSE_DIST,
        y: ship.y + sinA * CONSTANTS.SHIP.NOSE_DIST,
        vx: cosA * CONSTANTS.BULLET.SPEED,
        vy: sinA * CONSTANTS.BULLET.SPEED,
        ticksRemaining: CONSTANTS.BULLET.LIFETIME,
        owner,
    };

    return {
        cooldown: CONSTANTS.BULLET.COOLDOWN,
        active: [...state.active, newBullet],
    };
}

export function tickBullets(
    state: BulletFiringState,
    bHeld: boolean,
    ship: { x: number; y: number; angle: number },
    owner: BulletOwner
): BulletFiringState {
    // Step 1: Decrement cooldown (clamped at 0)
    const cooldown = Math.max(0, state.cooldown - 1);

    // Step 2: Advance existing bullets, decrement ticksRemaining, cull expired or off-canvas
    const advanced = state.active
        .map((b) => ({
            ...b,
            x: b.x + b.vx,
            y: b.y + b.vy,
            ticksRemaining: b.ticksRemaining - 1,
        }))
        .filter(
            (b) =>
                b.ticksRemaining > 0 &&
                b.x >= 0 &&
                b.x <= CONSTANTS.CANVAS.WIDTH &&
                b.y >= 0 &&
                b.y <= CONSTANTS.CANVAS.HEIGHT
        );

    let afterFire: BulletFiringState = { cooldown, active: advanced };

    // Step 3: If B is held, attempt to fire
    if (bHeld) {
        afterFire = tryFire(afterFire, ship, owner);
    }

    return afterFire;
}

export function drawBullet(p: p5, b: BulletState): void {
    p.push();
    p.fill(255);
    p.noStroke();
    p.circle(b.x, b.y, CONSTANTS.BULLET.RADIUS * 2);
    p.pop();
}
