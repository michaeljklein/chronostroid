import p5 from "p5";
import CONSTANTS from "./constants.json";

export type Tier = "large" | "medium" | "small";

export type AsteroidState = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    tier: Tier;
    vertices: Array<{ x: number; y: number }>;
};

const A = CONSTANTS.ASTEROID;
const C = CONSTANTS.CANVAS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function tierRadius(tier: Tier): number {
    if (tier === "large") return A.LARGE_RADIUS;
    if (tier === "medium") return A.MEDIUM_RADIUS;
    return A.SMALL_RADIUS;
}

/** Deterministic speed formula for a given tier radius.
 *  Only applied to freshly-spawned large asteroids at runtime;
 *  exported so tests can verify values directly.
 */
export function tierSpeedFormula(r: number): number {
    return (
        A.SPEED_MIN +
        (A.SPEED_MAX - A.SPEED_MIN) * (1 - r / A.LARGE_RADIUS)
    );
}

/** Generate 6-9 irregular polygon vertices in local space. */
function generateVertices(
    rng: () => number,
    radius: number
): Array<{ x: number; y: number }> {
    const count = 6 + Math.floor(rng() * 4); // 6, 7, 8, or 9
    const verts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < count; i++) {
        const angle = ((Math.PI * 2) / count) * i;
        // Radius between 80% and 120% of tier radius
        const r = radius * (0.8 + rng() * 0.4);
        verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return verts;
}

/** Rotate a vector (vx, vy) by `angleDeg` degrees, return new (vx, vy). */
function rotateVec(
    vx: number,
    vy: number,
    angleDeg: number
): { vx: number; vy: number } {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { vx: cos * vx - sin * vy, vy: sin * vx + cos * vy };
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Spawn a large asteroid from a random canvas edge.
 * Center is placed exactly LARGE_RADIUS px outside the chosen edge.
 * Velocity is aimed toward canvas center within ±SPAWN_ANGLE_SPREAD°.
 */
export function spawnLargeFromEdge(rng: () => number): AsteroidState {
    const cx = C.WIDTH / 2;
    const cy = C.HEIGHT / 2;

    // Pick one of four edges: 0=top, 1=right, 2=bottom, 3=left
    const edge = Math.floor(rng() * 4);

    let x: number;
    let y: number;

    if (edge === 0) {
        // Top edge
        x = rng() * C.WIDTH;
        y = -A.LARGE_RADIUS;
    } else if (edge === 1) {
        // Right edge
        x = C.WIDTH + A.LARGE_RADIUS;
        y = rng() * C.HEIGHT;
    } else if (edge === 2) {
        // Bottom edge
        x = rng() * C.WIDTH;
        y = C.HEIGHT + A.LARGE_RADIUS;
    } else {
        // Left edge
        x = -A.LARGE_RADIUS;
        y = rng() * C.HEIGHT;
    }

    // Angle toward canvas center
    const baseAngle = Math.atan2(cy - y, cx - x);
    // Random deviation within ±SPAWN_ANGLE_SPREAD degrees
    const spreadRad = (A.SPAWN_ANGLE_SPREAD * Math.PI) / 180;
    const deviation = (rng() * 2 - 1) * spreadRad;
    const finalAngle = baseAngle + deviation;

    const speed = tierSpeedFormula(A.LARGE_RADIUS); // = SPEED_MIN exactly
    const vx = Math.cos(finalAngle) * speed;
    const vy = Math.sin(finalAngle) * speed;

    const vertices = generateVertices(rng, A.LARGE_RADIUS);

    return { x, y, vx, vy, tier: "large", vertices };
}

/**
 * Advance asteroid one tick: constant velocity + canvas-edge wrap.
 * Center exits one side and re-enters the opposite.
 */
export function updateAsteroid(state: AsteroidState): AsteroidState {
    let x = state.x + state.vx;
    let y = state.y + state.vy;
    const r = tierRadius(state.tier);

    // Wrap: when center fully exits one edge, teleport to opposite edge
    if (x < -r) x += C.WIDTH + 2 * r;
    else if (x > C.WIDTH + r) x -= C.WIDTH + 2 * r;

    if (y < -r) y += C.HEIGHT + 2 * r;
    else if (y > C.HEIGHT + r) y -= C.HEIGHT + 2 * r;

    return { ...state, x, y };
}

/**
 * Split an asteroid into children of the next smaller tier.
 * - large → 2 medium
 * - medium → 2 small
 * - small → []
 * Speed magnitude is inherited from parent. Fresh vertices generated for each child.
 */
export function splitAsteroid(
    state: AsteroidState,
    rng: () => number
): AsteroidState[] {
    if (state.tier === "small") return [];

    const childTier: Tier = state.tier === "large" ? "medium" : "small";
    const parentRadius = tierRadius(state.tier);

    // Perpendicular to parent velocity
    const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
    let perpX: number;
    let perpY: number;
    if (speed === 0) {
        perpX = 0;
        perpY = 1;
    } else {
        // Perpendicular: rotate velocity 90°
        perpX = -state.vy / speed;
        perpY = state.vx / speed;
    }

    const offset = parentRadius * A.SPLIT_OFFSET_FRACTION;

    const children: AsteroidState[] = [];
    // +1 and -1 for the two children
    for (const sign of [1, -1] as const) {
        const cx = state.x + sign * perpX * offset;
        const cy = state.y + sign * perpY * offset;

        // Base diverge angle ±SPLIT_DIVERGE_ANGLE, plus random spread ±SPLIT_RANDOM_SPREAD
        const diverge = sign * A.SPLIT_DIVERGE_ANGLE;
        const randomSpread = (rng() * 2 - 1) * A.SPLIT_RANDOM_SPREAD;
        const totalAngle = diverge + randomSpread;

        const rotated = rotateVec(state.vx, state.vy, totalAngle);

        children.push({
            x: cx,
            y: cy,
            vx: rotated.vx,
            vy: rotated.vy,
            tier: childTier,
            vertices: generateVertices(rng, tierRadius(childTier)),
        });
    }

    return children;
}

/**
 * Draw an asteroid as a wireframe polygon using local-space vertex offsets.
 */
export function drawAsteroid(p: p5, state: AsteroidState): void {
    p.noFill();
    p.stroke(255);
    p.strokeWeight(1);
    p.beginShape();
    for (const v of state.vertices) {
        p.vertex(state.x + v.x, state.y + v.y);
    }
    p.endShape(p.CLOSE);
}

// ---------------------------------------------------------------------------
// Pool API
// ---------------------------------------------------------------------------

export type Pool = {
    /** All currently active asteroids. */
    getAll: () => AsteroidState[];
    /**
     * Notify the pool that a large asteroid was destroyed (by a bullet split
     * or by ghost-despawn). Immediately replaces it with a fresh large
     * asteroid spawned from a random edge.
     */
    onLargeDestroyed: () => void;
    /**
     * Split one specific asteroid: remove it from the pool, add its children,
     * and — if it was large — call onLargeDestroyed to keep the large-asteroid
     * count at POOL_SIZE.
     */
    splitOne: (a: AsteroidState) => AsteroidState[];
    /**
     * Despawn (remove) a specific asteroid without splitting.
     * If it was large, calls onLargeDestroyed.
     */
    despawn: (a: AsteroidState) => void;
    /** Return a shallow copy of the active asteroid list (for snapshotting). */
    snapshot: () => AsteroidState[];
};

export function createPool(rng: () => number): Pool {
    const active: AsteroidState[] = [];

    // Seed the pool with POOL_SIZE large asteroids
    for (let i = 0; i < A.POOL_SIZE; i++) {
        active.push(spawnLargeFromEdge(rng));
    }

    function onLargeDestroyed(): void {
        active.push(spawnLargeFromEdge(rng));
    }

    function splitOne(a: AsteroidState): AsteroidState[] {
        const idx = active.indexOf(a);
        if (idx !== -1) active.splice(idx, 1);
        const children = splitAsteroid(a, rng);
        for (const child of children) active.push(child);
        if (a.tier === "large") onLargeDestroyed();
        return children;
    }

    function despawn(a: AsteroidState): void {
        const idx = active.indexOf(a);
        if (idx !== -1) active.splice(idx, 1);
        if (a.tier === "large") onLargeDestroyed();
    }

    function getAll(): AsteroidState[] {
        return active;
    }

    function snapshot(): AsteroidState[] {
        return [...active];
    }

    return { getAll, onLargeDestroyed, splitOne, despawn, snapshot };
}
