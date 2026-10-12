import { Paintbrush, ArrowUpFromLine, LayoutGrid, Lightbulb } from 'lucide-react';
import { cn } from '../ui/utils';

export type EditorCategory = 'walls' | 'ceiling' | 'flooring' | 'lighting';

export const CATEGORIES: { value: EditorCategory; label: string; icon: React.ReactNode; hint: string }[] = [
  { value: 'walls', label: 'Walls', icon: <Paintbrush size={18} aria-hidden="true" />, hint: 'Paint, wallpaper, wood, stone and more' },
  { value: 'ceiling', label: 'Ceiling', icon: <ArrowUpFromLine size={18} aria-hidden="true" />, hint: 'Paint, panels and height preview' },
  { value: 'flooring', label: 'Flooring', icon: <LayoutGrid size={18} aria-hidden="true" />, hint: 'Tiles, wood, laminate, stone' },
  { value: 'lighting', label: 'Lighting', icon: <Lightbulb size={18} aria-hidden="true" />, hint: 'Color temperature and glow spots' },
];

export function LeftSidebar({
  category,
  onSelect,
  className,
}: {
  category: EditorCategory;
  onSelect: (c: EditorCategory) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Design categories" className={cn('space-y-1', className)}>
      {CATEGORIES.map((c) => {
        const active = c.value === category;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onSelect(c.value)}
            aria-pressed={active}
            title={c.hint}
            className={cn(
              'w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors',
              active
                ? 'bg-moss text-white shadow-sm'
                : 'text-charcoal hover:bg-sand border border-transparent hover:border-line',
            )}
          >
            <span aria-hidden="true" className={active ? 'text-white' : 'text-bronze'}>
              {c.icon}
            </span>
            <span>
              <span className="block text-sm font-semibold">{c.label}</span>
              <span className={cn('block text-xs', active ? 'text-white/80' : 'text-charcoal-soft')}>{c.hint}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
