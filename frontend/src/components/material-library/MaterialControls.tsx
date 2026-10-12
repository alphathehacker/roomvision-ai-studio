import { useEffect, useState } from 'react';
import { Check, Layers, RotateCcw } from 'lucide-react';
import type { EditorState, MaterialDef, SurfaceSettings } from '../../types';
import { materialsForCategory, MATERIAL_DEFAULT_COLORS } from '../../services/materials';
import { defaultSettingsForMaterial } from '../../services/editorState';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { MaterialGrid } from './MaterialGrid';
import { ColorPicker } from './ColorPicker';

interface MaterialControlsProps {
  category: 'wall' | 'floor';
  state: EditorState;
  selectedId: string | null;
  onSelectSurface: (id: string | null) => void;
  commit: (updater: (s: EditorState) => EditorState) => void;
  onToast: (message: string, kind?: 'info' | 'error') => void;
}

const CATEGORY_LABEL: Record<string, string> = { wall: 'Walls', floor: 'Flooring' };

/**
 * Material editing for walls/flooring. A local draft is edited, then applied —
 * "Apply to selected surface", "Apply to all walls", "Reset surface".
 * Every application is a single undoable history entry.
 */
export function MaterialControls({
  category,
  state,
  selectedId,
  onSelectSurface,
  commit,
  onToast,
}: MaterialControlsProps) {
  const surfaces = state.surfaces.filter((s) => s.category === category);
  const selected = surfaces.find((s) => s.id === selectedId) ?? surfaces[0] ?? null;
  const currentSettings: SurfaceSettings | undefined = selected ? state.materials[selected.id] : undefined;

  const [draft, setDraft] = useState<SurfaceSettings | null>(null);
  const [draftMaterial, setDraftMaterial] = useState<MaterialDef | null>(null);

  // Reset the draft whenever the selection changes.
  useEffect(() => {
    if (currentSettings) {
      setDraft({ ...currentSettings });
      const mats = materialsForCategory(category);
      setDraftMaterial(mats.find((m) => m.id === currentSettings.materialId) ?? mats[0] ?? null);
    } else {
      setDraft(null);
      setDraftMaterial(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, category]);

  if (!selected || !draft || !draftMaterial) {
    return <p className="text-sm text-charcoal-soft">No {CATEGORY_LABEL[category].toLowerCase()} surface yet.</p>;
  }

  const mats = materialsForCategory(category);

  const pickMaterial = (m: MaterialDef) => {
    setDraftMaterial(m);
    setDraft((d) =>
      d
        ? {
            ...d,
            materialId: m.id,
            color: MATERIAL_DEFAULT_COLORS[m.id] ?? d.color,
          }
        : d,
    );
  };

  const patch = (p: Partial<SurfaceSettings>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const applyTo = (ids: string[]) => {
    const final = { ...draft, materialId: draftMaterial.id };
    commit((s) => {
      const materials = { ...s.materials };
      for (const id of ids) materials[id] = { ...final };
      return { ...s, materials };
    });
  };

  const applySelected = () => {
    applyTo([selected.id]);
    onToast(`${draftMaterial.name} applied to ${selected.label}.`);
  };

  const applyAllWalls = () => {
    const wallIds = state.surfaces.filter((s) => s.category === 'wall').map((s) => s.id);
    applyTo(wallIds);
    onToast(`${draftMaterial.name} applied to all ${wallIds.length} wall${wallIds.length === 1 ? '' : 's'}.`);
  };

  const resetSurface = () => {
    const fresh = defaultSettingsForMaterial(draftMaterial.id);
    setDraft({ ...fresh });
    commit((s) => ({
      ...s,
      materials: { ...s.materials, [selected.id]: { ...fresh } },
    }));
    onToast(`${selected.label} reset to defaults.`);
  };

  const ensureSelected = () => {
    if (selectedId !== selected.id) onSelectSurface(selected.id);
  };

  const isFloor = category === 'floor';
  const isWallpaperLike = draftMaterial.kind === 'wallpaper' || draftMaterial.pattern !== undefined;

  return (
    <section aria-label={`${CATEGORY_LABEL[category]} materials`} className="space-y-4">
      {surfaces.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Choose ${category} surface`}>
          {surfaces.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSurface(s.id)}
              aria-pressed={s.id === selected.id}
              className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                s.id === selected.id
                  ? 'border-moss bg-moss text-white'
                  : 'border-line bg-white text-charcoal hover:border-moss/60'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div>
        <h4 className="text-xs font-medium text-charcoal-soft mb-2">Material</h4>
        <MaterialGrid materials={mats} selectedId={draftMaterial.id} onSelect={pickMaterial} tintColor={draft.color} />
        <p className="text-xs text-charcoal-soft mt-1.5">{draftMaterial.description}</p>
      </div>

      <ColorPicker value={draft.color} onChange={(c) => patch({ color: c })} label="Tint color" />

      <div className="space-y-3">
        <Slider label="Texture scale" value={draft.scale} min={0.25} max={3} step={0.05}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ scale: v })} />
        <Slider label="Opacity" value={draft.opacity} min={0} max={1} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ opacity: v })} />
        <Slider label="Blending intensity" value={draft.blend} min={0} max={1} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ blend: v })} />
        <Slider label="Brightness" value={draft.brightness} min={0.5} max={1.5} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ brightness: v })} />
        <Slider label="Saturation" value={draft.saturation} min={0} max={2} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ saturation: v })} />
        {(isFloor || isWallpaperLike) && (
          <Slider label="Pattern direction" value={draft.rotation} min={0} max={180} step={1}
            format={(v) => `${Math.round(v)}°`} onChange={(v) => patch({ rotation: v })} />
        )}
        {isFloor && (
          <Slider label="Tile size" value={draft.tileSize} min={32} max={320} step={4}
            format={(v) => `${Math.round(v)} px`} onChange={(v) => patch({ tileSize: v })} />
        )}
      </div>

      <div className="space-y-2 pt-1">
        <Button variant="primary" className="w-full" onClick={() => { ensureSelected(); applySelected(); }}>
          <Check size={16} aria-hidden="true" /> Apply to {selected.label}
        </Button>
        {category === 'wall' && (
          <Button variant="secondary" className="w-full" onClick={applyAllWalls}>
            <Layers size={16} aria-hidden="true" /> Apply to all walls
          </Button>
        )}
        <Button variant="ghost" className="w-full" onClick={resetSurface}>
          <RotateCcw size={16} aria-hidden="true" /> Reset surface
        </Button>
      </div>
    </section>
  );
}
