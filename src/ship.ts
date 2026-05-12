import p5 from "p5";
import CONSTANTS from "./constants.json";

export type ShipState = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number; // degrees
    hp: number;
};

export type ShipInput = {
    rotateLeft: boolean;
    rotateRight: boolean;
    thrust: boolean;
};

// Perpendicular bisector of the two ships defines the zone boundary.
// selfX/selfY: the self ship's reference position (same side as this ship).
// otherX/otherY: the other ship's position.
// A point is on self's side when dist(point, self) <= dist(point, other).
export type BoundaryRef = {
    selfX: number;
    selfY: number;
    otherX: number;
    otherY: number;
};

const DEG_TO_RAD = Math.PI / 180;

export function createShip(x: number, y: number, angleDeg: number, hp: number): ShipState {
    return { x, y, vx: 0, vy: 0, angle: angleDeg, hp };
}

export function updateShip(state: ShipState, input: ShipInput, boundary: BoundaryRef): ShipState {
    let { x, y, vx, vy, angle } = state;
    const { hp } = state;

    // Rotation: both held simultaneously → no rotation
    if (input.rotateLeft && !input.rotateRight) {
        angle -= CONSTANTS.SHIP.ROTATION_SPEED;
    } else if (input.rotateRight && !input.rotateLeft) {
        angle += CONSTANTS.SHIP.ROTATION_SPEED;
    }

    // Thrust
    if (input.thrust) {
        const rad = angle * DEG_TO_RAD;
        vx += Math.cos(rad) * CONSTANTS.SHIP.THRUST_ACCEL;
        vy += Math.sin(rad) * CONSTANTS.SHIP.THRUST_ACCEL;
    }

    // Soft speed cap: drag only when speed exceeds MAX_SPEED
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > CONSTANTS.SHIP.MAX_SPEED) {
        vx *= CONSTANTS.SHIP.DRAG_FACTOR;
        vy *= CONSTANTS.SHIP.DRAG_FACTOR;
    }

    // Integrate position
    x += vx;
    y += vy;

    // Canvas wrap
    if (x < 0) x += CONSTANTS.CANVAS.WIDTH;
    else if (x >= CONSTANTS.CANVAS.WIDTH) x -= CONSTANTS.CANVAS.WIDTH;
    if (y < 0) y += CONSTANTS.CANVAS.HEIGHT;
    else if (y >= CONSTANTS.CANVAS.HEIGHT) y -= CONSTANTS.CANVAS.HEIGHT;

    // Zone boundary clamping
    const { selfX, selfY, otherX, otherY } = boundary;
    const dx = otherX - selfX;
    const dy = otherY - selfY;
    const bisectorLenSq = dx * dx + dy * dy;

    if (bisectorLenSq > 0) {
        // Check if new position is on self's side: dist(pos, self) <= dist(pos, other)
        const dSelf = (x - selfX) * (x - selfX) + (y - selfY) * (y - selfY);
        const dOther = (x - otherX) * (x - otherX) + (y - otherY) * (y - otherY);

        if (dSelf > dOther) {
            // Ship crossed to the other side — project position onto bisector
            // Bisector passes through midpoint M and is perpendicular to (dx, dy)
            const mx = (selfX + otherX) / 2;
            const my = (selfY + otherY) / 2;

            // Normal to bisector is (dx, dy) (the vector from self to other)
            // Bisector direction (tangent) is (-dy, dx) (perpendicular to normal)
            // Project (x - mx, y - my) onto the normal:
            //   t = ((x - mx)*dx + (y - my)*dy) / bisectorLenSq
            // Clamped position = (x,y) - t*(dx,dy)  [remove normal component]
            const ex = x - mx;
            const ey = y - my;
            const t = (ex * dx + ey * dy) / bisectorLenSq;
            x = x - t * dx;
            y = y - t * dy;

            // Decompose velocity into perpendicular (along bisector normal = dx,dy) and tangential
            // Perpendicular component: (v · n̂) * n̂
            const nLen = Math.sqrt(bisectorLenSq);
            const nx = dx / nLen;
            const ny = dy / nLen;
            const vPerp = vx * nx + vy * ny;
            // Zero out perpendicular component
            vx = vx - vPerp * nx;
            vy = vy - vPerp * ny;
        }
    }

    return { x, y, vx, vy, angle, hp };
}

export function drawShip(p: p5, state: ShipState, color: p5.Color, alpha: number = 255): void {
    const rad = state.angle * DEG_TO_RAD;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    // Nose vertex
    const noseX = state.x + cosA * CONSTANTS.SHIP.NOSE_DIST;
    const noseY = state.y + sinA * CONSTANTS.SHIP.NOSE_DIST;

    // Flank vertices at angle ± FLANK_ANGLE degrees
    const flankRadL = (state.angle + CONSTANTS.SHIP.FLANK_ANGLE) * DEG_TO_RAD;
    const flankRadR = (state.angle - CONSTANTS.SHIP.FLANK_ANGLE) * DEG_TO_RAD;

    const flankLX = state.x + Math.cos(flankRadL) * CONSTANTS.SHIP.FLANK_DIST;
    const flankLY = state.y + Math.sin(flankRadL) * CONSTANTS.SHIP.FLANK_DIST;

    const flankRX = state.x + Math.cos(flankRadR) * CONSTANTS.SHIP.FLANK_DIST;
    const flankRY = state.y + Math.sin(flankRadR) * CONSTANTS.SHIP.FLANK_DIST;

    p.push();
    const c = p.color(p.red(color), p.green(color), p.blue(color), alpha);
    p.fill(c);
    p.noStroke();
    p.beginShape();
    p.vertex(noseX, noseY);
    p.vertex(flankLX, flankLY);
    p.vertex(flankRX, flankRY);
    p.endShape(p.CLOSE);
    p.pop();
}
