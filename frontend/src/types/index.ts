/** Core domain types for RoomVision AI Studio (Phase 1). */

export interface NormPoint {
  /** normalized 0..1, relative to the image dimensions */
  x: number;
  y: number;
}

export type SurfaceCategory = 'wall' | 'ceiling' | 'floor';

export interface SurfaceMask {
  id: string;
  category: SurfaceCategory;
  label: string;
  points: NormPoint[]; // normalized 0..1 coords, clockwise not required
  /** distinct overlay color (hex) used in the editor UI */
  color: string;
}

/** Procedural texture kinds generated on canvas (no image assets). */
export type TextureKind =
  | 'solid'
  | 'matte'
  | 'glossy'
  | 'wallpaper'
  | 'wood'
  | 'stone'
  | 'marble'
  | 'brick'
  | 'concrete'
  | 'tile'
  | 'laminate'
  | 'vinyl'
  | 'granite'
  | 'panel';

export type WallpaperPattern = 'diagonal' | 'hex' | 'diamond' | 'stripes';

export interface MaterialDef {
  id: string;
  name: string;
  kind: TextureKind;
  /** which category tab shows this material */
  category: 'wall' | 'ceiling' | 'floor';
  pattern?: WallpaperPattern;
  description: string;
}

export interface SurfaceSettings {
  materialId: string;
  /** user-chosen tint color */
  color: string;
  /** texture scale multiplier 0.25..3 */
  scale: number;
  /** layer opacity 0..1 */
  opacity: number;
  /** 0.5..1.5 via ctx.filter */
  brightness: number;
  /** 0..2 via ctx.filter */
  saturation: number;
  /** how strongly the material replaces the original photo 0..1 */
  blend: number;
  /** pattern rotation in degrees 0..180 */
  rotation: number;
  /** tile/plank size in px at render scale (flooring) */
  tileSize: number;
  /** ceiling panel width (relative units 1..12) */
  panelWidth: number;
  /** ceiling panel spacing (relative units 0..8) */
  panelSpacing: number;
}

export type LightingPreset = 'warm' | 'neutral' | 'cool';

export interface GlowSpot {
  id: string;
  /** normalized 0..1 */
  x: number;
  y: number;
  /** 0..1 */
  intensity: number;
}

export interface LightingSettings {
  preset: LightingPreset;
  /** color temperature slider 2700..6500 (K) */
  temperature: number;
  /** 0..1 overlay intensity */
  intensity: number;
  glows: GlowSpot[];
}

export interface CeilingSettings {
  /** visual drop of the ceiling render, percent of ceiling-mask height 0..25 */
  heightShift: number;
}

export interface EditorState {
  surfaces: SurfaceMask[];
  materials: Record<string, SurfaceSettings>; // keyed by surface id
  lighting: LightingSettings;
  ceiling: CeilingSettings;
  /** bumped whenever backend schema changes */
  version: number;
}

export const EDITOR_STATE_VERSION = 1;

export function defaultSurfaceSettings(materialId: string, color: string): SurfaceSettings {
  return {
    materialId,
    color,
    scale: 1,
    opacity: 1,
    brightness: 1,
    saturation: 1,
    blend: 0.85,
    rotation: 0,
    tileSize: 96,
    panelWidth: 4,
    panelSpacing: 2,
  };
}
