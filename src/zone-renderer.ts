import type p5 from 'p5';
import CONSTANTS from './constants.json';
import { type Vec2, computeZoneBoundary, pointInZone } from './voronoi';

const W = CONSTANTS.CANVAS.WIDTH;
const H = CONSTANTS.CANVAS.HEIGHT;

/**
 * Maps a point on the canvas boundary to a clockwise perimeter parameter
 * in [0, perimeter), starting from the top-left corner (0, 0).
 *
 * Clockwise order: top edge → right edge → bottom edge → left edge.
 */
export function perimeterParam(pt: Vec2): number {
  const top = W;
  const right = W + H;
  const bottom = 2 * W + H;
  // left edge completes the perimeter at 2W + 2H

  const EPS = 1e-9;

  // Top edge: y ≈ 0, x goes 0 → W
  if (Math.abs(pt.y) < EPS) return pt.x;

  // Right edge: x ≈ W, y goes 0 → H
  if (Math.abs(pt.x - W) < EPS) return top + pt.y;

  // Bottom edge: y ≈ H, x goes W → 0
  if (Math.abs(pt.y - H) < EPS) return right + (W - pt.x);

  // Left edge: x ≈ 0, y goes H → 0
  return bottom + (H - pt.y);
}

/**
 * Returns the polygon vertices for a given zone (1 or 2).
 *
 * Algorithm:
 *   1. Start at ep1.
 *   2. Walk the perimeter clockwise from ep1; include any corner that belongs
 *      to zoneId; stop once ep2 is reached.  If that arc contains none of
 *      the zone's corners (i.e. the zone's corners lie on the other arc),
 *      walk counter-clockwise instead (equivalently: sort clockwise from ep2).
 *   3. End at ep2.
 *
 * Canvas corners in fixed clockwise order: TL(0,0), TR(W,0), BR(W,H), BL(0,H).
 */
export function zonePolygonVertices(
  zoneId: 1 | 2,
  ep1: Vec2,
  ep2: Vec2,
  p1: Vec2,
  p2: Vec2,
  canvasW: number,
  canvasH: number,
): Vec2[] {
  const perimeter = 2 * (canvasW + canvasH);

  const corners: Vec2[] = [
    { x: 0, y: 0 },
    { x: canvasW, y: 0 },
    { x: canvasW, y: canvasH },
    { x: 0, y: canvasH },
  ];

  const ep1Param = perimeterParam(ep1);
  const ep2Param = perimeterParam(ep2);

  // Clockwise arc length from ep1 to ep2
  const cwArc = (ep2Param - ep1Param + perimeter) % perimeter;

  // Filter corners belonging to this zone
  const zoneCorners = corners.filter((c) => pointInZone(c, p1, p2) === zoneId);

  // Determine which corners lie on the clockwise arc from ep1 to ep2
  const cwCorners = zoneCorners.filter((c) => {
    const dist = (perimeterParam(c) - ep1Param + perimeter) % perimeter;
    return dist > 0 && dist < cwArc;
  });

  if (cwCorners.length === zoneCorners.length) {
    // All zone corners are on the clockwise arc — traverse clockwise from ep1
    const sorted = cwCorners.sort((a, b) => {
      const pa = (perimeterParam(a) - ep1Param + perimeter) % perimeter;
      const pb = (perimeterParam(b) - ep1Param + perimeter) % perimeter;
      return pa - pb;
    });
    return [ep1, ...sorted, ep2];
  } else {
    // Zone corners are on the counter-clockwise arc (ep1 → ep2 going CCW).
    // Equivalently: clockwise arc from ep2 back to ep1.
    // Sort corners by clockwise distance from ep2.
    const sorted = zoneCorners.sort((a, b) => {
      // Counter-clockwise from ep1 = clockwise from ep2
      const pa = (perimeterParam(a) - ep2Param + perimeter) % perimeter;
      const pb = (perimeterParam(b) - ep2Param + perimeter) % perimeter;
      return pb - pa; // reverse order: CCW from ep1 = CW from ep2 reversed
    });
    return [ep1, ...sorted, ep2];
  }
}

/**
 * Draws two semi-transparent zone tint polygons (one per player zone).
 */
export function drawZoneTints(p: p5, p1Pos: Vec2, p2Pos: Vec2): void {
  const [ep1, ep2] = computeZoneBoundary(p1Pos, p2Pos, W, H);

  p.noStroke();

  // P1 zone — blue
  p.fill(0, 100, 255, CONSTANTS.CANVAS.ZONE_TINT_ALPHA);
  const p1Verts = zonePolygonVertices(1, ep1, ep2, p1Pos, p2Pos, W, H);
  p.beginShape();
  for (const v of p1Verts) {
    p.vertex(v.x, v.y);
  }
  p.endShape(p.CLOSE);

  // P2 zone — red
  p.fill(255, 60, 60, CONSTANTS.CANVAS.ZONE_TINT_ALPHA);
  const p2Verts = zonePolygonVertices(2, ep1, ep2, p1Pos, p2Pos, W, H);
  p.beginShape();
  for (const v of p2Verts) {
    p.vertex(v.x, v.y);
  }
  p.endShape(p.CLOSE);
}

/**
 * Draws a solid 1px white boundary line between ep1 and ep2.
 */
export function drawZoneBoundary(p: p5, ep1: Vec2, ep2: Vec2): void {
  p.stroke(255);
  p.strokeWeight(1);
  p.line(ep1.x, ep1.y, ep2.x, ep2.y);
}

/**
 * Draws a dashed boundary line between ep1 and ep2.
 * Dash length: CANVAS.BOUNDARY_DASH px; gap: CANVAS.BOUNDARY_GAP px. 1px white.
 */
export function drawDashedBoundary(p: p5, ep1: Vec2, ep2: Vec2): void {
  const dashLen = CONSTANTS.CANVAS.BOUNDARY_DASH; // render-only style value
  const gapLen = CONSTANTS.CANVAS.BOUNDARY_GAP;   // render-only style value

  const dx = ep2.x - ep1.x;
  const dy = ep2.y - ep1.y;
  const totalLen = Math.sqrt(dx * dx + dy * dy);
  if (totalLen < 1e-9) return;

  const ux = dx / totalLen;
  const uy = dy / totalLen;

  p.stroke(255);
  p.strokeWeight(1);

  let dist = 0;
  let drawing = true;

  while (dist < totalLen) {
    const segLen = drawing ? dashLen : gapLen;
    const end = Math.min(dist + segLen, totalLen);

    if (drawing) {
      p.line(
        ep1.x + ux * dist,
        ep1.y + uy * dist,
        ep1.x + ux * end,
        ep1.y + uy * end,
      );
    }

    dist = end;
    drawing = !drawing;
  }
}

export interface BoundaryEndpoints {
  solid: [Vec2, Vec2];
  dashed?: [Vec2, Vec2];
}

/**
 * Computes the boundary line endpoints used by the renderer.
 *
 * - solid boundary: perpendicular bisector of (self, opponentGhostOrPresent)
 * - dashed boundary (only when self is in time-travel, i.e. selfGhost defined):
 *     perpendicular bisector of (selfGhost, opponentGhostOrPresent)
 *
 * opponentGhostOrPresent = otherGhost ?? other
 */
export function computeBoundaryMidpoints(
  self: Vec2,
  other: Vec2,
  selfGhost?: Vec2,
  otherGhost?: Vec2,
): BoundaryEndpoints {
  const opponentPos = otherGhost ?? other;

  const solid = computeZoneBoundary(self, opponentPos, W, H);

  if (selfGhost === undefined) {
    return { solid };
  }

  const dashed = computeZoneBoundary(selfGhost, opponentPos, W, H);
  return { solid, dashed };
}
