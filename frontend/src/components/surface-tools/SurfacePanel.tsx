import { useState } from 'react';
import { Plus, Trash2, RotateCcw, Eraser, Sparkles, Loader2, SquareDashed, MousePointer2 } from 'lucide-react';
import type { EditorState, SurfaceCategory } from '../../types';
import { defaultSurfaceSettings } from '../../types';
import { createMask, nextWallLabel, rectPoints, wallIndex } from '../../services/masks';
import { tryAiSegmentation } from '../../services/aiProvider';
import { MATERIAL_DEFAULT_COLORS } from '../../services/materials';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/dialog';
import type { CanvasMode } from '../room-editor/EditorCanvas';
import { cn } from '../ui/utils';

interface SurfacePanelProps {
  state: EditorState;
  selectedId: string | null;
  onSelectSurface: (id: string | null) => void;
  commit: (updater: (s: EditorState) => EditorState) => void;
  mode: CanvasMode;
  onModeChange: (m: CanvasMode) => void;
  selectedPoint: { surfaceId: string; index: number } | null;
  originalBlob: Blob;
  onToast: (message: string, kind?: 'info' | 'error') => void;
}

export function SurfacePanel({
  state,
  selectedId,
  onSelectSurface,
  commit,
  mode,
  onModeChange,
  selectedPoint,
  originalBlob,
  onToast,
}: SurfacePanelProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const selected = state.surfaces.find((s) => s.id === selectedId) ?? null;

  const addWall = () => {
    const idx = wallIndex(state.surfaces);
    const mask = createMask('wall', nextWallLabel(state.surfaces), rectPoints(0.15, 0.2, 0.85, 0.8), idx);
    commit((s) => ({
      ...s,
      surfaces: [...s.surfaces, mask],
      materials: {
        ...s.materials,
        [mask.id]: defaultSurfaceSettings('paint-solid', MATERIAL_DEFAULT_COLORS['paint-solid'] ?? '#e8e2d5'),
      },
    }));
    onSelectSurface(mask.id);
    onToast(`Added ${mask.label}. Click on the canvas to add points, or use Rectangle mode.`);
  };

  const deleteSurface = (id: string) => {
    const target = state.surfaces.find((s) => s.id === id);
    if (!target) return;
    if (state.surfaces.length <= 1) {
      onToast('You need at least one surface. Reset the mask instead.', 'error');
      return;
    }
    commit((s) => {
      const materials = { ...s.materials };
      delete materials[id];
      return { ...s, surfaces: s.surfaces.filter((sf) => sf.id !== id), materials };
    });
    if (selectedId === id) onSelectSurface(state.surfaces.find((sf) => sf.id !== id)?.id ?? null);
  };

  const resetMask = (category: SurfaceCategory) => {
    const defaults: Record<SurfaceCategory, { x0: number; y0: number; x1: number; y1: number }> = {
      wall: { x0: 0, y0: 0, x1: 1, y1: 1 },
      ceiling: { x0: 0, y0: 0, x1: 1, y1: 0.35 },
      floor: { x0: 0, y0: 0.7, x1: 1, y1: 1 },
    };
    const d = defaults[category];
    commit((s) => ({
      ...s,
      surfaces: s.surfaces.map((sf) =>
        sf.id === selectedId ? { ...sf, points: rectPoints(d.x0, d.y0, d.x1, d.y1) } : sf,
      ),
    }));
    onToast('Mask reset to its default rectangle.');
  };

  const removeSelectedPoint = () => {
    if (!selectedPoint) return;
    const { surfaceId, index } = selectedPoint;
    commit((s) => ({
      ...s,
      surfaces: s.surfaces.map((sf) =>
        sf.id === surfaceId ? { ...sf, points: sf.points.filter((_, i) => i !== index) } : sf,
      ),
    }));
  };

  const handleAiSegmentation = async () => {
    setAiLoading(true);
    try {
      const result = await tryAiSegmentation(originalBlob);
      if (result.available) {
        // Real masks from the server — only reached with genuine data.
        commit((s) => {
          const surfaces = result.masks.map((m, i) =>
            createMask(m.category, m.label, m.points, i),
          );
          return { ...s, surfaces };
        });
        onToast('AI segmentation applied.');
      } else {
        onToast(result.message, 'error');
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <section aria-label="Surfaces" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-charcoal">Surfaces</h3>
        <Button size="sm" variant="outline" onClick={addWall} aria-label="Add a new wall surface">
          <Plus size={14} aria-hidden="true" /> Wall
        </Button>
      </div>

      <ul className="space-y-1.5" role="listbox" aria-label="Surface masks">
        {state.surfaces.map((s) => {
          const active = s.id === selectedId;
          return (
            <li key={s.id}>
              <div
                role="option"
                aria-selected={active}
                tabIndex={0}
                onClick={() => onSelectSurface(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSurface(s.id);
                  }
                }}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-colors',
                  active ? 'border-moss bg-moss/10' : 'border-line bg-white hover:border-moss/50',
                )}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-charcoal truncate">{s.label}</span>
                  <span className="block text-xs text-charcoal-soft capitalize">
                    {s.category} · {s.points.length} points
                  </span>
                </span>
                {state.surfaces.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(s.id);
                    }}
                    aria-label={`Delete ${s.label}`}
                    className="p-1.5 rounded-lg text-charcoal-soft hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-line bg-white p-3 space-y-2">
        <p className="text-xs font-medium text-charcoal-soft">Mask editing</p>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Mask edit mode">
          <ModeButton active={mode === 'select'} onClick={() => onModeChange('select')} icon={<MousePointer2 size={14} />} label="Select" hint="Click a surface to select it. Drag points to reshape." />
          <ModeButton active={mode === 'add'} onClick={() => onModeChange('add')} icon={<Plus size={14} />} label="Add point" hint="Click on the canvas to add a point to the selected surface." />
          <ModeButton active={mode === 'rect'} onClick={() => onModeChange('rect')} icon={<SquareDashed size={14} />} label="Rectangle" hint="Drag on the canvas to draw a rectangle for the selected surface." />
        </div>
        <p className="text-xs text-charcoal-soft">
          {mode === 'select' && 'Drag a point to move it. Right-click a point (or select it and press Delete) to remove it.'}
          {mode === 'add' && 'Click anywhere on the image to add a corner point to the selected surface.'}
          {mode === 'rect' && 'Drag across the image to replace the selected surface with a rectangle.'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={removeSelectedPoint}
            disabled={!selectedPoint}
            aria-label="Remove the selected mask point"
          >
            <Eraser size={14} aria-hidden="true" /> Remove point
          </Button>
          {selected && (
            <Button size="sm" variant="ghost" onClick={() => resetMask(selected.category)} aria-label={`Reset ${selected.label} mask`}>
              <RotateCcw size={14} aria-hidden="true" /> Reset mask
            </Button>
          )}
        </div>
      </div>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => void handleAiSegmentation()}
        disabled={aiLoading}
        aria-label="Try AI segmentation"
      >
        {aiLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
        {aiLoading ? 'Contacting server…' : 'Try AI segmentation'}
      </Button>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && deleteSurface(confirmDeleteId)}
        title="Delete surface?"
        message={`Delete "${state.surfaces.find((s) => s.id === confirmDeleteId)?.label ?? 'surface'}"? Its mask and material will be removed. This can be undone.`}
        confirmLabel="Delete"
        destructive
      />
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={cn(
        'inline-flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
        active ? 'border-moss bg-moss text-white' : 'border-line bg-sand text-charcoal hover:border-moss/60',
      )}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}
