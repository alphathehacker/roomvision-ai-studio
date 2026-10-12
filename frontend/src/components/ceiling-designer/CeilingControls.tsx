import { useEffect, useState } from 'react';
import { Check, RotateCcw, Info } from 'lucide-react';
import type { EditorState, MaterialDef, SurfaceSettings } from '../../types';
import { materialsForCategory, MATERIAL_DEFAULT_COLORS } from '../../services/materials';
import { defaultSettingsForMaterial } from '../../services/editorState';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { MaterialGrid } from '../material-library/MaterialGrid';
import { ColorPicker } from '../material-library/ColorPicker';

/**
 * Phase-1 ceiling tools: material + color + rectangular panel layout
 * (panel width / spacing) + a ceiling-height adjustment that visibly drops the
 * ceiling render inside the ceiling mask with a shadow line.
 */
export function CeilingControls({
  state,
  selectedId,
  onSelectSurface,
  commit,
  onToast,
}: {
  state: EditorState;
  selectedId: string | null;
  onSelectSurface: (id: string | null) => void;
  commit: (updater: (s: EditorState) => EditorState) => void;
  onToast: (message: string, kind?: 'info' | 'error') => void;
}) {
  const ceilings = state.surfaces.filter((s) => s.category === 'ceiling');
  const selected = ceilings.find((s) => s.id === selectedId) ?? ceilings[0] ?? null;
  const current: SurfaceSettings | undefined = selected ? state.materials[selected.id] : undefined;

  const [draft, setDraft] = useState<SurfaceSettings | null>(null);
  const [draftMaterial, setDraftMaterial] = useState<MaterialDef | null>(null);

  useEffect(() => {
    if (current) {
      setDraft({ ...current });
      const mats = materialsForCategory('ceiling');
      setDraftMaterial(mats.find((m) => m.id === current.materialId) ?? mats[0] ?? null);
    } else {
      setDraft(null);
      setDraftMaterial(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  if (!selected || !draft || !draftMaterial) {
    return <p className="text-sm text-charcoal-soft">No ceiling surface yet.</p>;
  }

  const mats = materialsForCategory('ceiling');
  const patch = (p: Partial<SurfaceSettings>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const pickMaterial = (m: MaterialDef) => {
    setDraftMaterial(m);
    patch({ materialId: m.id, color: MATERIAL_DEFAULT_COLORS[m.id] ?? draft.color });
  };

  const apply = () => {
    if (selectedId !== selected.id) onSelectSurface(selected.id);
    const final = { ...draft, materialId: draftMaterial.id };
    commit((s) => ({
      ...s,
      materials: { ...s.materials, [selected.id]: { ...final } },
    }));
    onToast(`${draftMaterial.name} applied to ${selected.label}.`);
  };

  const reset = () => {
    const fresh = defaultSettingsForMaterial(draftMaterial.id);
    setDraft({ ...fresh });
    commit((s) => ({
      ...s,
      materials: { ...s.materials, [selected.id]: { ...fresh } },
      ceiling: { ...s.ceiling, heightShift: 0 },
    }));
    onToast(`${selected.label} reset to defaults.`);
  };

  return (
    <section aria-label="Ceiling design" className="space-y-4">
      <div>
        <h4 className="text-xs font-medium text-charcoal-soft mb-2">Ceiling material</h4>
        <MaterialGrid materials={mats} selectedId={draftMaterial.id} onSelect={pickMaterial} tintColor={draft.color} />
        <p className="text-xs text-charcoal-soft mt-1.5">{draftMaterial.description}</p>
      </div>

      <ColorPicker value={draft.color} onChange={(c) => patch({ color: c })} label="Ceiling color" />

      {draftMaterial.kind === 'panel' && (
        <div className="rounded-xl border border-line bg-white p-3 space-y-3">
          <p className="text-xs font-medium text-charcoal-soft">Rectangular panel layout</p>
          <Slider label="Panel width" value={draft.panelWidth} min={1} max={12} step={1}
            format={(v) => `${Math.round(v)}`} onChange={(v) => patch({ panelWidth: v })} />
          <Slider label="Panel spacing" value={draft.panelSpacing} min={0} max={8} step={0.5}
            format={(v) => `${v}`} onChange={(v) => patch({ panelSpacing: v })} />
        </div>
      )}

      <div className="space-y-3">
        <Slider label="Texture scale" value={draft.scale} min={0.25} max={3} step={0.05}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ scale: v })} />
        <Slider label="Opacity" value={draft.opacity} min={0} max={1} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ opacity: v })} />
        <Slider label="Blending intensity" value={draft.blend} min={0} max={1} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ blend: v })} />
        <Slider label="Brightness" value={draft.brightness} min={0.5} max={1.5} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ brightness: v })} />
      </div>

      <div className="rounded-xl border border-bronze/40 bg-bronze/10 p-3 space-y-2">
        <p className="text-xs font-medium text-charcoal">Ceiling height preview</p>
        <Slider
          label="Lower ceiling"
          value={state.ceiling.heightShift}
          min={0}
          max={25}
          step={1}
          format={(v) => `${Math.round(v)}%`}
          onChange={(v) => commit((s) => ({ ...s, ceiling: { ...s.ceiling, heightShift: v } }))}
        />
        <p className="text-xs text-charcoal-soft">
          Visually drops the ceiling render inside the mask with a shadow line.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-sand p-3 text-xs text-charcoal-soft">
        <Info size={14} className="mt-0.5 shrink-0 text-bronze" aria-hidden="true" />
        <p>
          Previews are visualizations only, not verified structural modifications. Existing wooden
          beams and structural elements are preserved — the editor never auto-covers them.
        </p>
      </div>

      <div className="space-y-2 pt-1">
        <Button variant="primary" className="w-full" onClick={apply}>
          <Check size={16} aria-hidden="true" /> Apply to {selected.label}
        </Button>
        <Button variant="ghost" className="w-full" onClick={reset}>
          <RotateCcw size={16} aria-hidden="true" /> Reset ceiling
        </Button>
      </div>
    </section>
  );
}
