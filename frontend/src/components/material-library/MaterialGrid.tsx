import { useEffect, useRef, useState } from 'react';
import type { MaterialDef } from '../../types';
import { generateTexture } from '../../services/textures';
import { cn } from '../ui/utils';

/**
 * Material picker grid. Thumbnails are rendered lazily from the procedural
 * texture generators via IntersectionObserver — nothing renders until visible.
 */
export function MaterialGrid({
  materials,
  selectedId,
  onSelect,
  tintColor,
}: {
  materials: MaterialDef[];
  selectedId: string;
  onSelect: (m: MaterialDef) => void;
  tintColor: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="listbox" aria-label="Materials">
      {materials.map((m) => (
        <MaterialThumb
          key={m.id}
          material={m}
          tintColor={tintColor}
          selected={m.id === selectedId}
          onSelect={() => onSelect(m)}
        />
      ))}
    </div>
  );
}

function MaterialThumb({
  material,
  tintColor,
  selected,
  onSelect,
}: {
  material: MaterialDef;
  tintColor: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || rendered) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            const canvas = canvasRef.current;
            if (canvas) {
              try {
                const { canvas: tile } = generateTexture(material.kind, tintColor, {
                  pattern: material.pattern,
                });
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(tile, 0, 0, canvas.width, canvas.height);
              } catch {
                /* thumbnail failure is non-fatal */
              }
            }
            setRendered(true);
          }
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rendered, material, tintColor]);

  // Re-tint the thumbnail when the chosen color changes (after first render).
  useEffect(() => {
    if (!rendered) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const { canvas: tile } = generateTexture(material.kind, tintColor, { pattern: material.pattern });
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(tile, 0, 0, canvas.width, canvas.height);
    } catch {
      /* non-fatal */
    }
  }, [rendered, tintColor, material]);

  return (
    <div ref={wrapRef}>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        title={`${material.name} — ${material.description}`}
        className={cn(
          'w-full rounded-xl border overflow-hidden transition-all bg-white',
          selected ? 'border-moss ring-2 ring-moss/40' : 'border-line hover:border-moss/60',
        )}
      >
        <canvas ref={canvasRef} width={96} height={64} className="w-full h-14 block" aria-hidden="true" />
        <span className="block px-1 py-1 text-[11px] font-medium text-charcoal leading-tight truncate">
          {material.name}
        </span>
      </button>
    </div>
  );
}
