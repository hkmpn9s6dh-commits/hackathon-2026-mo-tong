/** Geometry helpers. Everything here is pure so the core can be unit-tested without a DOM. */

export interface Vec2 {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec2 => ({ x, y });

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function polylineLength(pts: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  return total;
}

/** Distance from a point to a segment. */
export function pointSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Shortest distance from a point to any segment of a polyline. */
export function pointPolylineDistance(p: Vec2, pts: readonly Vec2[]): number {
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) return dist(p, pts[0]);
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const d = pointSegmentDistance(p, pts[i - 1], pts[i]);
    if (d < best) best = d;
  }
  return best;
}

/** Resample a polyline to a fixed spacing (keeps both endpoints). */
export function resample(pts: readonly Vec2[], spacing: number): Vec2[] {
  if (pts.length < 2) return pts.slice();
  const total = polylineLength(pts);
  const steps = Math.max(1, Math.round(total / spacing));
  const sampled = sampleAlong(pts, steps + 1);
  const last = pts[pts.length - 1];
  if (dist(sampled[sampled.length - 1], last) > 1e-6) sampled.push({ ...last });
  return sampled;
}

/** Catmull-Rom spline through control points, sampled at `step` px. */
export function catmullRom(ctrl: readonly Vec2[], step = 6, tension = 0.5): Vec2[] {
  if (ctrl.length < 2) return ctrl.slice();
  const pts: Vec2[] = [{ ...ctrl[0] }];
  const padded = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  for (let i = 1; i < padded.length - 2; i++) {
    const p0 = padded[i - 1];
    const p1 = padded[i];
    const p2 = padded[i + 1];
    const p3 = padded[i + 2];
    const segLen = dist(p1, p2);
    const n = Math.max(2, Math.round(segLen / step));
    for (let j = 1; j <= n; j++) {
      const t = j / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const m1x = (p2.x - p0.x) * tension;
      const m1y = (p2.y - p0.y) * tension;
      const m2x = (p3.x - p1.x) * tension;
      const m2y = (p3.y - p1.y) * tension;
      const x =
        (2 * t3 - 3 * t2 + 1) * p1.x + (t3 - 2 * t2 + t) * m1x + (-2 * t3 + 3 * t2) * p2.x + (t3 - t2) * m2x;
      const y =
        (2 * t3 - 3 * t2 + 1) * p1.y + (t3 - 2 * t2 + t) * m1y + (-2 * t3 + 3 * t2) * p2.y + (t3 - t2) * m2y;
      pts.push({ x, y });
    }
  }
  return pts;
}

/** Moving-average smoothing; keeps the endpoints. */
export function smooth(pts: readonly Vec2[], window = 5): Vec2[] {
  if (pts.length <= 2) return pts.slice();
  const half = Math.max(1, Math.floor(window / 2));
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return { ...p };
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let k = -half; k <= half; k++) {
      const q = pts[clamp(i + k, 0, pts.length - 1)];
      sx += q.x;
      sy += q.y;
      n++;
    }
    return { x: sx / n, y: sy / n };
  });
}

/** Nearest-neighbour tour through `points` starting at `from`; returns visit order indices. */
export function nearestNeighbourOrder(from: Vec2, points: readonly Vec2[]): number[] {
  const remaining = points.map((_, i) => i);
  const order: number[] = [];
  let cursor = from;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let k = 0; k < remaining.length; k++) {
      const d = dist(cursor, points[remaining[k]]);
      if (d < bestD) {
        bestD = d;
        bestIdx = k;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    order.push(chosen);
    cursor = points[chosen];
  }
  return order;
}

/** Approximate open TSP length: nearest neighbour then 2-opt improvement. */
export function approxTourLength(from: Vec2, to: Vec2, points: readonly Vec2[]): number {
  if (points.length === 0) return dist(from, to);
  const order = nearestNeighbourOrder(from, points);
  const tour = [from, ...order.map((i) => points[i]), to];
  // 2-opt on the inner sequence (indices 1..len-2)
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 1; i < tour.length - 2; i++) {
      for (let j = i + 1; j < tour.length - 1; j++) {
        const a = tour[i - 1];
        const b = tour[i];
        const c = tour[j];
        const d = tour[j + 1];
        const before = dist(a, b) + dist(c, d);
        const after = dist(a, c) + dist(b, d);
        if (after + 1e-6 < before) {
          const slice = tour.slice(i, j + 1).reverse();
          tour.splice(i, slice.length, ...slice);
          improved = true;
        }
      }
    }
  }
  let total = 0;
  for (let i = 1; i < tour.length; i++) total += dist(tour[i - 1], tour[i]);
  return total;
}

/** Points along a polyline, evenly spaced by arc length. */
export function sampleAlong(pts: readonly Vec2[], count: number): Vec2[] {
  if (pts.length === 0) return [];
  if (pts.length === 1 || count <= 1) return [{ ...pts[0] }];
  const total = polylineLength(pts);
  const out: Vec2[] = [];
  let target = 0;
  let acc = 0;
  let i = 1;
  while (out.length < count) {
    target = (out.length / (count - 1)) * total;
    while (i < pts.length && acc + dist(pts[i - 1], pts[i]) < target) {
      acc += dist(pts[i - 1], pts[i]);
      i++;
    }
    if (i >= pts.length) {
      out.push({ ...pts[pts.length - 1] });
      continue;
    }
    const segLen = dist(pts[i - 1], pts[i]) || 1;
    const t = clamp((target - acc) / segLen, 0, 1);
    out.push(lerpVec(pts[i - 1], pts[i], t));
  }
  return out;
}
