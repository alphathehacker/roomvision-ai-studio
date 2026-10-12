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
  /** ceiling-studio spotlight placement: click the canvas to add a spotlight */
  spotPlacing?: boolean;
  onPlaceSpot?: (p: NormPoint) => void;
  /** ceiling-studio preserve-zone placement: drag a rectangle on the canvas */
  preservePlacing?: boolean;
  onPlacePreserveRect?: (r: { x0: number; y0: number; x1: number; y1: number }) => void;
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
  spotPlacing = false,
  onPlaceSpot,
  preservePlacing = false,
  onPlacePreserveRect,
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
  const preserveRef = useRef<{ start: NormPoint } | null>(null);
  const [preserveDraft, setPreserveDraft] = useState<NormPoint[] | null>(null);
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

      // Placement modes take precedence over mask editing while active.
      if (spotPlacing) {
        onPlaceSpot?.(p);
        return;
      }

      if (preservePlacing) {
        e.preventDefault();
        preserveRef.current = { start: p };
        (e.target as Element).setPointerCapture?.(e.pointerId);
        return;
      }

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
    [glowPlacing, mode, onPlaceGlow, spotPlacing, onPlaceSpot, preservePlacing, selectedSurface, commit, onSelectPoint, onSelectSurface, state.surfaces],
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
      // preserve-zone draft (ceiling studio): live rectangle overlay while dragging
      if (preserveRef.current && preservePlacing) {
        const svg = overlayRef.current;
        if (!svg) return;
        const p = toNorm(e, svg.getBoundingClientRect());
        const s0 = preserveRef.current.start;
        setPreserveDraft([
          { x: Math.min(s0.x, p.x), y: Math.min(s0.y, p.y) },
          { x: Math.max(s0.x, p.x), y: Math.min(s0.y, p.y) },
          { x: Math.max(s0.x, p.x), y: Math.max(s0.y, p.y) },
          { x: Math.min(s0.x, p.x), y: Math.max(s0.y, p.y) },
        ]);
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
    [mode, preservePlacing, replace],
  );

  const handleOverlayPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current) {
        // commit the drag as one history entry
        commit((s) => s, true);
        dragRef.current = null;
        return;
      }
      if (preserveRef.current && preserveDraft) {
        const xs = preserveDraft.map((q) => q.x);
        const ys = preserveDraft.map((q) => q.y);
        const x0 = Math.min(...xs);
        const x1 = Math.max(...xs);
        const y0 = Math.min(...ys);
        const y1 = Math.max(...ys);
        // ignore accidental tiny drags (min 3% of the canvas)
        if (x1 - x0 >= 0.03 && y1 - y0 >= 0.03) {
          onPlacePreserveRect?.({ x0, y0, x1, y1 });
        }
        preserveRef.current = null;
        setPreserveDraft(null);
        return;
      }
      preserveRef.current = null;
      setPreserveDraft(null);
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
    [rectDraft, preserveDraft, selectedSurface, commit, onPlacePreserveRect],
  );

  const handlePointPointerDown = useCallback(
    (e: React.PointerEvent, surfaceId: string, index: number) => {
      if (glowPlacing || spotPlacing || preservePlacing || mode !== 'select') return;
      e.stopPropagation();
      e.preventDefault();
      onSelectSurface(surfaceId);
      onSelectPoint({ surfaceId, index });
      dragRef.current = { surfaceId, index };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [glowPlacing, spotPlacing, preservePlacing, mode, onSelectSurface, onSelectPoint],
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
      {(spotPlacing || preservePlacing) && (
        <div
          className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-full bg-charcoal/85 text-white text-xs px-3 py-1.5 whitespace-nowrap"
          role="status"
        >
          {spotPlacing ? 'Click to place spotlight' : 'Drag a rectangle around the beam or block'}
        </div>
      )}
      <div className="relative mx-auto" style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}>
        <canvas ref={canvasRef} className="block w-full h-auto select-none" aria-label="Edited room preview" />
        <svg
          ref={overlayRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={`absolute inset-0 w-full h-full ${
            spotPlacing || preservePlacing || glowPlacing
              ? 'cursor-crosshair'
              : mode === 'add'
                ? 'cursor-copy'
                : mode === 'rect'
                  ? 'cursor-crosshair'
                  : 'cursor-default'
          }`}
          onPointerDown={handleOverlayPointerDown}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={handleOverlayPointerUp}
          role="application"
          aria-label={
            spotPlacing
              ? 'Click to place a ceiling spotlight'
              : preservePlacing
                ? 'Drag a rectangle to mark a preserve zone'
                : glowPlacing
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
                  style={{ cursor: mode === 'select' && !glowPlacing && !spotPlacing && !preservePlacing ? 'grab' : 'default', pointerEvents: s.id === selectedId ? 'auto' : 'none' }}
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
          {preserveDraft && (
            <polygon
              points={preserveDraft.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
              fill="#7fb069"
              fillOpacity={0.25}
              stroke="#7fb069"
              strokeWidth={0.4}
              strokeDasharray="1.2 0.8"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
          )}
          {(state.ceiling.preserveZones ?? []).map((zone, i) => (
            <polygon
              key={`zone-${i}`}
              points={zone.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
              fill="#7fb069"
              fillOpacity={0.18}
              stroke="#5a8a4d"
              strokeWidth={0.4}
              strokeDasharray="1.2 0.8"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
          ))}
          {(state.ceiling.spotlights ?? []).map((sp) => (
            <g key={sp.id} style={{ pointerEvents: 'none' }}>
              <circle cx={sp.x * 100} cy={sp.y * 100} r={2.4} fill="rgba(255,247,214,0.35)" />
              <circle cx={sp.x * 100} cy={sp.y * 100} r={1} fill="#ffe9a8" stroke="#f5c542" strokeWidth={0.25} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
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
