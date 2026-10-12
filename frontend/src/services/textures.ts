/**
 * Procedural texture generation — pure Canvas API, no image assets, works offline.
 * Each generator returns a tileable canvas painted in the requested base color.
 */
import type { TextureKind, WallpaperPattern } from '../types';

export interface GeneratedTexture {
  canvas: HTMLCanvasElement;
  repeatable: boolean;
}

export const TILE_SIZE = 256;

/** Deterministic PRNG so the same material looks identical across renders. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size = TILE_SIZE): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return [canvas, ctx];
}

/** Parse #rrggbb (or #rgb) into rgb components. Falls back to a warm grey. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return [210, 205, 195];
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Fine grain noise painted tileably (mirrored edges). */
function paintNoise(ctx: CanvasRenderingContext2D, size: number, rand: () => number, alpha: number, dark = true): void {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 2; // -1..1
    const v = n * 255 * alpha;
    d[i] += v * (dark ? -1 : 1) * 0.5 + v * 0.5;
    d[i + 1] += v * (dark ? -1 : 1) * 0.5 + v * 0.5;
    d[i + 2] += v * (dark ? -1 : 1) * 0.5 + v * 0.5;
  }
  ctx.putImageData(img, 0, 0);
}

function softBlotches(
  ctx: CanvasRenderingContext2D,
  size: number,
  rand: () => number,
  tones: string[],
  count: number,
  minR: number,
  maxR: number,
  alpha: number,
): void {
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = minR + rand() * (maxR - minR);
    const tone = tones[Math.floor(rand() * tones.length)];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(tone, alpha));
    g.addColorStop(1, rgba(tone, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // wrap edges for tileability: repaint near opposite edges
    for (const [ox, oy] of [[-size, 0], [size, 0], [0, -size], [0, size]] as const) {
      if (x + ox > -r && x + ox < size + r && y + oy > -r && y + oy < size + r) {
        const g2 = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g2.addColorStop(0, rgba(tone, alpha));
        g2.addColorStop(1, rgba(tone, 0));
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function genSolid(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  paintNoise(ctx, size, rand, 0.03);
}

function genMatte(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  paintNoise(ctx, size, rand, 0.09);
  softBlotches(ctx, size, rand, [shade(color, -18), shade(color, 14)], 10, 18, 46, 0.10);
}

function genGlossy(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  paintNoise(ctx, size, rand, 0.03);
  // sheen band across the tile (diagonal, mirrored by drawing twice)
  for (const off of [0, -size]) {
    const g = ctx.createLinearGradient(off, 0, off + size, size);
    g.addColorStop(0.30, 'rgba(255,255,255,0)');
    g.addColorStop(0.48, 'rgba(255,255,255,0.16)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.72, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(off, 0, size, size);
  }
}

function wallpaperMotif(
  ctx: CanvasRenderingContext2D,
  size: number,
  pattern: WallpaperPattern,
  lineColor: string,
): void {
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const step = size / 4;
  if (pattern === 'diagonal' || pattern === 'stripes') {
    for (let i = -size; i < size * 2; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
  } else if (pattern === 'diamond') {
    for (let y = 0; y <= size; y += step) {
      for (let x = 0; x <= size; x += step) {
        const ox = (y / step) % 2 === 0 ? 0 : step / 2;
        ctx.beginPath();
        ctx.moveTo(x + ox, y);
        ctx.lineTo(x + ox + step / 2, y + step / 2);
        ctx.lineTo(x + ox, y + step);
        ctx.lineTo(x + ox - step / 2, y + step / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }
  } else {
    // hex grid — tileable when drawn on a lattice
    const r = step / 2;
    const w = Math.sqrt(3) * r;
    for (let row = -1; row <= size / (1.5 * r) + 1; row++) {
      for (let col = -1; col <= size / w + 1; col++) {
        const cx = col * w + (row % 2 === 0 ? 0 : w / 2);
        const cy = row * 1.5 * r;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k + Math.PI / 6;
          const px = cx + r * 0.92 * Math.cos(a);
          const py = cy + r * 0.92 * Math.sin(a);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
}

function genWallpaper(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  pattern: WallpaperPattern,
  rand: () => number,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  paintNoise(ctx, size, rand, 0.04);
  wallpaperMotif(ctx, size, pattern, shade(color, -46));
  // small accent dots on a lattice for texture
  ctx.fillStyle = shade(color, 42);
  const step = size / 4;
  for (let y = 0; y <= size; y += step) {
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath();
      ctx.arc(x + step / 2, y + step / 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function genWood(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  // vertical grain with sinusoidal distortion
  const lines = 26;
  for (let i = 0; i < lines; i++) {
    const baseX = (i / lines) * size;
    const tone = shade(color, -34 + rand() * 46);
    ctx.strokeStyle = rgba(tone, 0.55);
    ctx.lineWidth = 1 + rand() * 2.2;
    const phase = rand() * Math.PI * 2;
    const amp = 2 + rand() * 5;
    ctx.beginPath();
    for (let y = 0; y <= size; y += 6) {
      const x = baseX + Math.sin((y / size) * Math.PI * 2 + phase) * amp;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // a few darker knots
  softBlotches(ctx, size, rand, [shade(color, -70)], 4, 6, 14, 0.35);
  paintNoise(ctx, size, rand, 0.04);
}

function genStone(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  softBlotches(ctx, size, rand, [shade(color, -40), shade(color, -22), shade(color, 26), shade(color, 48)], 46, 12, 44, 0.28);
  paintNoise(ctx, size, rand, 0.10);
}

function genMarble(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  softBlotches(ctx, size, rand, [shade(color, 18), shade(color, -14)], 14, 24, 60, 0.14);
  // veins: layered sine strokes
  for (let i = 0; i < 7; i++) {
    const veinTone = shade(color, -70 - rand() * 40);
    ctx.strokeStyle = rgba(veinTone, 0.28 + rand() * 0.22);
    ctx.lineWidth = 0.8 + rand() * 1.6;
    const y0 = rand() * size;
    const phase = rand() * Math.PI * 2;
    const freq = 1.5 + rand() * 2.5;
    const amp = 8 + rand() * 22;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 5) {
      const y = y0 + Math.sin((x / size) * Math.PI * freq + phase) * amp + Math.sin(x * 0.11 + phase * 2) * 3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  paintNoise(ctx, size, rand, 0.03);
}

function genBrick(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  const mortar = shade(color, -110);
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, size, size);
  const rows = 6;
  const bh = size / rows;
  const bw = size / 3;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw / 2);
    for (let c = -1; c < 4; c++) {
      const x = c * bw + offset;
      const tone = shade(color, -26 + rand() * 34);
      ctx.fillStyle = tone;
      ctx.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      ctx.fillStyle = rgba(shade(tone, 30), 0.35);
      ctx.fillRect(x + 2, r * bh + 2, bw - 4, 3);
    }
  }
  paintNoise(ctx, size, rand, 0.06);
}

function genConcrete(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  paintNoise(ctx, size, rand, 0.13);
  softBlotches(ctx, size, rand, [shade(color, -26), shade(color, 20)], 18, 20, 56, 0.12);
  // speckles
  for (let i = 0; i < 700; i++) {
    const v = rand();
    ctx.fillStyle = v > 0.5 ? rgba('#000000', 0.16) : rgba('#ffffff', 0.12);
    ctx.fillRect(rand() * size, rand() * size, 1.4, 1.4);
  }
}

function genTile(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  const cells = 2;
  const cw = size / cells;
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const tone = shade(color, -10 + rand() * 16);
      ctx.fillStyle = tone;
      ctx.fillRect(c * cw, r * cw, cw, cw);
      const g = ctx.createLinearGradient(c * cw, r * cw, c * cw + cw, r * cw + cw);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.06)');
      ctx.fillStyle = g;
      ctx.fillRect(c * cw, r * cw, cw, cw);
    }
  }
  ctx.strokeStyle = rgba(shade(color, -80), 0.9);
  ctx.lineWidth = 4;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cw, 0);
    ctx.lineTo(i * cw, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cw);
    ctx.lineTo(size, i * cw);
    ctx.stroke();
  }
  paintNoise(ctx, size, rand, 0.03);
}

function genLaminate(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  const rows = 4;
  const ph = size / rows;
  for (let r = 0; r < rows; r++) {
    const tone = shade(color, -20 + rand() * 26);
    ctx.fillStyle = tone;
    ctx.fillRect(0, r * ph, size, ph);
    // grain streaks
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = rgba(shade(tone, -44), 0.35);
      ctx.lineWidth = 1;
      const y = r * ph + rand() * ph;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.3, y + (rand() - 0.5) * 6, size * 0.7, y + (rand() - 0.5) * 6, size, y);
      ctx.stroke();
    }
    // plank end joints (staggered)
    const joint = ((r * 197) % size);
    ctx.fillStyle = rgba(shade(color, -90), 0.85);
    ctx.fillRect(joint, r * ph, 2.5, ph);
    ctx.fillRect(0, r * ph, size, 2);
  }
  paintNoise(ctx, size, rand, 0.04);
}

function genVinyl(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  const rows = 5;
  const ph = size / rows;
  for (let r = 0; r < rows; r++) {
    const tone = shade(color, -12 + rand() * 18);
    ctx.fillStyle = tone;
    ctx.fillRect(0, r * ph + 1, size, ph - 2);
    softBlotches(ctx, size, rand, [shade(tone, -24)], 3, 8, 22, 0.10);
  }
  paintNoise(ctx, size, rand, 0.05);
}

function genGranite(ctx: CanvasRenderingContext2D, size: number, color: string, rand: () => number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  softBlotches(ctx, size, rand, [shade(color, -34), shade(color, 30)], 30, 8, 30, 0.22);
  for (let i = 0; i < 2600; i++) {
    const v = rand();
    ctx.fillStyle =
      v < 0.4 ? rgba('#000000', 0.28) : v < 0.7 ? rgba('#ffffff', 0.20) : rgba(shade(color, 70), 0.25);
    ctx.fillRect(rand() * size, rand() * size, 1.6, 1.6);
  }
}

function genPanel(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  rand: () => number,
  panelWidth: number,
  panelSpacing: number,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  paintNoise(ctx, size, rand, 0.05);
  const cells = Math.max(1, Math.round(panelWidth));
  const cw = size / cells;
  const gap = Math.max(0, panelSpacing) * 1.6;
  ctx.strokeStyle = rgba(shade(color, -70), 0.85);
  ctx.lineWidth = Math.max(1.5, gap);
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cw, 0);
    ctx.lineTo(i * cw, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cw);
    ctx.lineTo(size, i * cw);
    ctx.stroke();
  }
  // subtle inner bevel highlight
  ctx.strokeStyle = rgba('#ffffff', 0.14);
  ctx.lineWidth = 1.5;
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      ctx.strokeRect(c * cw + gap, r * cw + gap, cw - gap * 2, cw - gap * 2);
    }
  }
}

export interface TextureOptions {
  pattern?: WallpaperPattern;
  seed?: number;
  /** for ceiling panels */
  panelWidth?: number;
  panelSpacing?: number;
}

const cache = new Map<string, HTMLCanvasElement>();

/**
 * Generate (and memoize) a procedural texture tile for a material kind + color.
 * Cached by kind|color|pattern|panel params so re-renders are cheap.
 */
export function generateTexture(kind: TextureKind, color: string, opts: TextureOptions = {}): GeneratedTexture {
  const { pattern = 'diagonal', seed = 7, panelWidth = 4, panelSpacing = 2 } = opts;
  const key = `${kind}|${color.toLowerCase()}|${pattern}|${panelWidth}|${panelSpacing}`;
  const cached = cache.get(key);
  if (cached) return { canvas: cached, repeatable: true };
  const [canvas, ctx] = makeCanvas();
  const rand = mulberry32(seed + kind.length * 131 + color.length * 17);
  switch (kind) {
    case 'solid': genSolid(ctx, TILE_SIZE, color, rand); break;
    case 'matte': genMatte(ctx, TILE_SIZE, color, rand); break;
    case 'glossy': genGlossy(ctx, TILE_SIZE, color, rand); break;
    case 'wallpaper': genWallpaper(ctx, TILE_SIZE, color, pattern, rand); break;
    case 'wood': genWood(ctx, TILE_SIZE, color, rand); break;
    case 'stone': genStone(ctx, TILE_SIZE, color, rand); break;
    case 'marble': genMarble(ctx, TILE_SIZE, color, rand); break;
    case 'brick': genBrick(ctx, TILE_SIZE, color, rand); break;
    case 'concrete': genConcrete(ctx, TILE_SIZE, color, rand); break;
    case 'tile': genTile(ctx, TILE_SIZE, color, rand); break;
    case 'laminate': genLaminate(ctx, TILE_SIZE, color, rand); break;
    case 'vinyl': genVinyl(ctx, TILE_SIZE, color, rand); break;
    case 'granite': genGranite(ctx, TILE_SIZE, color, rand); break;
    case 'panel': genPanel(ctx, TILE_SIZE, color, rand, panelWidth, panelSpacing); break;
  }
  cache.set(key, canvas);
  return { canvas, repeatable: true };
}

export function clearTextureCache(): void {
  cache.clear();
}
