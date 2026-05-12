import CONSTANTS from './constants.json';

export type Vec2 = { x: number; y: number };

/**
 * Returns 1 if pos is closer to p1 than to p2 (Euclidean, non-wrapping).
 * Ties (equal distance) deterministically return 1.
 */
export function pointInZone(pos: Vec2, p1: Vec2, p2: Vec2): 1 | 2 {
  const dx1 = pos.x - p1.x;
  const dy1 = pos.y - p1.y;
  const dx2 = pos.x - p2.x;
  const dy2 = pos.y - p2.y;
  const dist1sq = dx1 * dx1 + dy1 * dy1;
  const dist2sq = dx2 * dx2 + dy2 * dy2;
  return dist1sq <= dist2sq ? 1 : 2;
}

/**
 * Computes the two canvas-edge intersection points of the perpendicular
 * bisector of the segment p1↔p2.
 *
 * The bisector passes through the midpoint M = (p1+p2)/2 and is
 * perpendicular to (p2 - p1). Direction vector: d = (-(p2.y-p1.y), p2.x-p1.x).
 *
 * Degenerate case (p1 === p2): returns the two horizontal-midline edge points,
 * i.e. [(0, canvasH/2), (canvasW, canvasH/2)]. The entire canvas is zone 1.
 *
 * Returns [endpoint1, endpoint2], each satisfying
 *   x ∈ {0, canvasW}  OR  y ∈ {0, canvasH}.
 */
export function computeZoneBoundary(
  p1: Vec2,
  p2: Vec2,
  canvasW: number = CONSTANTS.CANVAS.WIDTH,
  canvasH: number = CONSTANTS.CANVAS.HEIGHT,
): [Vec2, Vec2] {
  // Degenerate: both ships at same position
  if (p1.x === p2.x && p1.y === p2.y) {
    const midY = canvasH / 2;
    return [
      { x: 0, y: midY },
      { x: canvasW, y: midY },
    ];
  }

  // Midpoint of the segment
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  // Direction vector perpendicular to (p2 - p1)
  const dx = -(p2.y - p1.y);
  const dy = p2.x - p1.x;

  // Collect all t values where the parametric line M + t*d hits the four edges
  // and the intersection point lies within the canvas bounds.
  const candidates: Vec2[] = [];

  const EPS = 1e-10;

  // Edge x = 0: t = (0 - mx) / dx  →  need dx != 0
  if (Math.abs(dx) > EPS) {
    const t = (0 - mx) / dx;
    const y = my + t * dy;
    if (y >= 0 && y <= canvasH) {
      candidates.push({ x: 0, y });
    }
  } else {
    // dx === 0 means the bisector is a vertical line at x = mx
    // This branch handled by horizontal edges below
  }

  // Edge x = canvasW
  if (Math.abs(dx) > EPS) {
    const t = (canvasW - mx) / dx;
    const y = my + t * dy;
    if (y >= 0 && y <= canvasH) {
      candidates.push({ x: canvasW, y });
    }
  }

  // Edge y = 0
  if (Math.abs(dy) > EPS) {
    const t = (0 - my) / dy;
    const x = mx + t * dx;
    if (x >= 0 && x <= canvasW) {
      candidates.push({ x, y: 0 });
    }
  }

  // Edge y = canvasH
  if (Math.abs(dy) > EPS) {
    const t = (canvasH - my) / dy;
    const x = mx + t * dx;
    if (x >= 0 && x <= canvasW) {
      candidates.push({ x, y: canvasH });
    }
  }

  // Handle purely vertical bisector (dx ≈ 0, bisector is x = mx vertical line)
  if (Math.abs(dx) <= EPS) {
    return [
      { x: mx, y: 0 },
      { x: mx, y: canvasH },
    ];
  }

  // Handle purely horizontal bisector (dy ≈ 0, bisector is y = my horizontal line)
  if (Math.abs(dy) <= EPS) {
    return [
      { x: 0, y: my },
      { x: canvasW, y: my },
    ];
  }

  // Deduplicate candidates that are effectively the same point (corners hit two edges)
  const unique: Vec2[] = [];
  for (const c of candidates) {
    const isDup = unique.some(
      (u) => Math.abs(u.x - c.x) < EPS && Math.abs(u.y - c.y) < EPS,
    );
    if (!isDup) {
      unique.push(c);
    }
  }

  // We expect exactly 2 distinct intersection points on the canvas boundary.
  // If somehow we got more (floating point at corners), keep the first two.
  return [unique[0], unique[1]] as [Vec2, Vec2];
}
