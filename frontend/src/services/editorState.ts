/** Initial editor state: default masks + sensible default materials. */
import type { EditorState, SurfaceSettings } from '../types';
import { defaultSurfaceSettings, EDITOR_STATE_VERSION } from '../types';
import { createDefaultMasks } from './masks';
import { MATERIAL_DEFAULT_COLORS } from './materials';

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
    ceiling: { heightShift: 0 },
    version: EDITOR_STATE_VERSION,
  };
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
    ceiling: { heightShift: state.ceiling?.heightShift ?? 0 },
    version: EDITOR_STATE_VERSION,
  };
}
