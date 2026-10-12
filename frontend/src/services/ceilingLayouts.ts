/**
 * Ceiling pattern/layout engine — DOM-free pure geometry, zero external dependencies.
 *
 * RECTANGLES ONLY. Every layout returns an array of axis-aligned PixelRects;
 * there are no arcs, diagonals, or triangles anywhere in this module.
 * The module is intentionally standalone (no canvas, no document) so it can be
 * compiled and unit-tested in pure Node.
 */

/** Axis-aligned rectangle in pixel space. */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Layout tuning knobs shared by every pattern. */
export interface LayoutParams {
  panelWidth: number;
  panelSpacing: number;
  borderThickness: number;
}

/** Hard cap on rects emitted by any single layout (protects tiny-size sweeps). */
const MAX_RECTS = 256;

function isSaneRect(r: PixelRect): boolean {
  return (
    Number.isFinite(r.x) &&
    Number.isFinite(r.y) &&
    Number.isFinite(r.w) &&
    Number.isFinite(r.h) &&
    r.w > 0 &&
    r.h > 0
  );
}

/**
 * Degenerate params never throw and never emit zero-area rects — layouts return [].
 * Degenerate = borderThickness <= 0 or panelWidth < 1 (or any non-finite / negative spacing).
 */
function paramsValid(p: LayoutParams): boolean {
  return (
    Number.isFinite(p.panelWidth) &&
    Number.isFinite(p.panelSpacing) &&
    Number.isFinite(p.borderThickness) &&
    p.panelWidth >= 1 &&
    p.panelSpacing >= 0 &&
    p.borderThickness > 0
  );
}

/** Border thickness in px = max(2, (borderThickness/100) * min(w,h) * 1.5). */
function borderPx(r: PixelRect, p: LayoutParams): number {
  return Math.max(2, (p.borderThickness / 100) * Math.min(r.w, r.h) * 1.5);
}

/** Groove gap in px = max(1, panelSpacing * (w/256)). */
function groovePx(r: PixelRect, p: LayoutParams): number {
  return Math.max(1, p.panelSpacing * (r.w / 256));
}

/**
 * Push a rect clipped to bounds; silently drops it when clipping would leave
 * zero or negative area, so layouts never emit zero-area rects.
 */
function pushClipped(out: PixelRect[], bounds: PixelRect, x: number, y: number, w: number, h: number): void {
  const cx = Math.max(bounds.x, Math.min(x, bounds.x + bounds.w));
  const cy = Math.max(bounds.y, Math.min(y, bounds.y + bounds.h));
  const ex = Math.max(bounds.x, Math.min(x + w, bounds.x + bounds.w));
  const ey = Math.max(bounds.y, Math.min(y + h, bounds.y + bounds.h));
  if (ex - cx > 0 && ey - cy > 0 && out.length < MAX_RECTS) {
    out.push({ x: cx, y: cy, w: ex - cx, h: ey - cy });
  }
}

/**
 * Four rects forming a frame of thickness t along the inside edge of r
 * (top, bottom, left, right). Returns [] when the frame cannot fit.
 */
function frameRects(r: PixelRect, t: number): PixelRect[] {
  if (!(t > 0) || 2 * t >= Math.min(r.w, r.h)) return [];
  return [
    { x: r.x, y: r.y, w: r.w, h: t },
    { x: r.x, y: r.y + r.h - t, w: r.w, h: t },
    { x: r.x, y: r.y + t, w: t, h: r.h - 2 * t },
    { x: r.x + r.w - t, y: r.y + t, w: t, h: r.h - 2 * t },
  ];
}

/** Vertical strips running the full height of r, separated by groove gaps. */
export function layoutLinearPanels(r: PixelRect, p: LayoutParams): PixelRect[] {
  if (!isSaneRect(r) || !paramsValid(p)) return [];
  const out: PixelRect[] = [];
  const unit = r.w / 256;
  const stripW = Math.max(1, p.panelWidth * unit);
  const groove = Math.max(1, p.panelSpacing * unit);
  const end = r.x + r.w;
  let x = r.x;
  while (x < end && out.length < MAX_RECTS) {
    pushClipped(out, r, x, r.y, Math.min(stripW, end - x), r.h);
    x += stripW + groove;
  }
  return out;
}

/** Grid of inset rectangles (groove gap between cells). */
export function layoutGeometricGrid(r: PixelRect, p: LayoutParams): PixelRect[] {
  if (!isSaneRect(r) || !paramsValid(p)) return [];
  const out: PixelRect[] = [];
  const cols = Math.max(1, Math.min(64, Math.round(p.panelWidth)));
  const rows = Math.max(1, Math.min(64, Math.round((p.panelWidth * r.h) / r.w)));
  const g = groovePx(r, p);
  const cellW = r.w / cols;
  const cellH = r.h / rows;
  for (let cy = 0; cy < rows && out.length < MAX_RECTS; cy++) {
    for (let cx = 0; cx < cols && out.length < MAX_RECTS; cx++) {
      pushClipped(
        out,
        r,
        r.x + cx * cellW + g / 2,
        r.y + cy * cellH + g / 2,
        cellW - g,
        cellH - g,
      );
    }
  }
  return out;
}

/** Single rectangular frame (4 rects) along the edge of r. */
export function layoutBorder(r: PixelRect, p: LayoutParams): PixelRect[] {
  if (!isSaneRect(r) || !paramsValid(p)) return [];
  return frameRects(r, borderPx(r, p));
}

/** Two concentric rectangular frames (8 rects) with a groove gap between them. */
export function layoutLayered(r: PixelRect, p: LayoutParams): PixelRect[] {
  if (!isSaneRect(r) || !paramsValid(p)) return [];
  const t = borderPx(r, p);
  const outer = frameRects(r, t);
  if (outer.length === 0) return [];
  const inset = t + groovePx(r, p);
  const innerR: PixelRect = {
    x: r.x + inset,
    y: r.y + inset,
    w: r.w - 2 * inset,
    h: r.h - 2 * inset,
  };
  if (!isSaneRect(innerR)) return [];
  const inner = frameRects(innerR, Math.max(1.5, t * 0.6));
  if (inner.length === 0) return [];
  return [...outer, ...inner];
}

/** Rectangular frame (4 rects) plus the inner field rect it surrounds. */
export function layoutRecessed(r: PixelRect, p: LayoutParams): PixelRect[] {
  if (!isSaneRect(r) || !paramsValid(p)) return [];
  const t = borderPx(r, p);
  const frame = frameRects(r, t);
  if (frame.length === 0) return [];
  const field: PixelRect = {
    x: r.x + t,
    y: r.y + t,
    w: r.w - 2 * t,
    h: r.h - 2 * t,
  };
  if (!isSaneRect(field)) return [];
  return [...frame, field];
}

/** Stepped tray: outer frame + inner frame + inner field rect. */
export function layoutTray(r: PixelRect, p: LayoutParams): PixelRect[] {
  if (!isSaneRect(r) || !paramsValid(p)) return [];
  const t = borderPx(r, p);
  const outer = frameRects(r, t);
  if (outer.length === 0) return [];
  const step = t + groovePx(r, p);
  const mid: PixelRect = {
    x: r.x + step,
    y: r.y + step,
    w: r.w - 2 * step,
    h: r.h - 2 * step,
  };
  if (!isSaneRect(mid)) return [];
  const t2 = Math.max(1.5, t * 0.6);
  const inner = frameRects(mid, t2);
  if (inner.length === 0) return [];
  const field: PixelRect = {
    x: mid.x + t2,
    y: mid.y + t2,
    w: mid.w - 2 * t2,
    h: mid.h - 2 * t2,
  };
  if (!isSaneRect(field)) return [];
  return [...outer, ...inner, field];
}

/** Inset perimeter channel (4 rects) suggesting a cove groove; no light glow here. */
export function layoutCove(r: PixelRect, p: LayoutParams): PixelRect[] {
  if (!isSaneRect(r) || !paramsValid(p)) return [];
  const t = borderPx(r, p);
  const channel: PixelRect = {
    x: r.x + t,
    y: r.y + t,
    w: r.w - 2 * t,
    h: r.h - 2 * t,
  };
  if (!isSaneRect(channel)) return [];
  return frameRects(channel, Math.max(1.5, t * 0.5));
}

/** Wood-look frame (4 rects) around a gypsum-look field rect. */
export function layoutWoodGypsum(r: PixelRect, p: LayoutParams): PixelRect[] {
  if (!isSaneRect(r) || !paramsValid(p)) return [];
  const t = borderPx(r, p);
  const frame = frameRects(r, t);
  if (frame.length === 0) return [];
  const field: PixelRect = {
    x: r.x + t,
    y: r.y + t,
    w: r.w - 2 * t,
    h: r.h - 2 * t,
  };
  if (!isSaneRect(field)) return [];
  return [...frame, field];
}

/**
 * Throws when any rect is invalid: non-finite x/y/w/h, w <= 0, h <= 0,
 * or the rect extends outside `bounds` by more than 1px epsilon.
 */
export function assertRectangular(rects: PixelRect[], bounds: PixelRect): void {
  if (!Array.isArray(rects)) {
    throw new Error('assertRectangular: rects is not an array');
  }
  const EPS = 1;
  rects.forEach((rc, i) => {
    const tag = `rect[${i}]`;
    const comps = [rc.x, rc.y, rc.w, rc.h] as const;
    const names = ['x', 'y', 'w', 'h'] as const;
    for (let k = 0; k < comps.length; k++) {
      const v = comps[k];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error(`assertRectangular: ${tag}.${names[k]} is not finite (got ${String(v)})`);
      }
    }
    if (rc.w <= 0 || rc.h <= 0) {
      throw new Error(`assertRectangular: ${tag} has non-positive area (w=${rc.w}, h=${rc.h})`);
    }
    if (
      rc.x < bounds.x - EPS ||
      rc.y < bounds.y - EPS ||
      rc.x + rc.w > bounds.x + bounds.w + EPS ||
      rc.y + rc.h > bounds.y + bounds.h + EPS
    ) {
      throw new Error(`assertRectangular: ${tag} extends outside bounds by more than ${EPS}px`);
    }
  });
}
