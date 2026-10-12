/** Material catalog shown in the right panel. All textures are procedural. */
import type { MaterialDef } from '../types';

export const MATERIALS: MaterialDef[] = [
  // ---- walls ----
  { id: 'paint-solid', name: 'Solid Paint', kind: 'solid', category: 'wall', description: 'Clean flat color finish' },
  { id: 'paint-matte', name: 'Matte Paint', kind: 'matte', category: 'wall', description: 'Soft chalky finish, subtle texture' },
  { id: 'paint-glossy', name: 'Glossy Paint', kind: 'glossy', category: 'wall', description: 'Reflective sheen finish' },
  { id: 'wp-diagonal', name: 'Geo Stripes', kind: 'wallpaper', category: 'wall', pattern: 'diagonal', description: 'Diagonal stripe wallpaper' },
  { id: 'wp-hex', name: 'Hexagon', kind: 'wallpaper', category: 'wall', pattern: 'hex', description: 'Hexagon lattice wallpaper' },
  { id: 'wp-diamond', name: 'Diamond Lattice', kind: 'wallpaper', category: 'wall', pattern: 'diamond', description: 'Diamond trellis wallpaper' },
  { id: 'wp-bands', name: 'Wallpaper Bands', kind: 'wallpaper', category: 'wall', pattern: 'stripes', description: 'Bold banded wallpaper' },
  { id: 'wood-wall', name: 'Wood Panels', kind: 'wood', category: 'wall', description: 'Vertical timber cladding' },
  { id: 'stone-wall', name: 'Natural Stone', kind: 'stone', category: 'wall', description: 'Rough-cut stone blocks' },
  { id: 'marble-wall', name: 'Marble', kind: 'marble', category: 'wall', description: 'Veined marble slabs' },
  { id: 'brick-wall', name: 'Exposed Brick', kind: 'brick', category: 'wall', description: 'Classic running-bond brick' },
  { id: 'concrete-wall', name: 'Concrete', kind: 'concrete', category: 'wall', description: 'Raw industrial concrete' },
  // ---- ceiling ----
  { id: 'ceil-paint', name: 'Ceiling Paint', kind: 'solid', category: 'ceiling', description: 'Flat ceiling paint' },
  { id: 'ceil-matte', name: 'Matte Ceiling', kind: 'matte', category: 'ceiling', description: 'Soft matte ceiling finish' },
  { id: 'ceil-wood', name: 'Wooden Ceiling', kind: 'wood', category: 'ceiling', description: 'Wood-grain ceiling look' },
  { id: 'ceil-panel', name: 'Panel Grid', kind: 'panel', category: 'ceiling', description: 'Rectangular coffered-style panels' },
  { id: 'ceil-concrete', name: 'Concrete Ceiling', kind: 'concrete', category: 'ceiling', description: 'Exposed concrete slab look' },
  { id: 'pvc-white', name: 'White PVC', kind: 'solid', category: 'ceiling', description: 'Classic white PVC panels' },
  { id: 'pvc-woodgrain', name: 'Wood-grain PVC', kind: 'wood', category: 'ceiling', description: 'PVC panels with wood grain' },
  { id: 'pvc-darkwood', name: 'Dark Wood PVC', kind: 'wood', category: 'ceiling', description: 'Dark wood-tone PVC panels' },
  { id: 'pvc-grey', name: 'Grey PVC', kind: 'matte', category: 'ceiling', description: 'Soft matte grey PVC panels' },
  { id: 'pvc-black', name: 'Black PVC', kind: 'matte', category: 'ceiling', description: 'Bold matte black PVC panels' },
  { id: 'pvc-marblelook', name: 'Marble-look PVC', kind: 'marble', category: 'ceiling', description: 'Marble-effect PVC panels' },
  { id: 'pvc-glossy', name: 'Glossy PVC', kind: 'glossy', category: 'ceiling', description: 'High-sheen glossy PVC panels' },
  { id: 'pvc-matte', name: 'Matte PVC', kind: 'matte', category: 'ceiling', description: 'Flat matte PVC panels' },
  { id: 'gyp-plain', name: 'Plain Gypsum', kind: 'matte', category: 'ceiling', description: 'Plain gypsum board finish' },
  { id: 'gyp-wood', name: 'Gypsum + Wood', kind: 'wood', category: 'ceiling', description: 'Gypsum with warm wood accents' },
  // ---- floor ----
  { id: 'floor-tile', name: 'Ceramic Tiles', kind: 'tile', category: 'floor', description: 'Glazed ceramic tiles' },
  { id: 'floor-pattern', name: 'Patterned Tiles', kind: 'wallpaper', category: 'floor', pattern: 'diamond', description: 'Decorative patterned tiles' },
  { id: 'floor-marble', name: 'Marble Floor', kind: 'marble', category: 'floor', description: 'Polished marble' },
  { id: 'floor-granite', name: 'Granite', kind: 'granite', category: 'floor', description: 'Speckled granite' },
  { id: 'floor-wood', name: 'Wooden Flooring', kind: 'wood', category: 'floor', description: 'Hardwood planks' },
  { id: 'floor-laminate', name: 'Laminate', kind: 'laminate', category: 'floor', description: 'Laminate plank flooring' },
  { id: 'floor-vinyl', name: 'Vinyl Planks', kind: 'vinyl', category: 'floor', description: 'Vinyl plank flooring' },
  { id: 'floor-concrete', name: 'Concrete Floor', kind: 'concrete', category: 'floor', description: 'Polished concrete' },
  { id: 'floor-stone', name: 'Stone Floor', kind: 'stone', category: 'floor', description: 'Natural stone slabs' },
];

export const MATERIALS_BY_ID: Record<string, MaterialDef> = Object.fromEntries(
  MATERIALS.map((m) => [m.id, m]),
);

export function materialsForCategory(category: 'wall' | 'ceiling' | 'floor'): MaterialDef[] {
  return MATERIALS.filter((m) => m.category === category);
}

/** Default tint applied when a material is first chosen for a surface. */
export const MATERIAL_DEFAULT_COLORS: Record<string, string> = {
  'paint-solid': '#e8e2d5',
  'paint-matte': '#ded8c8',
  'paint-glossy': '#e4ddcc',
  'wp-diagonal': '#d9cfae',
  'wp-hex': '#cfd6c8',
  'wp-diamond': '#d8cdb8',
  'wp-bands': '#c9c2b2',
  'wood-wall': '#9a7b4f',
  'stone-wall': '#b0a695',
  'marble-wall': '#ece7dc',
  'brick-wall': '#a35f43',
  'concrete-wall': '#b9b7b0',
  'ceil-paint': '#f5f2ea',
  'ceil-matte': '#efe9dc',
  'ceil-wood': '#8a6b42',
  'ceil-panel': '#f0ebdf',
  'ceil-concrete': '#c2c0b9',
  'pvc-white': '#f7f5f0',
  'pvc-woodgrain': '#a07c4e',
  'pvc-darkwood': '#4a3524',
  'pvc-grey': '#8a8d90',
  'pvc-black': '#232326',
  'pvc-marblelook': '#ece7dc',
  'pvc-glossy': '#f2efe8',
  'pvc-matte': '#e9e4d8',
  'gyp-plain': '#f5f2ea',
  'gyp-wood': '#8a6b42',
  'floor-tile': '#ddd5c2',
  'floor-pattern': '#c9bfa8',
  'floor-marble': '#e8e3d6',
  'floor-granite': '#8f8b82',
  'floor-wood': '#a07c4e',
  'floor-laminate': '#b08c58',
  'floor-vinyl': '#c2a878',
  'floor-concrete': '#b5b3ac',
  'floor-stone': '#a9a094',
};

/** 16 preset swatches for the color picker. */
export const PRESET_SWATCHES: string[] = [
  '#faf7f2', '#f0e8d8', '#e4d9c0', '#d3b78f',
  '#9a7b4f', '#7a5f38', '#5c5347', '#3a3a3d',
  '#6b7f5e', '#a3b18a', '#ccd5c0', '#e8e4da',
  '#b08968', '#a35f43', '#7d8ca3', '#c1666b',
];
