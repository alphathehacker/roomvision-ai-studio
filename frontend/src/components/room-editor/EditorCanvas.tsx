import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorState, NormPoint } from '../../types';
import { renderEditor } from '../../services/renderer';
import { pointInPolygon } from '../../services/masks';
import { clamp } from '../../utils/common';

export type CanvasMode = 'select' | 'add' | 'rect';

interface EditorCanvasProps {
  original: ImageBitmap;
  state: EditorState;
  selectedId: string | null;
  onSelectSurface: (id: string | null) => void;
  mode: CanvasMode;
  glowPlacing: boolean;
  onPlaceGlow: (p: NormPoint) => void;
  /** commit: new history entry (force pushes even if unchanged) */
  commit: (updater: (s: EditorState) => EditorState, force?: boolean) => void;
  /** replace: transient update, no history entry */
  replace: (updater: (s: EditorState) => EditorState) => void;
  selectedPoint: { surfaceId: string; index: number } | null;
  onSelectPoint: (p: { surfaceId: string; index: number } | null) => void;
  zoom: number;
  onRendered: (canvas: HTMLCanvasElement) => void;
  onRenderError: (message: string) => void;
}

function toNorm(e: { clientX: number; clientY: number }, rect: DOMRect): NormPoint {
  return {
    x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
  };
}

export function EditorCanvas({
  original,
  state,
  selectedId,
  onSelectSurface,
  mode,
  glowPlacing,
  onPlaceGlow,
  commit,
  replace,
  selectedPoint,
  onSelectPoint,
  zoom,
  onRendered,
  onRenderError,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ surfaceId: string; index: number } | null>(null);
  const rectRef = useRef<{ start: NormPoint } | null>(null);
  const [rectDraft, setRectDraft] = useState<NormPoint[] | null>(null);
  const renderedRef = useRef(onRendered);
  const errorRef = useRef(onRenderError);
  renderedRef.current = onRendered;
  errorRef.current = onRenderError;

  // Render the edited image whenever inputs change.
  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      try {
        const out = renderEditor(original, state);
        if (cancelled) return;
        const el = canvasRef.current;
        if (el) {
          el.width = out.width;
          el.height = out.height;
          const ctx = el.getContext('2d');
          ctx?.drawImage(out, 0, 0);
        }
        renderedRef.current(out);
      } catch (err) {
        if (!cancelled) errorRef.current(err instanceof Error ? err.message : 'Render failed.');
      }
    }, 60); // light debounce so slider drags stay smooth
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [original, state]);

  const selectedSurface = state.surfaces.find((s) => s.id === selectedId) ?? null;

  const handleOverlayPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const svg = overlayRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const p = toNorm(e, rect);

      if (glowPlacing) {
        onPlaceGlow(p);
        return;
      }

      if (mode === 'add' && selectedSurface) {
        e.preventDefault();
        const pts = [...selectedSurface.points, p];
        const id = selectedSurface.id;
        commit((s) => ({
          ...s,
          surfaces: s.surfaces.map((sf) => (sf.id === id ? { ...sf, points: pts } : sf)),
        }));
        onSelectPoint({ surfaceId: id, index: pts.length - 1 });
        return;
      }

      if (mode === 'rect') {
        e.preventDefault();
        rectRef.current = { start: p };
        (e.target as Element).setPointerCapture?.(e.pointerId);
        return;
      }

      // select mode: pick the topmost surface containing the point
      const hit = [...state.surfaces]
        .reverse()
        .find((s) => s.points.length >= 3 && pointInPolygon(p, s.points));
      onSelectSurface(hit ? hit.id : null);
      onSelectPoint(null);
    },
    [glowPlacing, mode, onPlaceGlow, selectedSurface, commit, onSelectPoint, onSelectSurface, state.surfaces],
  );

  const handleOverlayPointerMove = useCallback(
    (e: React.PointerEvent) => {
      // point dragging (transient)
      if (dragRef.current) {
        const svg = overlayRef.current;
        if (!svg) return;
        const p = toNorm(e, svg.getBoundingClientRect());
        const { surfaceId, index } = dragRef.current;
        replace((s) => ({
          ...s,
          surfaces: s.surfaces.map((sf) =>
            sf.id === surfaceId
              ? { ...sf, points: sf.points.map((pt, i) => (i === index ? p : pt)) }
              : sf,
          ),
        }));
        return;
      }
      // rectangle draft
      if (rectRef.current && mode === 'rect') {
        const svg = overlayRef.current;
        if (!svg) return;
        const p = toNorm(e, svg.getBoundingClientRect());
        const s0 = rectRef.current.start;
        setRectDraft([
          { x: Math.min(s0.x, p.x), y: Math.min(s0.y, p.y) },
          { x: Math.max(s0.x, p.x), y: Math.min(s0.y, p.y) },
          { x: Math.max(s0.x, p.x), y: Math.max(s0.y, p.y) },
          { x: Math.min(s0.x, p.x), y: Math.max(s0.y, p.y) },
        ]);
      }
    },
    [mode, replace],
  );

  const handleOverlayPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current) {
        // commit the drag as one history entry
        commit((s) => s, true);
        dragRef.current = null;
        return;
      }
      if (rectRef.current && rectDraft && selectedSurface) {
        const pts = rectDraft;
        const id = selectedSurface.id;
        commit((s) => ({
          ...s,
          surfaces: s.surfaces.map((sf) => (sf.id === id ? { ...sf, points: pts } : sf)),
        }));
      }
      rectRef.current = null;
      setRectDraft(null);
      void e;
    },
    [rectDraft, selectedSurface, commit],
  );

  const handlePointPointerDown = useCallback(
    (e: React.PointerEvent, surfaceId: string, index: number) => {
      if (glowPlacing || mode !== 'select') return;
      e.stopPropagation();
      e.preventDefault();
      onSelectSurface(surfaceId);
      onSelectPoint({ surfaceId, index });
      dragRef.current = { surfaceId, index };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [glowPlacing, mode, onSelectSurface, onSelectPoint],
  );

  const handlePointContextMenu = useCallback(
    (e: React.MouseEvent, surfaceId: string, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      const id = surfaceId;
      commit((s) => ({
        ...s,
        surfaces: s.surfaces.map((sf) =>
          sf.id === id ? { ...sf, points: sf.points.filter((_, i) => i !== index) } : sf,
        ),
      }));
      onSelectPoint(null);
    },
    [commit, onSelectPoint],
  );

  // Delete key removes the selected point.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPoint) {
        e.preventDefault();
        const { surfaceId, index } = selectedPoint;
        commit((s) => ({
          ...s,
          surfaces: s.surfaces.map((sf) =>
            sf.id === surfaceId ? { ...sf, points: sf.points.filter((_, i) => i !== index) } : sf,
          ),
        }));
        onSelectPoint(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedPoint, commit, onSelectPoint]);

  return (
    <div
      className="relative w-full overflow-auto bg-charcoal/90 rounded-2xl border border-line"
      style={{ maxHeight: '70vh' }}
      aria-label="Room editor canvas area"
    >
      <div className="relative mx-auto" style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}>
        <canvas ref={canvasRef} className="block w-full h-auto select-none" aria-label="Edited room preview" />
        <svg
          ref={overlayRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={`absolute inset-0 w-full h-full ${
            glowPlacing ? 'cursor-crosshair' : mode === 'add' ? 'cursor-copy' : mode === 'rect' ? 'cursor-crosshair' : 'cursor-default'
          }`}
          onPointerDown={handleOverlayPointerDown}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={handleOverlayPointerUp}
          role="application"
          aria-label={
            glowPlacing
              ? 'Click to place a light glow spot'
              : mode === 'add'
                ? 'Click to add a mask point to the selected surface'
                : mode === 'rect'
                  ? 'Drag to draw a rectangular mask'
                  : 'Click a surface to select it, drag points to reshape'
          }
        >
          {state.surfaces.map((s) => {
            const isSel = s.id === selectedId;
            const pts = s.points.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(' ');
            return (
              <polygon
                key={s.id}
                points={pts}
                fill={s.color}
                fillOpacity={isSel ? 0.28 : 0.14}
                stroke={s.color}
                strokeWidth={isSel ? 0.45 : 0.25}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            );
          })}
          {rectDraft && (
            <polygon
              points={rectDraft.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
              fill="#ffffff"
              fillOpacity={0.25}
              stroke="#ffffff"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
          )}
          {state.surfaces.map((s) =>
            s.points.map((p, i) => {
              const isSelPt =
                selectedPoint?.surfaceId === s.id && selectedPoint.index === i && s.id === selectedId;
              return (
                <circle
                  key={`${s.id}-${i}`}
                  cx={p.x * 100}
                  cy={p.y * 100}
                  r={1.1}
                  fill={isSelPt ? '#ffffff' : s.color}
                  stroke="#ffffff"
                  strokeWidth={0.25}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: mode === 'select' && !glowPlacing ? 'grab' : 'default', pointerEvents: s.id === selectedId ? 'auto' : 'none' }}
                  onPointerDown={(e) => handlePointPointerDown(e, s.id, i)}
                  onContextMenu={(e) => handlePointContextMenu(e, s.id, i)}
                  role="button"
                  aria-label={`Mask point ${i + 1} of ${s.label}. Right-click or press Delete to remove.`}
                  tabIndex={s.id === selectedId ? 0 : -1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectSurface(s.id);
                      onSelectPoint({ surfaceId: s.id, index: i });
                    }
                  }}
                />
              );
            }),
          )}
          {state.lighting.glows.map((g) => (
            <g key={g.id} style={{ pointerEvents: 'none' }}>
              <circle cx={g.x * 100} cy={g.y * 100} r={2.2} fill="rgba(255,240,214,0.35)" />
              <circle cx={g.x * 100} cy={g.y * 100} r={0.9} fill="#ffd98a" stroke="#fff" strokeWidth={0.2} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
