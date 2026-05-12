import { describe, it, expect } from 'vitest';
import CONSTANTS from './constants.json';
import { pointInZone, computeZoneBoundary, Vec2 } from './voronoi';

const W = CONSTANTS.CANVAS.WIDTH;
const H = CONSTANTS.CANVAS.HEIGHT;

describe('voronoi', () => {
  // Test 1 — Zone symmetry (property): swapping p1/p2 flips the result for
  // any point that is not equidistant from both ships.
  it('zone symmetry: pointInZone(A, p1, p2) !== pointInZone(A, p2, p1) when dist(A,p1) ≠ dist(A,p2)', () => {
    const p1: Vec2 = { x: 50, y: 100 };
    const p2: Vec2 = { x: 200, y: 150 };

    // Sample a handful of points clearly on one side or the other
    const testPoints: Vec2[] = [
      { x: 10, y: 10 },    // clearly close to p1
      { x: 300, y: 200 },  // clearly close to p2
      { x: 80, y: 80 },    // close to p1
      { x: 250, y: 180 },  // close to p2
    ];

    for (const A of testPoints) {
      const zone12 = pointInZone(A, p1, p2);
      const zone21 = pointInZone(A, p2, p1);
      expect(zone12).not.toBe(zone21);
    }
  });

  // Test 2 — Ships are in their own zones.
  it('pointInZone(p1, p1, p2) === 1 and pointInZone(p2, p1, p2) === 2', () => {
    const p1: Vec2 = { x: CONSTANTS.SHIP.START_P1_X, y: CONSTANTS.SHIP.START_P1_Y };
    const p2: Vec2 = { x: CONSTANTS.SHIP.START_P2_X, y: CONSTANTS.SHIP.START_P2_Y };

    expect(pointInZone(p1, p1, p2)).toBe(1);
    expect(pointInZone(p2, p1, p2)).toBe(2);
  });

  // Test 3 — Degenerate: p1 === p2 must not throw; entire canvas is zone 1.
  it('degenerate p1 === p2: does not throw; entire canvas is zone 1', () => {
    const p: Vec2 = { x: 100, y: 100 };
    expect(() => pointInZone({ x: 0, y: 0 }, p, p)).not.toThrow();
    expect(() => computeZoneBoundary(p, p, W, H)).not.toThrow();

    // A sampling of canvas points should all be zone 1
    const corners: Vec2[] = [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: 0, y: H },
      { x: W, y: H },
      { x: W / 2, y: H / 2 },
    ];
    for (const pos of corners) {
      expect(pointInZone(pos, p, p)).toBe(1);
    }
  });

  // Test 4 — computeZoneBoundary endpoints lie on canvas edges.
  it('computeZoneBoundary endpoints each lie on a canvas edge', () => {
    const p1: Vec2 = { x: 84, y: 131 };
    const p2: Vec2 = { x: 252, y: 131 };
    const [ep1, ep2] = computeZoneBoundary(p1, p2, W, H);

    const onEdge = (p: Vec2): boolean =>
      Math.abs(p.x) < 1e-9 ||
      Math.abs(p.x - W) < 1e-9 ||
      Math.abs(p.y) < 1e-9 ||
      Math.abs(p.y - H) < 1e-9;

    expect(onEdge(ep1)).toBe(true);
    expect(onEdge(ep2)).toBe(true);
  });

  // Test 5 — Midpoint of the two boundary endpoints is equidistant from both ships.
  it('midpoint of boundary endpoints is equidistant from both ships', () => {
    const p1: Vec2 = { x: 84, y: 100 };
    const p2: Vec2 = { x: 252, y: 162 };
    const [ep1, ep2] = computeZoneBoundary(p1, p2, W, H);

    const mid: Vec2 = {
      x: (ep1.x + ep2.x) / 2,
      y: (ep1.y + ep2.y) / 2,
    };

    const dist = (a: Vec2, b: Vec2): number =>
      Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    expect(dist(mid, p1)).toBeCloseTo(dist(mid, p2), 8);
  });
});
