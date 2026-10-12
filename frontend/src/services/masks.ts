/**
 * Polygon mask logic — pure functions, no React.
 * Points are normalized 0..1 so masks survive image resizes.
 */
import type { NormPoint, SurfaceCategory, SurfaceMask } from '../types';
import { uuid } from '../utils/common';

export const SURFACE_COLORS: Record<SurfaceCategory, string[]> = {
  wall: ['#6b7f5e', '#7d9b76', '#54707e', '#8a6f4d'],
  ceiling: ['#9a7b4f', '#b08968'],
  floor: ['#7d8ca3', '#5f7a8c'],
};

function colorFor(category: SurfaceCategory, index: number): string {
  const palette = SURFACE_COLORS[category];
  return palette[index % palette.length];
}

export function createMask(
  category: SurfaceCategory,
  label: string,
  points: NormPoint[],
  index = 0,
): SurfaceMask {
  return { id: uuid(), category, label, points, color: colorFor(category, index) };
}

export function rectPoints(x0: number, y0: number, x1: number, y1: number): NormPoint[] {
  return [
    { x: Math.min(x0, x1), y: Math.min(y0, y1) },
    { x: Math.max(x0, x1), y: Math.min(y0, y1) },
    { x: Math.max(x0, x1), y: Math.max(y0, y1) },
    { x: Math.min(x0, x1), y: Math.max(y0, y1) },
  ];
}

/**
 * Default masks so the user can apply materials immediately:
 * one full-image wall, ceiling = top 35%, floor = bottom 30%.
 */
export function createDefaultMasks(): SurfaceMask[] {
  const wall = createMask('wall', 'Wall 1', rectPoints(0, 0, 1, 1), 0);
  const ceiling = createMask('ceiling', 'Ceiling', rectPoints(0, 0, 1, 0.35), 0);
  const floor = createMask('floor', 'Floor', rectPoints(0, 0.7, 1, 1), 0);
  return [wall, ceiling, floor];
}

export function maskBounds(points: NormPoint[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function pointInPolygon(point: NormPoint, polygon: NormPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonArea(points: NormPoint[]): number {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return Math.abs(area / 2);
}

export function nextWallLabel(surfaces: SurfaceMask[]): string {
  const count = surfaces.filter((s) => s.category === 'wall').length;
  return `Wall ${count + 1}`;
}

export function wallIndex(surfaces: SurfaceMask[]): number {
  return surfaces.filter((s) => s.category === 'wall').length;
}

/** Pixel-space polygon path helper shared by the renderer and SVG overlay. */
export function tracePolygonPath(
  ctx: CanvasRenderingContext2D,
  points: NormPoint[],
  width: number,
  height: number,
): void {
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = p.x * width;
    const y = p.y * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}
