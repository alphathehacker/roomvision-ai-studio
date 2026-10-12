import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Save, Download, GitCompareArrows,
  SlidersHorizontal, X, AlertCircle, RotateCcw, FileImage,
} from 'lucide-react';
import type { EditorState, NormPoint } from '../types';
import { useHistory } from '../hooks/useHistory';
import { createInitialState, normalizeState } from '../services/editorState';
import { bitmapToBlob } from '../utils/image';
import { downloadUrl, uuid, clamp } from '../utils/common';
import { EditorCanvas, type CanvasMode } from '../components/room-editor/EditorCanvas';
import { LeftSidebar, type EditorCategory } from '../components/layout/LeftSidebar';
import { RightPanel } from '../components/layout/RightPanel';
import { CompareView } from '../components/comparison/CompareView';
import { SaveDialog } from '../components/project-library/SaveDialog';
import { ConfirmDialog } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Tooltip } from '../components/ui/tooltip';

export interface EditorSession {
  bitmap: ImageBitmap;
  blob: Blob;
  projectId: string | null;
  projectName: string;
  initialState?: EditorState;
}

interface EditorProps {
  session: EditorSession;
  onExit: () => void;
  onSaved: (projectId: string, name: string) => void;
  onToast: (message: string, kind?: 'info' | 'error') => void;
}

const MAX_GLOWS = 8;

export function Editor({ session, onExit, onSaved, onToast }: EditorProps) {
  const initial = useRef<EditorState>(
    session.initialState ? normalizeState(session.initialState) : createInitialState(),
  );
  const history = useHistory<EditorState>(initial.current);
  const { state } = history;

  const [category, setCategory] = useState<EditorCategory>('walls');
  const [selectedId, setSelectedId] = useState<string | null>(
    () => state.surfaces.find((s) => s.category === 'wall')?.id ?? state.surfaces[0]?.id ?? null,
  );
  const [mode, setMode] = useState<CanvasMode>('select');
  const [selectedPoint, setSelectedPoint] = useState<{ surfaceId: string; index: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [glowPlacing, setGlowPlacing] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile left drawer
  const [sheetOpen, setSheetOpen] = useState(false); // mobile bottom sheet
  const [renderError, setRenderError] = useState<string | null>(null);

  const editedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const pushToast = onToast;

  const commit = useCallback(
    (updater: (s: EditorState) => EditorState, force = false) => {
      const next = updater(stateRef.current);
      if (force) {
        // Force a history entry even when the snapshot is unchanged (e.g. drag end).
        history.push({ ...next, surfaces: [...next.surfaces] }, true);
      } else {
        history.push(next);
      }
    },
    [history],
  );

  const replace = useCallback(
    (updater: (s: EditorState) => EditorState) => {
      history.replace(updater(stateRef.current));
    },
    [history],
  );

  // Keyboard shortcuts: undo / redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if ((e.key.toLowerCase() === 'y') || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
        e.preventDefault();
        history.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [history]);

  // Mobile hamburger in the TopNav opens the category drawer.
  useEffect(() => {
    const open = () => setDrawerOpen(true);
    window.addEventListener('rv:open-menu', open);
    return () => window.removeEventListener('rv:open-menu', open);
  }, []);

  // When the category changes, select the first surface of that kind.
  const handleCategory = useCallback(
    (c: EditorCategory) => {
      setCategory(c);
      setGlowPlacing(false);
      const map: Record<EditorCategory, 'wall' | 'ceiling' | 'floor' | 'wall'> = {
        walls: 'wall',
        ceiling: 'ceiling',
        flooring: 'floor',
        lighting: 'wall',
      };
      const first = stateRef.current.surfaces.find((s) => s.category === map[c]);
      setSelectedId(first?.id ?? stateRef.current.surfaces[0]?.id ?? null);
      setDrawerOpen(false);
    },
    [],
  );

  // Close export menu on outside click.
  useEffect(() => {
    if (!exportMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [exportMenuOpen]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void centerRef.current?.requestFullscreen?.();
    }
  };

  const placeGlow = useCallback(
    (p: NormPoint) => {
      const glows = stateRef.current.lighting.glows;
      if (glows.length >= MAX_GLOWS) {
        pushToast(`You can add up to ${MAX_GLOWS} glow spots.`, 'error');
        setGlowPlacing(false);
        return;
      }
      commit((s) => ({
        ...s,
        lighting: { ...s.lighting, glows: [...s.lighting.glows, { id: uuid(), x: p.x, y: p.y, intensity: 0.7 }] },
      }));
      setGlowPlacing(false);
      pushToast('Glow spot added.');
    },
    [commit, pushToast],
  );

  const resetAll = () => {
    history.reset(createInitialState());
    const s = createInitialState();
    setSelectedId(s.surfaces.find((x) => x.category === 'wall')?.id ?? null);
    setSelectedPoint(null);
    setGlowPlacing(false);
    pushToast('All edits cleared — original photo restored.');
  };

  const exportBlob = async (kind: 'png' | 'jpeg') => {
    const canvas = editedCanvasRef.current;
    if (!canvas) {
      pushToast('Nothing to export yet — the preview is still rendering.', 'error');
      return;
    }
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, kind === 'png' ? 'image/png' : 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('Export failed.');
      const url = URL.createObjectURL(blob);
      downloadUrl(url, `roomvision-design.${kind === 'png' ? 'png' : 'jpg'}`);
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      pushToast(`Exported ${kind === 'png' ? 'PNG' : 'JPEG'} at full resolution.`);
    } catch (err) {
      pushToast(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
    }
    setExportMenuOpen(false);
  };

  const downloadOriginal = async () => {
    try {
      const blob = await bitmapToBlob(session.bitmap, 'image/jpeg', 0.92);
      const url = URL.createObjectURL(blob);
      downloadUrl(url, 'roomvision-original.jpg');
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      pushToast(`Download failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
    }
    setExportMenuOpen(false);
  };

  const rightPanelProps = {
    category,
    state,
    selectedId,
    onSelectSurface: setSelectedId,
    commit,
    mode,
    onModeChange: setMode,
    selectedPoint,
    onSelectPoint: setSelectedPoint,
    glowPlacing,
    onToggleGlowPlacement: () => setGlowPlacing((g) => !g),
    originalBlob: session.blob,
    onToast: pushToast,
  };

  return (
    <div className="flex flex-col h-[calc(100%-4rem)]">
      {/* toolbar */}
      <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2.5 border-b border-line bg-cream flex-wrap">
        <Tooltip label="Undo (Ctrl+Z)">
          <Button size="icon" variant="ghost" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo">
            <Undo2 size={18} aria-hidden="true" />
          </Button>
        </Tooltip>
        <Tooltip label="Redo (Ctrl+Shift+Z)">
          <Button size="icon" variant="ghost" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo">
            <Redo2 size={18} aria-hidden="true" />
          </Button>
        </Tooltip>
        <span className="w-px h-6 bg-line mx-1" aria-hidden="true" />
        <Tooltip label="Zoom out">
          <Button size="icon" variant="ghost" onClick={() => setZoom((z) => clamp(z - 0.25, 0.5, 3))} disabled={zoom <= 0.5} aria-label="Zoom out">
            <ZoomOut size={18} aria-hidden="true" />
          </Button>
        </Tooltip>
        <span className="text-xs tabular-nums text-charcoal-soft w-11 text-center" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <Tooltip label="Zoom in">
          <Button size="icon" variant="ghost" onClick={() => setZoom((z) => clamp(z + 0.25, 0.5, 3))} disabled={zoom >= 3} aria-label="Zoom in">
            <ZoomIn size={18} aria-hidden="true" />
          </Button>
        </Tooltip>
        <Tooltip label="Fullscreen preview">
          <Button size="icon" variant="ghost" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
            <Maximize size={18} aria-hidden="true" />
          </Button>
        </Tooltip>
        <span className="w-px h-6 bg-line mx-1" aria-hidden="true" />
        <Button size="sm" variant="secondary" onClick={() => setCompareOpen(true)}>
          <GitCompareArrows size={15} aria-hidden="true" /> <span className="hidden sm:inline">Compare</span>
        </Button>
        <div className="relative" ref={exportMenuRef}>
          <Button size="sm" variant="secondary" onClick={() => setExportMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={exportMenuOpen}>
            <Download size={15} aria-hidden="true" /> <span className="hidden sm:inline">Export</span>
          </Button>
          {exportMenuOpen && (
            <div role="menu" aria-label="Export options" className="rv-fade-in absolute left-0 mt-2 w-56 rounded-2xl border border-line bg-white shadow-xl p-1.5 z-30">
              <ExportItem label="Export PNG (edited)" hint="Full editor resolution" onClick={() => void exportBlob('png')} />
              <ExportItem label="Export JPEG (edited)" hint="Full editor resolution" onClick={() => void exportBlob('jpeg')} />
              <ExportItem label="Download original" hint="Unedited photo" onClick={() => void downloadOriginal()} />
            </div>
          )}
        </div>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
          <RotateCcw size={15} aria-hidden="true" /> <span className="hidden sm:inline">Reset</span>
        </Button>
        <Button size="sm" variant="primary" onClick={() => setSaveOpen(true)}>
          <Save size={15} aria-hidden="true" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmExit(true)} aria-label="Leave editor">
          <X size={16} aria-hidden="true" />
        </Button>
      </div>

      {renderError && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700 flex items-center gap-2" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          Preview render failed: {renderError}
          <button type="button" className="ml-auto underline" onClick={() => setRenderError(null)}>Dismiss</button>
        </div>
      )}

      {/* main area */}
      <div className="flex-1 flex min-h-0">
        {/* left sidebar (desktop) */}
        <aside className="hidden lg:block w-60 shrink-0 border-r border-line bg-cream p-4 overflow-y-auto">
          <LeftSidebar category={category} onSelect={handleCategory} />
          <div className="mt-6 rounded-2xl bg-sand/70 border border-line p-3 text-xs text-charcoal-soft">
            <p className="font-medium text-charcoal mb-1">Tip</p>
            <p>Select Walls, Ceiling or Flooring, pick a surface, then choose a material on the right.</p>
          </div>
        </aside>

        {/* canvas column */}
        <div ref={centerRef} className="flex-1 min-w-0 bg-[#ece5d5] p-3 sm:p-5 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            <EditorCanvas
              original={session.bitmap}
              state={state}
              selectedId={selectedId}
              onSelectSurface={setSelectedId}
              mode={mode}
              glowPlacing={glowPlacing}
              onPlaceGlow={placeGlow}
              commit={commit}
              replace={replace}
              selectedPoint={selectedPoint}
              onSelectPoint={setSelectedPoint}
              zoom={zoom}
              onRendered={(c) => {
                editedCanvasRef.current = c;
              }}
              onRenderError={setRenderError}
            />
            <p className="text-xs text-charcoal-soft mt-2 text-center">
              {glowPlacing
                ? 'Glow placement active — click the photo to place a glow spot.'
                : mode === 'add'
                  ? 'Add-point mode — click the photo to add a corner to the selected surface.'
                  : mode === 'rect'
                    ? 'Rectangle mode — drag on the photo to re-draw the selected surface.'
                    : 'Click a colored region to select its surface. Drag its points to reshape the mask.'}
            </p>
          </div>
        </div>

        {/* right panel (desktop) */}
        <aside className="hidden lg:block w-80 shrink-0 border-l border-line bg-cream p-4 overflow-y-auto">
          <RightPanel {...rightPanelProps} />
        </aside>
      </div>

      {/* mobile: tools button opens the bottom sheet */}
      <div className="lg:hidden fixed bottom-5 right-5 z-30">
        <Button
          variant="primary"
          size="lg"
          className="rounded-full shadow-xl"
          onClick={() => setSheetOpen(true)}
          aria-label="Open design tools"
        >
          <SlidersHorizontal size={20} aria-hidden="true" /> Tools
        </Button>
      </div>

      {/* mobile left drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Design categories">
          <div className="absolute inset-0 bg-charcoal/45" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="rv-fade-in absolute left-0 top-0 bottom-0 w-72 bg-cream border-r border-line p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-charcoal">Design</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="p-2 rounded-xl hover:bg-sand">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <LeftSidebar category={category} onSelect={handleCategory} />
          </div>
        </div>
      )}

      {/* mobile bottom sheet */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Design tools">
          <div className="absolute inset-0 bg-charcoal/45" onClick={() => setSheetOpen(false)} aria-hidden="true" />
          <div className="rv-fade-in absolute left-0 right-0 bottom-0 max-h-[85vh] bg-cream rounded-t-3xl border-t border-line overflow-y-auto">
            <div className="sticky top-0 bg-cream/95 backdrop-blur px-4 pt-3 pb-2 border-b border-line flex items-center justify-between">
              <h2 className="font-semibold text-charcoal">Design tools</h2>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close tools" className="p-2 rounded-xl hover:bg-sand">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="px-2 py-1 border-b border-line">
              <LeftSidebar category={category} onSelect={handleCategory} className="flex flex-row gap-1 overflow-x-auto p-2" />
            </div>
            <div className="p-4">
              <RightPanel {...rightPanelProps} />
            </div>
          </div>
        </div>
      )}

      {/* Escape closes drawers/sheets */}
      <EscapeCloser onEscape={() => { setDrawerOpen(false); setSheetOpen(false); setExportMenuOpen(false); }} />

      <CompareView
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        original={session.bitmap}
        edited={editedCanvasRef.current}
        onResetAll={resetAll}
      />

      <SaveDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        original={session.bitmap}
        originalBlob={session.blob}
        editState={state}
        projectId={session.projectId}
        defaultName={session.projectName}
        onSaved={(id, name) => {
          onSaved(id, name);
          pushToast(`Saved "${name}".`);
        }}
        onError={(msg) => pushToast(msg, 'error')}
      />

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetAll}
        title="Reset all edits?"
        message="This clears every material, mask, lighting and ceiling change and restores the original photo. This can be undone."
        confirmLabel="Reset everything"
        destructive
      />
      <ConfirmDialog
        open={confirmExit}
        onClose={() => setConfirmExit(false)}
        onConfirm={onExit}
        title="Leave the editor?"
        message="Unsaved changes will be lost unless you saved this design. Leave anyway?"
        confirmLabel="Leave editor"
      />
    </div>
  );
}

function EscapeCloser({ onEscape }: { onEscape: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEscape]);
  return null;
}

function ExportItem({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-sand transition-colors"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-charcoal">
        <FileImage size={15} className="text-bronze" aria-hidden="true" /> {label}
      </span>
      <span className="block text-xs text-charcoal-soft ml-7">{hint}</span>
    </button>
  );
}
