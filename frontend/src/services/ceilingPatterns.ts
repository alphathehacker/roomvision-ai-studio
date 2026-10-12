/**
 * Canvas painters for ceiling patterns — DOM allowed here.
 *
 * Each painter calls the matching layout function from ceilingLayouts.ts,
 * fills the returned rects with tones derived from baseColor/grooveColor,
 * then runs assertRectangular on what was drawn before returning it.
 * 'flat' paints nothing and returns []. Safe at tiny (thumbnail) sizes.
 */
import { hexToRgb } from './textures';
import {
  assertRectangular,
  layoutBorder,
  layoutCove,
  layoutGeometricGrid,
  layoutLayered,
  layoutLinearPanels,
  layoutRecessed,
  layoutTray,
  layoutWoodGypsum,
} from './ceilingLayouts';
import type { PixelRect } from './ceilingLayouts';
import type { CeilingPatternKind } from './ceilingDesigns';

export interface PatternParams {
  panelWidth: number;
  panelSpacing: number;
  borderThickness: number;
  baseColor: string;
  grooveColor: string;
}

/** Lighten (positive) or darken (negative) a hex color by an absolute amount. */
function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Linear mix of two hex colors; t=0 → a, t=1 → b. */
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const f = (i: number) => Math.max(0, Math.min(255, Math.round(A[i] * (1 - t) + B[i] * t)));
  return `rgb(${f(0)},${f(1)},${f(2)})`;
}

function fillRects(ctx: CanvasRenderingContext2D, rects: PixelRect[], style: string): void {
  ctx.fillStyle = style;
  for (const rc of rects) {
    ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
  }
}

function paintField(ctx: CanvasRenderingContext2D, r: PixelRect, style: string): void {
  if (Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0) {
    ctx.fillStyle = style;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

/**
 * Paint a ceiling pattern into rectPx. Returns the rects that were drawn
 * (validated with assertRectangular). 'flat' paints nothing and returns [].
 */
export function paintCeilingPattern(
  ctx: CanvasRenderingContext2D,
  pattern: CeilingPatternKind,
  rectPx: PixelRect,
  params: PatternParams,
): PixelRect[] {
  if (pattern === 'flat') return [];
  const base = params.baseColor;
  const groove = params.grooveColor;
  const lp = {
    panelWidth: params.panelWidth,
    panelSpacing: params.panelSpacing,
    borderThickness: params.borderThickness,
  };

  let drawn: PixelRect[];
  switch (pattern) {
    case 'linearPanels': {
      // Groove-colored field, base strips on top.
      paintField(ctx, rectPx, groove);
      drawn = layoutLinearPanels(rectPx, lp);
      fillRects(ctx, drawn, base);
      break;
    }
    case 'geometricGrid': {
      // Groove-colored field, base cells on top.
      paintField(ctx, rectPx, groove);
      drawn = layoutGeometricGrid(rectPx, lp);
      fillRects(ctx, drawn, base);
      break;
    }
    case 'border': {
      // Base field, darker frame band.
      paintField(ctx, rectPx, base);
      drawn = layoutBorder(rectPx, lp);
      fillRects(ctx, drawn, shade(base, -28));
      break;
    }
    case 'layered': {
      // Base field; outer frame darkest, inner frame mid-tone
      // (layoutLayered returns outer 4 rects first, then inner 4).
      paintField(ctx, rectPx, base);
      drawn = layoutLayered(rectPx, lp);
      fillRects(ctx, drawn.slice(0, 4), shade(base, -32));
      fillRects(ctx, drawn.slice(4), shade(base, -16));
      break;
    }
    case 'recessed': {
      // Base field; frame band darker, inner field stays base
      // (layoutRecessed returns 4 frame rects, then the field rect).
      paintField(ctx, rectPx, base);
      drawn = layoutRecessed(rectPx, lp);
      fillRects(ctx, drawn.slice(0, 4), shade(base, -24));
      break;
    }
    case 'tray': {
      // Base field; stepped darker→mid tones toward the center
      // (layoutTray returns outer 4, inner 4, then the field rect).
      paintField(ctx, rectPx, base);
      drawn = layoutTray(rectPx, lp);
      fillRects(ctx, drawn.slice(0, 4), shade(base, -32));
      fillRects(ctx, drawn.slice(4, 8), shade(base, -16));
      break;
    }
    case 'cove': {
      // Base field; inset perimeter channel painted as a darker shadow groove.
      paintField(ctx, rectPx, base);
      drawn = layoutCove(rectPx, lp);
      fillRects(ctx, drawn, shade(base, -44));
      break;
    }
    case 'woodGypsum': {
      // Gypsum base field; frame painted in a warm wood brown derived from base.
      paintField(ctx, rectPx, base);
      drawn = layoutWoodGypsum(rectPx, lp);
      fillRects(ctx, drawn.slice(0, 4), mix(base, '#7a5a36', 0.8));
      break;
    }
    default: {
      drawn = [];
      break;
    }
  }

  assertRectangular(drawn, rectPx);
  return drawn;
}
