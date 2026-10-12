import { useEffect, useRef, useState } from 'react';
import { X, Columns2, ArrowLeftRight, MoveHorizontal, RotateCcw } from 'lucide-react';
import { Dialog, ConfirmDialog } from '../ui/dialog';
import { Tabs } from '../ui/tabs';
import { Button } from '../ui/button';
import { renderOriginal } from '../../services/renderer';
import { cn } from '../ui/utils';

type CompareMode = 'toggle' | 'split' | 'slider';

interface CompareViewProps {
  open: boolean;
  onClose: () => void;
  original: ImageBitmap;
  /** most recently rendered edited canvas */
  edited: HTMLCanvasElement | null;
  onResetAll: () => void;
}

/**
 * Before/after comparison using REAL data: the original bitmap and the
 * re-rendered edited canvas. Three modes: toggle, side-by-side, slider.
 */
export function CompareView({ open, onClose, original, edited, onResetAll }: CompareViewProps) {
  const [mode, setMode] = useState<CompareMode>('slider');
  const [showOriginal, setShowOriginal] = useState(false);
  const [divider, setDivider] = useState(50);
  const [confirmReset, setConfirmReset] = useState(false);
  const originalRef = useRef<HTMLCanvasElement>(null);
  const editedRef = useRef<HTMLCanvasElement>(null);
  const editedSplitRef = useRef<HTMLCanvasElement>(null);
  const originalSliderRef = useRef<HTMLCanvasElement>(null);
  const editedSliderRef = useRef<HTMLCanvasElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  // Paint the source canvases into the visible <canvas> elements.
  useEffect(() => {
    if (!open) return;
    let originalCanvas: HTMLCanvasElement;
    try {
      originalCanvas = renderOriginal(original);
    } catch {
      return;
    }
    const targets = [originalRef, editedRef, editedSplitRef, originalSliderRef, editedSliderRef];
    for (const r of targets) {
      const el = r.current;
      if (!el) continue;
      const isEdited = r === editedRef || r === editedSplitRef || r === editedSliderRef;
      const src = isEdited ? edited : originalCanvas;
      if (!src) continue;
      el.width = src.width;
      el.height = src.height;
      el.getContext('2d')?.drawImage(src, 0, 0);
    }
  }, [open, original, edited, mode, showOriginal]);

  const moveDivider = (clientX: number) => {
    const bar = dividerRef.current?.parentElement;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setDivider(Math.min(98, Math.max(2, pct)));
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Compare before & after" className="sm:max-w-4xl" description="Original photo vs. your edited design — rendered live from your actual edits.">
        <Tabs<CompareMode>
          ariaLabel="Comparison mode"
          value={mode}
          onChange={setMode}
          tabs={[
            { value: 'toggle', label: 'Toggle', icon: <ArrowLeftRight size={14} aria-hidden="true" /> },
            { value: 'split', label: 'Side by side', icon: <Columns2 size={14} aria-hidden="true" /> },
            { value: 'slider', label: 'Slider', icon: <MoveHorizontal size={14} aria-hidden="true" /> },
          ]}
        />

        <div className="mt-4">
          {mode === 'toggle' && (
            <div className="space-y-3">
              <div className="rounded-2xl overflow-hidden bg-charcoal border border-line">
                <canvas
                  ref={originalRef}
                  className={cn('w-full h-auto block', showOriginal ? '' : 'hidden')}
                  aria-label="Original photo"
                />
                <canvas ref={editedRef} className={cn('w-full h-auto block', showOriginal ? 'hidden' : '')} aria-label="Edited design" />
              </div>
              <div className="flex items-center gap-2">
                <Button variant={showOriginal ? 'secondary' : 'primary'} onClick={() => setShowOriginal(false)}>
                  Edited
                </Button>
                <Button variant={showOriginal ? 'primary' : 'secondary'} onClick={() => setShowOriginal(true)}>
                  Original
                </Button>
              </div>
            </div>
          )}

          {mode === 'split' && (
            <div className="grid grid-cols-2 gap-2">
              <figure className="rounded-2xl overflow-hidden bg-charcoal border border-line">
                <canvas ref={originalRef} className="w-full h-auto block" aria-label="Original photo" />
                <figcaption className="text-xs text-center py-1.5 bg-sand text-charcoal-soft">Original</figcaption>
              </figure>
              <figure className="rounded-2xl overflow-hidden bg-charcoal border border-line">
                <canvas ref={editedSplitRef} className="w-full h-auto block" aria-label="Edited design" />
                <figcaption className="text-xs text-center py-1.5 bg-sand text-charcoal-soft">Edited</figcaption>
              </figure>
            </div>
          )}

          {mode === 'slider' && (
            <div
              ref={dividerRef}
              className="relative rounded-2xl overflow-hidden bg-charcoal border border-line select-none"
              role="slider"
              aria-label="Before-after divider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(divider)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setDivider((d) => Math.max(2, d - 2));
                if (e.key === 'ArrowRight') setDivider((d) => Math.min(98, d + 2));
              }}
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                moveDivider(e.clientX);
                const move = (ev: PointerEvent) => moveDivider(ev.clientX);
                const up = () => {
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
              }}
            >
              <canvas ref={originalSliderRef} className="w-full h-auto block" aria-label="Original photo" />
              <div
                className="absolute inset-0"
                style={{ clipPath: `inset(0 0 0 ${divider}%)` }}
                aria-hidden="true"
              >
                <canvas ref={editedSliderRef} className="w-full h-auto block" />
              </div>
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
                style={{ left: `calc(${divider}% - 2px)` }}
                aria-hidden="true"
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center">
                  <MoveHorizontal size={16} className="text-charcoal" aria-hidden="true" />
                </div>
              </div>
              <span className="absolute top-2 left-2 text-[11px] font-medium bg-charcoal/70 text-cream px-2 py-0.5 rounded-full">Original</span>
              <span className="absolute top-2 right-2 text-[11px] font-medium bg-charcoal/70 text-cream px-2 py-0.5 rounded-full">Edited</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-between gap-2 mt-5">
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} aria-hidden="true" /> Reset to original
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            <X size={14} aria-hidden="true" /> Close
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          onResetAll();
          onClose();
        }}
        title="Reset all edits?"
        message="This clears every material, mask, lighting and ceiling change and restores the original photo. This can be undone."
        confirmLabel="Reset everything"
        destructive
      />
    </>
  );
}
