import p5 from "p5";
import CONSTANTS from "./constants.json";
import {
    createInputState,
    readFrame,
    selectPlayerInput,
    selectSystemInput,
    type InputState,
    type PlayerInput,
} from "./input";
import {
    createGameState,
    tickLobby,
    tickPlaying,
    tickGameOver,
    drawLobby,
    drawGameOver,
    type GameState,
} from "./game";
import {
    createShip,
    updateShip,
    drawShip,
    type ShipState,
    type BoundaryRef,
} from "./ship";
import {
    spawnLargeFromEdge,
    updateAsteroid,
    drawAsteroid,
    type AsteroidState,
} from "./asteroid";
import {
    createBulletFiringState,
    tickBullets,
    drawBullet,
    type BulletFiringState,
    type BulletState,
} from "./bullet";
import { resolveCollisions, type CollisionSnapshot } from "./collision";
import {
    createTimeTravelState,
    recordPresent,
    tickTimeTravel,
    type TimeTravelState,
} from "./time-travel";
import { energyFraction } from "./energy";
import {
    drawZoneTints,
    drawZoneBoundary,
    drawDashedBoundary,
    computeBoundaryMidpoints,
} from "./zone-renderer";
import { pointInZone, type Vec2 } from "./voronoi";
import { drawHud, type HudPlayerData } from "./hud";
import type { ZoneSnapshot } from "./zone-history";

type ZoneRuntime = {
    zoneId: 1 | 2;
    ship: ShipState;
    asteroids: AsteroidState[];
    bullets: BulletFiringState;
    tt: TimeTravelState;
    /** Cached visible snapshot from the last tickTimeTravel call (for rendering during TT). */
    visible: ZoneSnapshot;
    /** Monotonic frontier tick counter, advanced by recordPresent. Used by HUD clock. */
    presentTick: number;
    /** Zone tick at the moment we last rendered (= presentTick when not in TT). */
    zoneTick: number;
};

function makeRng(): () => number {
    return Math.random;
}

function shipPos(s: ShipState): Vec2 {
    return { x: s.x, y: s.y };
}

function bulletPos(b: BulletState): Vec2 {
    return { x: b.x, y: b.y };
}

function asteroidPos(a: AsteroidState): Vec2 {
    return { x: a.x, y: a.y };
}

function freshSnapshot(zone: ZoneRuntime): ZoneSnapshot {
    return {
        ship: { ...zone.ship },
        asteroids: zone.asteroids.map((a) => ({ ...a, vertices: a.vertices.map((v) => ({ ...v })) })),
        bullets: zone.bullets.active.map((b) => ({ ...b })),
        hp: zone.ship.hp,
    };
}

function initZone(zoneId: 1 | 2, p1Pos: Vec2, p2Pos: Vec2, rng: () => number): ZoneRuntime {
    const sx = zoneId === 1 ? CONSTANTS.SHIP.START_P1_X : CONSTANTS.SHIP.START_P2_X;
    const sy = zoneId === 1 ? CONSTANTS.SHIP.START_P1_Y : CONSTANTS.SHIP.START_P2_Y;
    const sa = zoneId === 1 ? CONSTANTS.SHIP.START_ANGLE_P1 : CONSTANTS.SHIP.START_ANGLE_P2;
    const ship = createShip(sx, sy, sa, CONSTANTS.HP.INITIAL);

    const asteroids: AsteroidState[] = [];
    let attempts = 0;
    while (asteroids.length < CONSTANTS.ASTEROID.POOL_SIZE && attempts < CONSTANTS.ASTEROID.POOL_SIZE * 50) {
        const a = spawnLargeFromEdge(rng);
        if (pointInZone(asteroidPos(a), p1Pos, p2Pos) === zoneId) {
            asteroids.push(a);
        }
        attempts++;
    }
    while (asteroids.length < CONSTANTS.ASTEROID.POOL_SIZE) {
        asteroids.push(spawnLargeFromEdge(rng));
    }

    const bullets = createBulletFiringState();
    const initialSnapshot: ZoneSnapshot = {
        ship: { ...ship },
        asteroids: asteroids.map((a) => ({ ...a, vertices: a.vertices.map((v) => ({ ...v })) })),
        bullets: [],
        hp: ship.hp,
    };
    const tt = createTimeTravelState(initialSnapshot);

    return {
        zoneId,
        ship,
        asteroids,
        bullets,
        tt,
        visible: initialSnapshot,
        presentTick: 0,
        zoneTick: 0,
    };
}

function partitionBy<T>(items: T[], inSide: (t: T) => boolean): { stay: T[]; out: T[] } {
    const stay: T[] = [];
    const out: T[] = [];
    for (const t of items) {
        if (inSide(t)) stay.push(t);
        else out.push(t);
    }
    return { stay, out };
}

function refillLarges(zone: ZoneRuntime, p1Pos: Vec2, p2Pos: Vec2, rng: () => number): void {
    let largeCount = zone.asteroids.filter((a) => a.tier === "large").length;
    while (largeCount < CONSTANTS.ASTEROID.POOL_SIZE) {
        let placed = false;
        for (let t = 0; t < 50; t++) {
            const a = spawnLargeFromEdge(rng);
            if (pointInZone(asteroidPos(a), p1Pos, p2Pos) === zone.zoneId) {
                zone.asteroids.push(a);
                placed = true;
                break;
            }
        }
        if (!placed) {
            // Fallback: accept any spawn; partition handoff next frame will redistribute.
            zone.asteroids.push(spawnLargeFromEdge(rng));
        }
        largeCount++;
    }
}

const sketch = (p: p5) => {
    let inputState: InputState = createInputState();
    let gameState: GameState = createGameState();
    let zone1: ZoneRuntime | null = null;
    let zone2: ZoneRuntime | null = null;
    const rng = makeRng();

    p.setup = () => {
        p.createCanvas(CONSTANTS.CANVAS.WIDTH, CONSTANTS.CANVAS.HEIGHT);
        p.frameRate(60);
        p.textFont("monospace");
        p.noSmooth();
    };

    p.draw = () => {
        p.background(0);

        const read = readFrame(inputState);
        inputState = read.state;
        const frameInput = read.input;

        if (gameState.name === "LOBBY") {
            const sys = selectSystemInput(gameState, frameInput);
            if (sys !== null) {
                const next = tickLobby(gameState, sys);
                if (next.name === "PLAYING" && gameState.name === "LOBBY") {
                    // Transitioning into PLAYING: initialize zones.
                    const p1Start: Vec2 = { x: CONSTANTS.SHIP.START_P1_X, y: CONSTANTS.SHIP.START_P1_Y };
                    const p2Start: Vec2 = { x: CONSTANTS.SHIP.START_P2_X, y: CONSTANTS.SHIP.START_P2_Y };
                    zone1 = initZone(1, p1Start, p2Start, rng);
                    zone2 = initZone(2, p1Start, p2Start, rng);
                }
                gameState = next;
            }
            drawLobby(p, gameState);
            return;
        }

        if (gameState.name === "GAME_OVER") {
            // Field stays frozen at the moment of death.
            if (zone1 !== null && zone2 !== null) {
                drawField(p, zone1, zone2);
            }
            if (gameState.winner !== null) {
                drawGameOver(p, gameState.winner);
            }
            const sys = selectSystemInput(gameState, frameInput);
            if (sys !== null) {
                const next = tickGameOver(gameState, sys);
                if (next.name === "LOBBY") {
                    zone1 = null;
                    zone2 = null;
                }
                gameState = next;
            }
            return;
        }

        // PLAYING
        if (zone1 === null || zone2 === null) return;
        const players = selectPlayerInput(gameState, frameInput);
        if (players.p1 === null || players.p2 === null) return;

        tickPlayingFrame(zone1, zone2, players.p1, players.p2, rng);
        gameState = tickPlaying(gameState, zone1.ship.hp, zone2.ship.hp);

        drawField(p, zone1, zone2);
        drawHud(p, hudData(zone1), hudData(zone2));
    };
};

function hudData(zone: ZoneRuntime): HudPlayerData {
    return {
        hp: zone.ship.hp,
        energyFraction: energyFraction(zone.tt.energy),
        zoneTick: zone.zoneTick,
        presentTick: zone.presentTick,
    };
}

function tickPlayingFrame(
    zone1: ZoneRuntime,
    zone2: ZoneRuntime,
    p1Input: PlayerInput,
    p2Input: PlayerInput,
    rng: () => number,
): void {
    // 1. Resolve time-travel for each zone using live spinner deltas.
    const tt1 = tickTimeTravel(zone1.tt, p1Input.spinnerDelta);
    const tt2 = tickTimeTravel(zone2.tt, p2Input.spinnerDelta);
    zone1.tt = tt1.state;
    zone2.tt = tt2.state;
    zone1.visible = tt1.visibleSnapshot;
    zone2.visible = tt2.visibleSnapshot;

    // 2. Live state always advances (per locked render policy: live ship continues
    //    under input while ghost is shown overlaid during TT).
    const p1Pos = shipPos(zone1.ship);
    const p2Pos = shipPos(zone2.ship);
    const boundary1: BoundaryRef = { selfX: p1Pos.x, selfY: p1Pos.y, otherX: p2Pos.x, otherY: p2Pos.y };
    const boundary2: BoundaryRef = { selfX: p2Pos.x, selfY: p2Pos.y, otherX: p1Pos.x, otherY: p1Pos.y };

    zone1.ship = updateShip(zone1.ship, p1Input, boundary1);
    if (tt1.boost !== null) {
        zone1.ship = { ...zone1.ship, vx: zone1.ship.vx + tt1.boost.x, vy: zone1.ship.vy + tt1.boost.y };
    }
    zone2.ship = updateShip(zone2.ship, p2Input, boundary2);
    if (tt2.boost !== null) {
        zone2.ship = { ...zone2.ship, vx: zone2.ship.vx + tt2.boost.x, vy: zone2.ship.vy + tt2.boost.y };
    }

    // 3. Update bullets per player.
    zone1.bullets = tickBullets(zone1.bullets, p1Input.fire, zone1.ship, 1);
    zone2.bullets = tickBullets(zone2.bullets, p2Input.fire, zone2.ship, 2);

    // 4. Update asteroids in each zone's pool.
    zone1.asteroids = zone1.asteroids.map(updateAsteroid);
    zone2.asteroids = zone2.asteroids.map(updateAsteroid);

    // 5. Cross-zone handoff: asteroids and bullets reassigned by current bisector.
    const p1Now = shipPos(zone1.ship);
    const p2Now = shipPos(zone2.ship);

    const z1Aster = partitionBy(zone1.asteroids, (a) => pointInZone(asteroidPos(a), p1Now, p2Now) === 1);
    const z2Aster = partitionBy(zone2.asteroids, (a) => pointInZone(asteroidPos(a), p1Now, p2Now) === 2);
    zone1.asteroids = [...z1Aster.stay, ...z2Aster.out];
    zone2.asteroids = [...z2Aster.stay, ...z1Aster.out];

    const z1Bul = partitionBy(zone1.bullets.active, (b) => pointInZone(bulletPos(b), p1Now, p2Now) === 1);
    const z2Bul = partitionBy(zone2.bullets.active, (b) => pointInZone(bulletPos(b), p1Now, p2Now) === 2);
    zone1.bullets = { ...zone1.bullets, active: [...z1Bul.stay, ...z2Bul.out] };
    zone2.bullets = { ...zone2.bullets, active: [...z2Bul.stay, ...z1Bul.out] };

    // 6. Resolve collisions per zone. Ghost ship in the snapshot is the OWN ghost
    //    (acts as a despawner for incoming bullets/asteroids per spec).
    const snap1: CollisionSnapshot = {
        zoneId: 1,
        ship: zone1.ship,
        ghostShip: zone1.tt.inTimeTravel ? zone1.visible.ship : undefined,
        asteroids: zone1.asteroids,
        bullets: zone1.bullets.active,
    };
    const col1 = resolveCollisions(snap1, rng);
    zone1.ship = col1.ship;
    zone1.asteroids = col1.asteroids;
    zone1.bullets = { ...zone1.bullets, active: col1.bullets };

    const snap2: CollisionSnapshot = {
        zoneId: 2,
        ship: zone2.ship,
        ghostShip: zone2.tt.inTimeTravel ? zone2.visible.ship : undefined,
        asteroids: zone2.asteroids,
        bullets: zone2.bullets.active,
    };
    const col2 = resolveCollisions(snap2, rng);
    zone2.ship = col2.ship;
    zone2.asteroids = col2.asteroids;
    zone2.bullets = { ...zone2.bullets, active: col2.bullets };

    // 7. Refill destroyed large asteroids per zone.
    refillLarges(zone1, p1Now, p2Now, rng);
    refillLarges(zone2, p1Now, p2Now, rng);

    // 8. Record present snapshot for zones at the frontier.
    if (!zone1.tt.inTimeTravel) {
        zone1.tt = recordPresent(zone1.tt, freshSnapshot(zone1));
        zone1.presentTick++;
        zone1.zoneTick = zone1.presentTick;
    } else {
        zone1.zoneTick = Math.max(0, zone1.presentTick - estimateTicksOffScreen(zone1));
    }
    if (!zone2.tt.inTimeTravel) {
        zone2.tt = recordPresent(zone2.tt, freshSnapshot(zone2));
        zone2.presentTick++;
        zone2.zoneTick = zone2.presentTick;
    } else {
        zone2.zoneTick = Math.max(0, zone2.presentTick - estimateTicksOffScreen(zone2));
    }
}

function estimateTicksOffScreen(_zone: ZoneRuntime): number {
    // Placeholder: without instrumenting zone-history depth, we approximate the
    // scrub offset as the number of ticks the player has spun this frame. The
    // HUD uses (presentTick - zoneTick) only for the clock label sign; precise
    // offset rendering is FUTURE_WORK if the approximation feels off.
    return _zone.tt.ticksSpunThisFrame;
}

function drawField(p: p5, zone1: ZoneRuntime, zone2: ZoneRuntime): void {
    // Display positions: live for frontier zones, ghost for time-traveling zones'
    // bisector reference (live ship is faded but still drawn for context).
    const z1Live = shipPos(zone1.ship);
    const z2Live = shipPos(zone2.ship);
    const z1Ghost = zone1.tt.inTimeTravel ? shipPos(zone1.visible.ship) : null;
    const z2Ghost = zone2.tt.inTimeTravel ? shipPos(zone2.visible.ship) : null;

    // Zone tints use live positions (bisector follows live ships).
    drawZoneTints(p, z1Live, z2Live);

    // Asteroids: snapshot view per zone when in TT, else live.
    const z1Asts = zone1.tt.inTimeTravel ? zone1.visible.asteroids : zone1.asteroids;
    const z2Asts = zone2.tt.inTimeTravel ? zone2.visible.asteroids : zone2.asteroids;
    for (const a of z1Asts) drawAsteroid(p, a);
    for (const a of z2Asts) drawAsteroid(p, a);

    // Bullets: snapshot view per zone when in TT, else live.
    const z1Bul = zone1.tt.inTimeTravel ? zone1.visible.bullets : zone1.bullets.active;
    const z2Bul = zone2.tt.inTimeTravel ? zone2.visible.bullets : zone2.bullets.active;
    for (const b of z1Bul) drawBullet(p, b);
    for (const b of z2Bul) drawBullet(p, b);

    // Ships: per locked render policy, when a zone is in TT, draw BOTH the live
    // ship at the present (faded) and the ghost at the scrub position.
    const p1Color = p.color(0, 100, 255);
    const p2Color = p.color(255, 60, 60);

    const z1LiveAlpha = zone1.tt.inTimeTravel ? CONSTANTS.SHIP.LIVE_FADED_ALPHA : 255;
    const z2LiveAlpha = zone2.tt.inTimeTravel ? CONSTANTS.SHIP.LIVE_FADED_ALPHA : 255;
    drawShip(p, zone1.ship, p1Color, z1LiveAlpha);
    drawShip(p, zone2.ship, p2Color, z2LiveAlpha);

    if (z1Ghost !== null) {
        drawShip(p, zone1.visible.ship, p1Color, CONSTANTS.SHIP.GHOST_ALPHA);
    }
    if (z2Ghost !== null) {
        drawShip(p, zone2.visible.ship, p2Color, CONSTANTS.SHIP.GHOST_ALPHA);
    }

    // Boundary lines: solid bisector of live ships; dashed bisector when either
    // zone is in TT (between that zone's ghost and the opponent's live).
    const z1HasGhost = z1Ghost ?? undefined;
    const z2HasGhost = z2Ghost ?? undefined;
    const endpoints = computeBoundaryMidpoints(z1Live, z2Live, z1HasGhost, z2HasGhost);
    drawZoneBoundary(p, endpoints.solid[0], endpoints.solid[1]);
    if (endpoints.dashed !== undefined) {
        drawDashedBoundary(p, endpoints.dashed[0], endpoints.dashed[1]);
    }
}

new p5(sketch, document.getElementById("sketch")!);
