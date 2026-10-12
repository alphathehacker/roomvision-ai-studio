/**
 * Rendering engine — pure logic, no React.
 * Pipeline: original ImageBitmap → per-surface layer (clip to polygon → procedural
 * material tile → brightness/saturation → blend) → composite → lighting overlays.
 * The original bitmap is never mutated; every call returns a fresh canvas.
 */
import type { EditorState, MaterialDef, NormPoint, SurfaceMask, SurfaceSettings } from '../types';
import { MATERIALS_BY_ID } from './materials';
import { generateTexture } from './textures';
import { maskBounds, tracePolygonPath } from './masks';
import { clamp } from '../utils/common';

const FLOOR_TILE_KINDS = new Set(['tile', 'laminate', 'vinyl', 'marble', 'granite', 'stone', 'wallpaper', 'wood', 'concrete']);

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function temperatureTint(tempK: number): [number, number, number] {
  const t = clamp((tempK - 2700) / (6500 - 2700), 0, 1);
  return [
    Math.round(lerp(255, 150, t)),
    Math.round(lerp(172, 188, t)),
    Math.round(lerp(96, 255, t)),
  ];
}

/**
 * Build a material swatch canvas at the requested effective size.
 * For flooring-style textures the `tileSize` slider drives the tile size directly.
 */
function buildSwatch(def: MaterialDef, settings: SurfaceSettings): HTMLCanvasElement {
  const { canvas } = generateTexture(def.kind, settings.color, {
    pattern: def.pattern,
    panelWidth: settings.panelWidth,
    panelSpacing: settings.panelSpacing,
  });
  const base = FLOOR_TILE_KINDS.has(def.kind) ? settings.tileSize : 256;
  const size = Math.max(48, Math.round(clamp(base, 32, 1024) * settings.scale));
  const swatch = document.createElement('canvas');
  swatch.width = size;
  swatch.height = size;
  const ctx = swatch.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, 0, 0, size, size);
  return swatch;
}

function polygonPixelPath(
  ctx: CanvasRenderingContext2D,
  points: NormPoint[],
  width: number,
  height: number,
): void {
  tracePolygonPath(ctx, points, width, height);
}

/**
 * Render one surface into a layer canvas.
 *
 * IMPORTANT: the layer contains ONLY the material (transparent elsewhere) —
 * never the original photo underneath. Layers are composited on top of each
 * other, so a layer holding the full original would erase every surface
 * drawn before it. Within the mask the layer pixel is the material at
 * alpha=blend; compositing it at globalAlpha=opacity over the photo gives
 * exactly blend*opacity*material + (1-blend*opacity)*photo.
 */
function renderSurfaceLayer(
  original: ImageBitmap,
  surface: SurfaceMask,
  settings: SurfaceSettings,
  ceilingShiftPx: number,
): { layer: HTMLCanvasElement; points: NormPoint[] } {
  const w = original.width;
  const h = original.height;
  const layer = document.createElement('canvas');
  layer.width = w;
  layer.height = h;
  const ctx = layer.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const shiftNorm = ceilingShiftPx / h;
  const pts: NormPoint[] =
    ceilingShiftPx > 0
      ? surface.points.map((p) => ({ x: p.x, y: clamp(p.y + shiftNorm, 0, 1) }))
      : surface.points;

  const empty = { layer, points: pts };
  const def = MATERIALS_BY_ID[settings.materialId];
  if (!def) return empty;

  const swatch = buildSwatch(def, settings);
  const pattern = ctx.createPattern(swatch, 'repeat');
  if (!pattern) return empty;

  // Rotate/scale the tiling around the surface centroid.
  const bounds = maskBounds(pts);
  const cx = ((bounds.minX + bounds.maxX) / 2) * w;
  const cy = ((bounds.minY + bounds.maxY) / 2) * h;
  const rad = (settings.rotation * Math.PI) / 180;
  try {
    pattern.setTransform(
      new DOMMatrix().translate(cx, cy).rotate((rad * 180) / Math.PI).translate(-cx, -cy),
    );
  } catch {
    /* older browsers: tiling without rotation */
  }

  ctx.save();
  polygonPixelPath(ctx, pts, w, h);
  ctx.clip();
  ctx.filter = `brightness(${clamp(settings.brightness, 0.3, 1.8)}) saturate(${clamp(settings.saturation, 0, 2.5)})`;
  ctx.globalAlpha = clamp(settings.blend, 0, 1);
  ctx.fillStyle = pattern;
  const pad = 2;
  ctx.fillRect(bounds.minX * w - pad, bounds.minY * h - pad, (bounds.maxX - bounds.minX) * w + pad * 2, (bounds.maxY - bounds.minY) * h + pad * 2);
  ctx.restore();
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  return { layer, points: pts };
}

function drawCeilingShadow(
  ctx: CanvasRenderingContext2D,
  surface: SurfaceMask,
  w: number,
  h: number,
): void {
  // Soft shadow band along the ORIGINAL bottom edge of the ceiling mask —
  // sells the "dropped ceiling" look when heightShift > 0.
  const bounds = maskBounds(surface.points);
  const bottomY = bounds.maxY * h;
  const bandH = Math.max(6, h * 0.025);
  ctx.save();
  tracePolygonPath(ctx, surface.points, w, h);
  ctx.clip();
  const g = ctx.createLinearGradient(0, bottomY - bandH, 0, bottomY);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(bounds.minX * w, bottomY - bandH, (bounds.maxX - bounds.minX) * w, bandH);
  ctx.restore();
}

function applyLighting(ctx: CanvasRenderingContext2D, w: number, h: number, lighting: EditorState['lighting']): void {
  if (lighting.intensity <= 0 && lighting.glows.length === 0) return;

  // Full-canvas color grade.
  if (lighting.intensity > 0) {
    const [r, g, b] = temperatureTint(lighting.temperature);
    const alpha = clamp(0.05 + lighting.intensity * 0.28, 0, 0.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Spotlight glows (simplified preview, not a light simulation).
  const radius = Math.min(w, h) * 0.22;
  for (const glow of lighting.glows) {
    const x = glow.x * w;
    const y = glow.y * h;
    const a = clamp(glow.intensity, 0, 1) * 0.55;
    if (a <= 0) continue;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(255,240,214,${a})`);
    grad.addColorStop(1, 'rgba(255,240,214,0)');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }
}

/**
 * Render the full editor state onto a new canvas at the original's resolution.
 * Throws on canvas failures (callers should surface a user-facing error).
 */
export function renderEditor(original: ImageBitmap, state: EditorState): HTMLCanvasElement {
  const w = original.width;
  const h = original.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.drawImage(original, 0, 0);

  // Deterministic order: walls → floor → ceiling so the ceiling shadow reads on top.
  const order: SurfaceMask[] = [
    ...state.surfaces.filter((s) => s.category === 'wall'),
    ...state.surfaces.filter((s) => s.category === 'floor'),
    ...state.surfaces.filter((s) => s.category === 'ceiling'),
  ];

  for (const surface of order) {
    if (surface.points.length < 3) continue;
    const settings = state.materials[surface.id];
    if (!settings) continue;

    let shiftPx = 0;
    if (surface.category === 'ceiling' && state.ceiling.heightShift > 0) {
      const bounds = maskBounds(surface.points);
      shiftPx = (state.ceiling.heightShift / 100) * (bounds.maxY - bounds.minY) * h;
    }

    const { layer, points } = renderSurfaceLayer(original, surface, settings, shiftPx);
    // Composite only inside the (possibly shifted) mask so surfaces never
    // erase each other.
    ctx.save();
    ctx.globalAlpha = clamp(settings.opacity, 0, 1);
    tracePolygonPath(ctx, points, w, h);
    ctx.clip();
    ctx.drawImage(layer, 0, 0);
    ctx.restore();

    if (surface.category === 'ceiling' && state.ceiling.heightShift > 0) {
      drawCeilingShadow(ctx, surface, w, h);
    }
  }

  applyLighting(ctx, w, h, state.lighting);
  return out;
}

/** Render just the original photo to a canvas (used by the compare view). */
export function renderOriginal(original: ImageBitmap): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = original.width;
  c.height = original.height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(original, 0, 0);
  return c;
}
