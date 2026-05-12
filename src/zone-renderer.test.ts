import { describe, it, expect } from 'vitest';
import CONSTANTS from './constants.json';
import { pointInZone, computeZoneBoundary } from './voronoi';
import type { Vec2 } from './voronoi';
import {
  zonePolygonVertices,
  computeBoundaryMidpoints,
  perimeterParam,
} from './zone-renderer';

const W = CONSTANTS.CANVAS.WIDTH;   // 336
const H = CONSTANTS.CANVAS.HEIGHT;  // 262

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the polygon (array of vertices) contains the test point.
 *  Uses a simple ray-casting algorithm. */
function polygonContains(poly: Vec2[], pt: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// T-05 Test 1: Vertical bisector — tint polygon completeness
// ---------------------------------------------------------------------------

describe('zonePolygonVertices — vertical bisector (P1=(84,131), P2=(252,131))', () => {
  const p1: Vec2 = { x: CONSTANTS.SHIP.START_P1_X, y: CONSTANTS.SHIP.START_P1_Y };
  const p2: Vec2 = { x: CONSTANTS.SHIP.START_P2_X, y: CONSTANTS.SHIP.START_P2_Y };

  // Bisector is the vertical line x = 168 (midpoint of 84 and 252)
  const ep1: Vec2 = { x: 168, y: 0 };
  const ep2: Vec2 = { x: 168, y: H };

  it('zone-1 polygon contains top-left corner', () => {
    const verts = zonePolygonVertices(1, ep1, ep2, p1, p2, W, H);
    // Test a point slightly inside the TL corner
    expect(polygonContains(verts, { x: 1, y: 1 })).toBe(true);
  });

  it('zone-1 polygon contains bottom-left corner', () => {
    const verts = zonePolygonVertices(1, ep1, ep2, p1, p2, W, H);
    expect(polygonContains(verts, { x: 1, y: H - 1 })).toBe(true);
  });

  it('zone-2 polygon contains top-right corner', () => {
    const verts = zonePolygonVertices(2, ep1, ep2, p1, p2, W, H);
    expect(polygonContains(verts, { x: W - 1, y: 1 })).toBe(true);
  });

  it('zone-2 polygon contains bottom-right corner', () => {
    const verts = zonePolygonVertices(2, ep1, ep2, p1, p2, W, H);
    expect(polygonContains(verts, { x: W - 1, y: H - 1 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T-05 Test 2: Diagonal bisector — each corner in exactly one zone
// ---------------------------------------------------------------------------

describe('zonePolygonVertices — diagonal bisector (P1=(50,50), P2=(250,200))', () => {
  const p1: Vec2 = { x: 50, y: 50 };
  const p2: Vec2 = { x: 250, y: 200 };
  const [ep1, ep2] = computeZoneBoundary(p1, p2, W, H);

  const corners: Vec2[] = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ];

  it('each corner is assigned to exactly one zone by pointInZone', () => {
    for (const c of corners) {
      const zone = pointInZone(c, p1, p2);
      expect(zone === 1 || zone === 2).toBe(true);
    }
  });

  it('zone-1 polygon contains points near zone-1 corners', () => {
    const verts1 = zonePolygonVertices(1, ep1, ep2, p1, p2, W, H);
    // Test points well inside the zone (not right at the corner) to avoid boundary issues
    expect(polygonContains(verts1, { x: 10, y: 10 })).toBe(
      pointInZone({ x: 10, y: 10 }, p1, p2) === 1,
    );
    expect(polygonContains(verts1, { x: 10, y: H - 10 })).toBe(
      pointInZone({ x: 10, y: H - 10 }, p1, p2) === 1,
    );
  });

  it('zone-2 polygon contains points near zone-2 corners', () => {
    const verts2 = zonePolygonVertices(2, ep1, ep2, p1, p2, W, H);
    expect(polygonContains(verts2, { x: W - 10, y: 10 })).toBe(
      pointInZone({ x: W - 10, y: 10 }, p1, p2) === 2,
    );
    expect(polygonContains(verts2, { x: W - 10, y: H - 10 })).toBe(
      pointInZone({ x: W - 10, y: H - 10 }, p1, p2) === 2,
    );
  });
});

// ---------------------------------------------------------------------------
// T-05 Test 3: computeBoundaryMidpoints — no rewind
// ---------------------------------------------------------------------------

describe('computeBoundaryMidpoints — no rewind (selfGhost undefined)', () => {
  const self: Vec2 = { x: 84, y: 131 };
  const other: Vec2 = { x: 252, y: 131 };

  it('returns no dashed boundary', () => {
    const result = computeBoundaryMidpoints(self, other);
    expect(result.dashed).toBeUndefined();
  });

  it('solid boundary uses (self, other)', () => {
    const expected = computeZoneBoundary(self, other, W, H);
    const result = computeBoundaryMidpoints(self, other);
    expect(result.solid[0].x).toBeCloseTo(expected[0].x, 5);
    expect(result.solid[0].y).toBeCloseTo(expected[0].y, 5);
    expect(result.solid[1].x).toBeCloseTo(expected[1].x, 5);
    expect(result.solid[1].y).toBeCloseTo(expected[1].y, 5);
  });
});

// ---------------------------------------------------------------------------
// T-05 Test 4: computeBoundaryMidpoints — single rewind
// ---------------------------------------------------------------------------

describe('computeBoundaryMidpoints — single rewind (selfGhost present, otherGhost undefined)', () => {
  const self: Vec2 = { x: 84, y: 131 };
  const other: Vec2 = { x: 252, y: 131 };
  const selfGhost: Vec2 = { x: 60, y: 100 };

  it('dashed boundary is defined', () => {
    const result = computeBoundaryMidpoints(self, other, selfGhost);
    expect(result.dashed).toBeDefined();
  });

  it('dashed uses (selfGhost, other)', () => {
    const expected = computeZoneBoundary(selfGhost, other, W, H);
    const result = computeBoundaryMidpoints(self, other, selfGhost);
    expect(result.dashed![0].x).toBeCloseTo(expected[0].x, 5);
    expect(result.dashed![0].y).toBeCloseTo(expected[0].y, 5);
    expect(result.dashed![1].x).toBeCloseTo(expected[1].x, 5);
    expect(result.dashed![1].y).toBeCloseTo(expected[1].y, 5);
  });

  it('solid uses (self, other)', () => {
    const expected = computeZoneBoundary(self, other, W, H);
    const result = computeBoundaryMidpoints(self, other, selfGhost);
    expect(result.solid[0].x).toBeCloseTo(expected[0].x, 5);
    expect(result.solid[0].y).toBeCloseTo(expected[0].y, 5);
    expect(result.solid[1].x).toBeCloseTo(expected[1].x, 5);
    expect(result.solid[1].y).toBeCloseTo(expected[1].y, 5);
  });
});

// ---------------------------------------------------------------------------
// T-05 Test 5: computeBoundaryMidpoints — dual rewind
// ---------------------------------------------------------------------------

describe('computeBoundaryMidpoints — dual rewind (both ghosts present)', () => {
  const self: Vec2 = { x: 84, y: 131 };
  const other: Vec2 = { x: 252, y: 131 };
  const selfGhost: Vec2 = { x: 60, y: 100 };
  const otherGhost: Vec2 = { x: 220, y: 150 };

  it('solid uses (self, otherGhost)', () => {
    const expected = computeZoneBoundary(self, otherGhost, W, H);
    const result = computeBoundaryMidpoints(self, other, selfGhost, otherGhost);
    expect(result.solid[0].x).toBeCloseTo(expected[0].x, 5);
    expect(result.solid[0].y).toBeCloseTo(expected[0].y, 5);
    expect(result.solid[1].x).toBeCloseTo(expected[1].x, 5);
    expect(result.solid[1].y).toBeCloseTo(expected[1].y, 5);
  });

  it('dashed uses (selfGhost, otherGhost)', () => {
    const expected = computeZoneBoundary(selfGhost, otherGhost, W, H);
    const result = computeBoundaryMidpoints(self, other, selfGhost, otherGhost);
    expect(result.dashed).toBeDefined();
    expect(result.dashed![0].x).toBeCloseTo(expected[0].x, 5);
    expect(result.dashed![0].y).toBeCloseTo(expected[0].y, 5);
    expect(result.dashed![1].x).toBeCloseTo(expected[1].x, 5);
    expect(result.dashed![1].y).toBeCloseTo(expected[1].y, 5);
  });
});

// ---------------------------------------------------------------------------
// perimeterParam sanity checks
// ---------------------------------------------------------------------------

describe('perimeterParam', () => {
  it('top-left corner maps to 0', () => {
    expect(perimeterParam({ x: 0, y: 0 })).toBeCloseTo(0);
  });

  it('top-right corner maps to W', () => {
    expect(perimeterParam({ x: W, y: 0 })).toBeCloseTo(W);
  });

  it('bottom-right corner maps to W + H', () => {
    expect(perimeterParam({ x: W, y: H })).toBeCloseTo(W + H);
  });

  it('bottom-left corner maps to 2W + H', () => {
    expect(perimeterParam({ x: 0, y: H })).toBeCloseTo(2 * W + H);
  });
});
