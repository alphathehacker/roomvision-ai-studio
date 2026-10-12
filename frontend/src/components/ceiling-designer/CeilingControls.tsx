import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Info, Lightbulb, Zap, ShieldCheck, Pencil, Trash2, Plus, Ban } from 'lucide-react';
import type {
  EditorState,
  MaterialDef,
  SurfaceSettings,
  CeilingLightMode,
  LedStrip,
} from '../../types';
import { materialsForCategory, MATERIAL_DEFAULT_COLORS } from '../../services/materials';
import { defaultSettingsForMaterial } from '../../services/editorState';
import { uuid } from '../../utils/common';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Tabs } from '../ui/tabs';
import { MaterialGrid } from '../material-library/MaterialGrid';
import { ColorPicker } from '../material-library/ColorPicker';
import { cn } from '../ui/utils';
import { designsForFamily, CEILING_DESIGNS_BY_ID } from '../../services/ceilingDesigns';
import type { CeilingDesignDef } from '../../services/ceilingDesigns';
import { paintCeilingPattern } from '../../services/ceilingPatterns';
import { hexToRgb } from '../../services/textures';

/* ------------------------------------------------------------------ */
/* Procedural design thumbnails (112x72, painted once when visible).    */
/* ------------------------------------------------------------------ */

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v - amount)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function paintDesignThumbnail(canvas: HTMLCanvasElement, design: CeilingDesignDef): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Lay down the default color first so the tile is never blank.
  ctx.fillStyle = design.defaultColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  paintCeilingPattern(
    ctx,
    design.pattern,
    { x: 0, y: 0, w: canvas.width, h: canvas.height },
    {
      panelWidth: design.defaults.panelWidth,
      panelSpacing: design.defaults.panelSpacing,
      borderThickness: design.defaults.borderThickness,
      baseColor: design.defaultColor,
      grooveColor: darken(design.defaultColor, 60),
    },
  );
}

/** Lazily-painted 112x72 design thumbnail, memoized per design. */
const DesignThumb = memo(function DesignThumb({
  design,
  selected,
  onSelect,
}: {
  design: CeilingDesignDef;
  selected: boolean;
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            setVisible(true);
          }
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      paintDesignThumbnail(canvas, design);
    } catch (err) {
      console.warn('Ceiling design thumbnail paint failed:', err);
    }
  }, [visible, design]);

  return (
    <div ref={wrapRef}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        title={design.description}
        className={cn(
          'w-full rounded-xl border overflow-hidden transition-all bg-white',
          selected ? 'border-moss ring-2 ring-moss/40' : 'border-line hover:border-moss/60',
        )}
      >
        <canvas ref={canvasRef} width={112} height={72} className="w-full h-[72px] block" aria-hidden="true" />
        <span className="block px-1 py-1 text-[11px] font-medium text-charcoal leading-tight truncate">
          {design.name}
        </span>
      </button>
    </div>
  );
});

/* ------------------------------------------------------------------ */

const CEILING_LIGHT_MODES: { value: CeilingLightMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'warm', label: 'Warm' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'cool', label: 'Cool' },
];

const LED_EDGES: LedStrip['edge'][] = ['top', 'bottom', 'left', 'right'];
const EDGE_LABELS: Record<LedStrip['edge'], string> = {
  top: 'Top',
  bottom: 'Bottom',
  left: 'Left',
  right: 'Right',
};

const MAX_LED_STRIPS = 8;

interface CeilingControlsProps {
  state: EditorState;
  selectedId: string | null;
  onSelectSurface: (id: string | null) => void;
  commit: (updater: (s: EditorState) => EditorState) => void;
  onToast: (message: string, kind?: 'info' | 'error') => void;
  spotPlacing?: boolean;
  onToggleSpotPlacement?: () => void;
  preservePlacing?: boolean;
  onTogglePreservePlacement?: () => void;
  onEditCeilingMask?: () => void;
}

/**
 * Phase-2 ceiling studio: PVC/gypsum design catalog, finish picker, live
 * sliders, ceiling lighting, LED strips, spotlights, preserve zones and
 * mask editing. Everything commits immediately — no Apply step; undo
 * covers mistakes.
 */
export function CeilingControls({
  state,
  selectedId,
  onSelectSurface,
  commit,
  onToast,
  spotPlacing = false,
  onToggleSpotPlacement,
  preservePlacing = false,
  onTogglePreservePlacement,
  onEditCeilingMask,
}: CeilingControlsProps) {
  const ceilings = state.surfaces.filter((s) => s.category === 'ceiling');
  const selected = ceilings.find((s) => s.id === selectedId) ?? ceilings[0] ?? null;

  const [family, setFamily] = useState<'pvc' | 'gypsum'>('pvc');
  const [stripEdge, setStripEdge] = useState<LedStrip['edge']>('top');

  const designs = useMemo(() => designsForFamily(family), [family]);

  if (!selected) {
    return <p className="text-sm text-charcoal-soft">No ceiling surface yet.</p>;
  }

  const surfaceId = selected.id;
  const surf: SurfaceSettings =
    state.materials[surfaceId] ?? defaultSettingsForMaterial('ceil-paint');
  const ceiling = state.ceiling;
  const light = ceiling.ceilingLight ?? { mode: 'off' as CeilingLightMode, intensity: 0.5 };
  const ledStrips = ceiling.ledStrips ?? [];
  const spotlights = ceiling.spotlights ?? [];
  const preserveZones = ceiling.preserveZones ?? [];
  const designId = ceiling.designId ?? 'none';

  const mats = materialsForCategory('ceiling');
  const material: MaterialDef =
    mats.find((m) => m.id === surf.materialId) ?? mats[0] ?? null;
  if (!material) {
    return <p className="text-sm text-charcoal-soft">Ceiling materials unavailable.</p>;
  }

  const patchSurface = (p: Partial<SurfaceSettings>) =>
    commit((s) => ({
      ...s,
      materials: {
        ...s.materials,
        [surfaceId]: { ...(s.materials[surfaceId] ?? defaultSettingsForMaterial('ceil-paint')), ...p },
      },
    }));

  const pickMaterial = (m: MaterialDef) => {
    patchSurface({ materialId: m.id, color: MATERIAL_DEFAULT_COLORS[m.id] ?? surf.color });
  };

  const selectDesign = (id: string) => {
    const def = CEILING_DESIGNS_BY_ID[id];
    if (id !== 'none' && !def) return;
    commit((s) => {
      const next: EditorState = {
        ...s,
        ceiling: {
          ...s.ceiling,
          designId: id,
          borderThickness: def ? def.defaults.borderThickness : s.ceiling.borderThickness,
        },
      };
      if (def) {
        const known = materialsForCategory('ceiling').some((m) => m.id === def.finishMaterialId);
        if (known) {
          const cur = s.materials[surfaceId] ?? defaultSettingsForMaterial('ceil-paint');
          next.materials = {
            ...s.materials,
            [surfaceId]: {
              ...cur,
              materialId: def.finishMaterialId,
              color: def.defaultColor,
              panelWidth: def.defaults.panelWidth,
              panelSpacing: def.defaults.panelSpacing,
            },
          };
        }
      }
      return next;
    });
    onToast(def ? `${def.name} ceiling design selected.` : 'Design cleared — finish only.');
  };

  const patchCeilingLight = (p: Partial<{ mode: CeilingLightMode; intensity: number }>) =>
    commit((s) => ({
      ...s,
      ceiling: {
        ...s.ceiling,
        ceilingLight: { ...(s.ceiling.ceilingLight ?? { mode: 'off' as const, intensity: 0.5 }), ...p },
      },
    }));

  const addStrip = () => {
    if (ledStrips.length >= MAX_LED_STRIPS) {
      onToast(`You can add up to ${MAX_LED_STRIPS} LED strips.`, 'error');
      return;
    }
    const edge = stripEdge;
    commit((s) => ({
      ...s,
      ceiling: {
        ...s.ceiling,
        ledStrips: [
          ...(s.ceiling.ledStrips ?? []),
          { id: uuid(), edge, inset: 0, length: 0.8, intensity: 0.8 },
        ],
      },
    }));
    onToast(`${EDGE_LABELS[edge]} LED strip added.`);
  };

  const patchStrip = (id: string, p: Partial<LedStrip>) =>
    commit((s) => ({
      ...s,
      ceiling: {
        ...s.ceiling,
        ledStrips: (s.ceiling.ledStrips ?? []).map((st) => (st.id === id ? { ...st, ...p } : st)),
      },
    }));

  const removeStrip = (id: string) =>
    commit((s) => ({
      ...s,
      ceiling: {
        ...s.ceiling,
        ledStrips: (s.ceiling.ledStrips ?? []).filter((st) => st.id !== id),
      },
    }));

  const patchSpot = (id: string, p: Partial<{ intensity: number }>) =>
    commit((s) => ({
      ...s,
      ceiling: {
        ...s.ceiling,
        spotlights: (s.ceiling.spotlights ?? []).map((sp) => (sp.id === id ? { ...sp, ...p } : sp)),
      },
    }));

  const removeSpot = (id: string) =>
    commit((s) => ({
      ...s,
      ceiling: {
        ...s.ceiling,
        spotlights: (s.ceiling.spotlights ?? []).filter((sp) => sp.id !== id),
      },
    }));

  const removeZone = (index: number) =>
    commit((s) => ({
      ...s,
      ceiling: {
        ...s.ceiling,
        preserveZones: (s.ceiling.preserveZones ?? []).filter((_, i) => i !== index),
      },
    }));

  const handleEditMask = () => {
    if (onEditCeilingMask) {
      onEditCeilingMask();
      onToast('Click on the canvas to add ceiling outline points.');
    }
  };

  const resetCeiling = () => {
    commit((s) => ({
      ...s,
      materials: { ...s.materials, [surfaceId]: defaultSettingsForMaterial('ceil-paint') },
      ceiling: {
        ...s.ceiling,
        designId: 'none',
        borderThickness: 3,
        heightShift: 0,
        ceilingLight: { mode: 'off' as const, intensity: 0.5 },
        ledStrips: [],
        spotlights: [],
        preserveZones: [],
      },
    }));
    onToast(`${selected.label} reset to defaults.`);
  };

  return (
    <section aria-label="Ceiling design" className="space-y-4">
      {/* surface selector when there are several ceiling surfaces */}
      {ceilings.length > 1 && (
        <div>
          <h4 className="text-xs font-medium text-charcoal-soft mb-2">Ceiling surface</h4>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ceiling surfaces">
            {ceilings.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectSurface(c.id)}
                aria-pressed={selected.id === c.id}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  selected.id === c.id
                    ? 'border-moss bg-moss/10 text-charcoal'
                    : 'border-line bg-white text-charcoal-soft hover:border-moss/60',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* design catalog */}
      <div>
        <h4 className="text-xs font-medium text-charcoal-soft mb-2">Ceiling design</h4>
        <Tabs
          tabs={[
            { value: 'pvc' as const, label: 'PVC' },
            { value: 'gypsum' as const, label: 'Gypsum' },
          ]}
          value={family}
          onChange={setFamily}
          ariaLabel="Ceiling design family"
        />
        <div className="grid grid-cols-2 gap-2 mt-2" role="listbox" aria-label={`${family.toUpperCase()} designs`}>
          <button
            type="button"
            role="option"
            aria-selected={designId === 'none'}
            onClick={() => selectDesign('none')}
            title="No pattern — ceiling finish only"
            className={cn(
              'rounded-xl border overflow-hidden transition-all bg-white',
              designId === 'none' ? 'border-moss ring-2 ring-moss/40' : 'border-line hover:border-moss/60',
            )}
          >
            <span
              className="w-full h-[72px] flex items-center justify-center"
              style={{ backgroundColor: surf.color }}
              aria-hidden="true"
            >
              <Ban size={20} className="text-charcoal/40" />
            </span>
            <span className="block px-1 py-1 text-[11px] font-medium text-charcoal leading-tight">
              None (finish only)
            </span>
          </button>
          {designs.map((d) => (
            <DesignThumb
              key={d.id}
              design={d}
              selected={designId === d.id}
              onSelect={() => selectDesign(d.id)}
            />
          ))}
        </div>
        {designs.length === 0 && (
          <p className="text-xs text-charcoal-soft mt-2">
            No {family.toUpperCase()} designs in the catalog yet — finish options still work.
          </p>
        )}
      </div>

      {/* finish picker */}
      <div>
        <h4 className="text-xs font-medium text-charcoal-soft mb-2">Finish</h4>
        <MaterialGrid materials={mats} selectedId={material.id} onSelect={pickMaterial} tintColor={surf.color} />
        <p className="text-xs text-charcoal-soft mt-1.5">{material.description}</p>
      </div>

      <ColorPicker value={surf.color} onChange={(c) => patchSurface({ color: c })} label="Ceiling color" />

      {/* layout sliders */}
      <div className="rounded-xl border border-line bg-white p-3 space-y-3">
        <p className="text-xs font-medium text-charcoal-soft">Panel layout</p>
        <Slider label="Panel width" value={surf.panelWidth} min={1} max={12} step={1}
          format={(v) => `${Math.round(v)}`} onChange={(v) => patchSurface({ panelWidth: v })} />
        <Slider label="Panel spacing" value={surf.panelSpacing} min={0} max={8} step={0.5}
          format={(v) => `${v}`} onChange={(v) => patchSurface({ panelSpacing: v })} />
        <Slider label="Border thickness" value={ceiling.borderThickness ?? 3} min={0} max={8} step={0.5}
          format={(v) => `${v}`} onChange={(v) => commit((s) => ({ ...s, ceiling: { ...s.ceiling, borderThickness: v } }))} />
      </div>

      <div className="space-y-3">
        <Slider label="Texture scale" value={surf.scale} min={0.25} max={3} step={0.05}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchSurface({ scale: v })} />
        <Slider label="Opacity" value={surf.opacity} min={0} max={1} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchSurface({ opacity: v })} />
        <Slider label="Blending intensity" value={surf.blend} min={0} max={1} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchSurface({ blend: v })} />
        <Slider label="Brightness" value={surf.brightness} min={0.5} max={1.5} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchSurface({ brightness: v })} />
      </div>

      <div className="rounded-xl border border-bronze/40 bg-bronze/10 p-3 space-y-2">
        <p className="text-xs font-medium text-charcoal">Ceiling height preview</p>
        <Slider
          label="Lower ceiling"
          value={ceiling.heightShift}
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

      {/* ceiling lighting */}
      <div className="rounded-xl border border-line bg-white p-3 space-y-3">
        <p className="text-xs font-medium text-charcoal-soft">Ceiling light</p>
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Ceiling light mode">
          {CEILING_LIGHT_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => patchCeilingLight({ mode: m.value })}
              aria-pressed={light.mode === m.value}
              className={cn(
                'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                light.mode === m.value
                  ? 'border-bronze bg-bronze text-white'
                  : 'border-line bg-white text-charcoal hover:border-bronze/60',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Slider label="Light intensity" value={light.intensity} min={0} max={1} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchCeilingLight({ intensity: v })} />
        <p className="text-xs text-charcoal-soft">
          Simplified preview, not a light simulation.
        </p>
      </div>

      {/* LED strips */}
      <div className="rounded-xl border border-line bg-white p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-bronze" aria-hidden="true" />
          <p className="text-xs font-medium text-charcoal-soft">LED strips</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="LED strip edge">
          {LED_EDGES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setStripEdge(e)}
              aria-pressed={stripEdge === e}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                stripEdge === e
                  ? 'border-moss bg-moss/10 text-charcoal'
                  : 'border-line bg-white text-charcoal-soft hover:border-moss/60',
              )}
            >
              {EDGE_LABELS[e]}
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" className="w-full" onClick={addStrip}>
          <Plus size={14} aria-hidden="true" /> Add strip
        </Button>
        {ledStrips.length === 0 ? (
          <p className="text-xs text-charcoal-soft">
            No LED strips yet — pick an edge, then tap Add strip.
          </p>
        ) : (
          <ul className="space-y-3">
            {ledStrips.map((st, i) => (
              <li key={st.id} className="rounded-lg bg-sand/60 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-charcoal">
                    Strip {i + 1} · {EDGE_LABELS[st.edge]}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeStrip(st.id)}
                    aria-label={`Remove strip ${i + 1}`}
                    className="p-1.5 rounded-lg text-charcoal-soft hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
                <Slider label="Intensity" value={st.intensity} min={0} max={1} step={0.01}
                  format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchStrip(st.id, { intensity: v })} />
                <Slider label="Length" value={st.length} min={0.1} max={1} step={0.01}
                  format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchStrip(st.id, { length: v })} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* spotlights */}
      <div className="rounded-xl border border-line bg-white p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="text-bronze" aria-hidden="true" />
          <p className="text-xs font-medium text-charcoal-soft">Spotlights</p>
        </div>
        {onToggleSpotPlacement && (
          <Button
            size="sm"
            variant={spotPlacing ? 'primary' : 'secondary'}
            className="w-full"
            onClick={onToggleSpotPlacement}
            aria-pressed={spotPlacing}
          >
            {spotPlacing ? 'Stop placing' : 'Place spotlights'}
          </Button>
        )}
        {spotPlacing && (
          <p className="text-xs text-charcoal-soft">Click on the ceiling to place a spotlight.</p>
        )}
        {spotlights.length === 0 ? (
          <p className="text-xs text-charcoal-soft">
            No spotlights yet — tap Place spotlights, then click the ceiling.
          </p>
        ) : (
          <ul className="space-y-3">
            {spotlights.map((sp, i) => (
              <li key={sp.id} className="rounded-lg bg-sand/60 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-charcoal">Spotlight {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeSpot(sp.id)}
                    aria-label={`Remove spotlight ${i + 1}`}
                    className="p-1.5 rounded-lg text-charcoal-soft hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
                <Slider label="Intensity" value={sp.intensity} min={0} max={1} step={0.01}
                  format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchSpot(sp.id, { intensity: v })} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* preserve zones */}
      <div className="rounded-xl border border-line bg-white p-3 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-moss" aria-hidden="true" />
          <p className="text-xs font-medium text-charcoal-soft">Keep wooden blocks &amp; beams</p>
        </div>
        {onTogglePreservePlacement && (
          <Button
            size="sm"
            variant={preservePlacing ? 'primary' : 'secondary'}
            className="w-full"
            onClick={onTogglePreservePlacement}
            aria-pressed={preservePlacing}
          >
            {preservePlacing ? 'Stop marking' : 'Mark preserve zone'}
          </Button>
        )}
        {preservePlacing && (
          <p className="text-xs text-charcoal-soft">Drag a rectangle around the beam or block.</p>
        )}
        {preserveZones.length === 0 ? (
          <p className="text-xs text-charcoal-soft">
            No preserve zones yet — tap Mark preserve zone, then drag over the area.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {preserveZones.map((_, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-sand/60 px-2.5 py-2"
              >
                <span className="text-xs font-medium text-charcoal">Zone {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeZone(i)}
                  aria-label={`Remove zone ${i + 1}`}
                  className="p-1.5 rounded-lg text-charcoal-soft hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-charcoal-soft">
          Areas you mark keep the original photo — designs never paint over them.
        </p>
      </div>

      {/* mask editing */}
      {onEditCeilingMask && (
        <Button variant="outline" className="w-full" onClick={handleEditMask}>
          <Pencil size={15} aria-hidden="true" /> Edit ceiling mask
        </Button>
      )}

      {/* honest note */}
      <div className="flex items-start gap-2 rounded-xl bg-sand p-3 text-xs text-charcoal-soft">
        <Info size={14} className="mt-0.5 shrink-0 text-bronze" aria-hidden="true" />
        <p>Preview is a visualization only — not a verified structural change.</p>
      </div>

      <div className="space-y-2 pt-1">
        <Button variant="ghost" className="w-full" onClick={resetCeiling}>
          <RotateCcw size={16} aria-hidden="true" /> Reset ceiling
        </Button>
      </div>
    </section>
  );
}
