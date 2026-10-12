/**
 * Catalog of ceiling designs (PVC + gypsum families) for the RoomVision ceiling studio.
 * Descriptions are visual only — they make no structural or installation claims.
 */

export type CeilingPatternKind =
  | 'flat'
  | 'linearPanels'
  | 'geometricGrid'
  | 'border'
  | 'layered'
  | 'recessed'
  | 'tray'
  | 'cove'
  | 'woodGypsum';

export interface CeilingDesignDef {
  id: string;
  name: string;
  family: 'pvc' | 'gypsum';
  pattern: CeilingPatternKind;
  /** Id of the finish material this design pairs with (resolved by the material library). */
  finishMaterialId: string;
  defaultColor: string;
  description: string;
  defaults: { panelWidth: number; panelSpacing: number; borderThickness: number };
}

export const CEILING_DESIGNS: CeilingDesignDef[] = [
  // ---- PVC family (10) ----
  {
    id: 'pvc-plain-white',
    name: 'White PVC',
    family: 'pvc',
    pattern: 'flat',
    finishMaterialId: 'pvc-white',
    defaultColor: '#f7f5f0',
    description: 'Flat white PVC-look finish for a clean, bright ceiling; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'pvc-woodgrain',
    name: 'Wood-grain PVC',
    family: 'pvc',
    pattern: 'flat',
    finishMaterialId: 'pvc-woodgrain',
    defaultColor: '#a07c4e',
    description: 'Flat PVC-look finish in a light wood-grain tone; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'pvc-darkwood',
    name: 'Dark Wood PVC',
    family: 'pvc',
    pattern: 'flat',
    finishMaterialId: 'pvc-darkwood',
    defaultColor: '#4a3524',
    description: 'Flat dark wood-tone PVC-look finish; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'pvc-grey',
    name: 'Grey PVC',
    family: 'pvc',
    pattern: 'flat',
    finishMaterialId: 'pvc-grey',
    defaultColor: '#8a8d90',
    description: 'Flat mid-grey PVC-look finish; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'pvc-black',
    name: 'Black PVC',
    family: 'pvc',
    pattern: 'flat',
    finishMaterialId: 'pvc-black',
    defaultColor: '#232326',
    description: 'Flat near-black PVC-look finish; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'pvc-marble',
    name: 'Marble-look PVC',
    family: 'pvc',
    pattern: 'flat',
    finishMaterialId: 'pvc-marblelook',
    defaultColor: '#ece7dc',
    description: 'Flat marble-toned PVC-look finish; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'pvc-gloss',
    name: 'Glossy PVC',
    family: 'pvc',
    pattern: 'flat',
    finishMaterialId: 'pvc-glossy',
    defaultColor: '#f2efe8',
    description: 'Flat glossy-looking PVC finish; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'pvc-matte',
    name: 'Matte PVC',
    family: 'pvc',
    pattern: 'flat',
    finishMaterialId: 'pvc-matte',
    defaultColor: '#e9e4d8',
    description: 'Flat matte PVC-look finish; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'pvc-linear',
    name: 'Linear Rectangular Panels',
    family: 'pvc',
    pattern: 'linearPanels',
    finishMaterialId: 'pvc-white',
    defaultColor: '#f7f5f0',
    description: 'Parallel rectangular panel strips in a white PVC-look; visualization only.',
    defaults: { panelWidth: 6, panelSpacing: 2, borderThickness: 2 },
  },
  {
    id: 'pvc-geometric',
    name: 'Geometric Rectangular Layout',
    family: 'pvc',
    pattern: 'geometricGrid',
    finishMaterialId: 'pvc-matte',
    defaultColor: '#e9e4d8',
    description: 'Rectangular grid layout in a matte PVC-look; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 2 },
  },
  // ---- Gypsum family (8) ----
  {
    id: 'gyp-plain',
    name: 'Plain Gypsum',
    family: 'gypsum',
    pattern: 'flat',
    finishMaterialId: 'gyp-plain',
    defaultColor: '#f5f2ea',
    description: 'Flat plain gypsum-look finish; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'gyp-rect',
    name: 'Rectangular False Ceiling',
    family: 'gypsum',
    pattern: 'border',
    finishMaterialId: 'gyp-plain',
    defaultColor: '#f5f2ea',
    description: 'Rectangular perimeter border in a gypsum-look; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'gyp-layered',
    name: 'Layered Rectangular',
    family: 'gypsum',
    pattern: 'layered',
    finishMaterialId: 'gyp-plain',
    defaultColor: '#f5f2ea',
    description: 'Two concentric rectangular frames in a gypsum-look; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 2 },
  },
  {
    id: 'gyp-recessed',
    name: 'Recessed Rectangular',
    family: 'gypsum',
    pattern: 'recessed',
    finishMaterialId: 'gyp-plain',
    defaultColor: '#f5f2ea',
    description: 'Recessed-look inner field with a gypsum-look frame; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'gyp-border',
    name: 'Border Design',
    family: 'gypsum',
    pattern: 'border',
    finishMaterialId: 'gyp-plain',
    defaultColor: '#f5f2ea',
    description: 'Wide rectangular border band in a gypsum-look; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 5 },
  },
  {
    id: 'gyp-cove',
    name: 'Cove-lighting Design',
    family: 'gypsum',
    pattern: 'cove',
    finishMaterialId: 'gyp-plain',
    defaultColor: '#f5f2ea',
    description: 'Inset perimeter channel suggesting a cove groove (light glow handled separately); visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'gyp-tray',
    name: 'Rectangular Tray Ceiling',
    family: 'gypsum',
    pattern: 'tray',
    finishMaterialId: 'gyp-plain',
    defaultColor: '#f5f2ea',
    description: 'Stepped rectangular tray with layered frames in a gypsum-look; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 3 },
  },
  {
    id: 'gyp-woodcombo',
    name: 'Wood & Gypsum Combo',
    family: 'gypsum',
    pattern: 'woodGypsum',
    finishMaterialId: 'gyp-wood',
    defaultColor: '#8a6b42',
    description: 'Wood-tone frame around a gypsum-look field; visualization only.',
    defaults: { panelWidth: 4, panelSpacing: 2, borderThickness: 4 },
  },
];

export const CEILING_DESIGNS_BY_ID: Record<string, CeilingDesignDef> = Object.fromEntries(
  CEILING_DESIGNS.map((d) => [d.id, d]),
);

export function designsForFamily(f: 'pvc' | 'gypsum'): CeilingDesignDef[] {
  return CEILING_DESIGNS.filter((d) => d.family === f);
}
