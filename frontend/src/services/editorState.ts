/** Initial editor state: default masks + sensible default materials. */
import type { EditorState, SurfaceSettings } from '../types';
import { defaultSurfaceSettings, EDITOR_STATE_VERSION } from '../types';
import { createDefaultMasks } from './masks';
import { MATERIAL_DEFAULT_COLORS } from './materials';

export function defaultCeilingSettings() {
  return {
    heightShift: 0,
    designId: 'none',
    borderThickness: 3,
    ceilingLight: { mode: 'off' as const, intensity: 0.5 },
    ledStrips: [],
    spotlights: [],
    preserveZones: [],
  };
}

export function defaultSettingsForMaterial(materialId: string): SurfaceSettings {
  return defaultSurfaceSettings(materialId, MATERIAL_DEFAULT_COLORS[materialId] ?? '#e8e2d5');
}

export function createInitialState(): EditorState {
  const surfaces = createDefaultMasks();
  const wall = surfaces.find((s) => s.category === 'wall');
  const ceiling = surfaces.find((s) => s.category === 'ceiling');
  const floor = surfaces.find((s) => s.category === 'floor');
  const materials: Record<string, SurfaceSettings> = {};
  if (wall) materials[wall.id] = defaultSettingsForMaterial('paint-solid');
  if (ceiling) materials[ceiling.id] = defaultSettingsForMaterial('ceil-paint');
  if (floor) materials[floor.id] = defaultSettingsForMaterial('floor-wood');
  return {
    surfaces,
    materials,
    lighting: { preset: 'neutral', temperature: 4500, intensity: 0.25, glows: [] },
    ceiling: defaultCeilingSettings(),
    version: EDITOR_STATE_VERSION,
  };
}

/** Validators used when migrating older saves to the v2 ceiling schema. */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function sanitizePreserveZones(zones: unknown): NonNullable<EditorState['ceiling']['preserveZones']> {
  if (!Array.isArray(zones)) return [];
  return zones.filter(
    (z): z is NonNullable<EditorState['ceiling']['preserveZones']>[number] =>
      Array.isArray(z) &&
      z.length >= 3 &&
      z.every((p) => p && isFiniteNumber(p.x) && isFiniteNumber(p.y)),
  );
}

function sanitizeLedStrips(strips: unknown): NonNullable<EditorState['ceiling']['ledStrips']> {
  if (!Array.isArray(strips)) return [];
  return strips.filter(
    (s): s is NonNullable<EditorState['ceiling']['ledStrips']>[number] =>
      !!s &&
      typeof s.id === 'string' &&
      (s.edge === 'top' || s.edge === 'bottom' || s.edge === 'left' || s.edge === 'right') &&
      isFiniteNumber(s.inset) &&
      isFiniteNumber(s.length) &&
      isFiniteNumber(s.intensity),
  );
}

function sanitizeSpots(spots: unknown): NonNullable<EditorState['ceiling']['spotlights']> {
  if (!Array.isArray(spots)) return [];
  return spots.filter(
    (s): s is NonNullable<EditorState['ceiling']['spotlights']>[number] =>
      !!s &&
      typeof s.id === 'string' &&
      isFiniteNumber(s.x) &&
      isFiniteNumber(s.y) &&
      isFiniteNumber(s.intensity),
  );
}

function sanitizeCeilingLight(light: unknown): EditorState['ceiling']['ceilingLight'] {
  if (
    light &&
    typeof light === 'object' &&
    (light as { mode?: unknown }).mode !== undefined &&
    ['off', 'warm', 'neutral', 'cool'].includes((light as { mode: string }).mode)
  ) {
    return {
      mode: (light as { mode: 'off' | 'warm' | 'neutral' | 'cool' }).mode,
      intensity: isFiniteNumber((light as { intensity?: unknown }).intensity)
        ? ((light as { intensity: number }).intensity)
        : 0.5,
    };
  }
  return { mode: 'off', intensity: 0.5 };
}

/** Ensure every surface has settings (used when reopening old saves). */
export function normalizeState(state: EditorState): EditorState {
  const materials = { ...state.materials };
  for (const s of state.surfaces) {
    if (!materials[s.id]) {
      const fallback =
        s.category === 'ceiling' ? 'ceil-paint' : s.category === 'floor' ? 'floor-wood' : 'paint-solid';
      materials[s.id] = defaultSettingsForMaterial(fallback);
    }
  }
  return {
    surfaces: state.surfaces,
    materials,
    lighting: {
      preset: state.lighting?.preset ?? 'neutral',
      temperature: state.lighting?.temperature ?? 4500,
      intensity: state.lighting?.intensity ?? 0.25,
      glows: state.lighting?.glows ?? [],
    },
    ceiling: {
      heightShift: state.ceiling?.heightShift ?? 0,
      designId: state.ceiling?.designId ?? 'none',
      borderThickness: state.ceiling?.borderThickness ?? 3,
      ceilingLight: sanitizeCeilingLight(state.ceiling?.ceilingLight),
      ledStrips: sanitizeLedStrips(state.ceiling?.ledStrips),
      spotlights: sanitizeSpots(state.ceiling?.spotlights),
      preserveZones: sanitizePreserveZones(state.ceiling?.preserveZones),
    },
    version: EDITOR_STATE_VERSION,
  };
}
