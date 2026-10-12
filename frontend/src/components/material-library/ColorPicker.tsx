import { PRESET_SWATCHES } from '../../services/materials';
import { cn } from '../ui/utils';

export function ColorPicker({
  value,
  onChange,
  label = 'Color',
}: {
  value: string;
  onChange: (c: string) => void;
  label?: string;
}) {
  const id = `color-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label htmlFor={id} className="text-xs font-medium text-charcoal-soft">
          {label}
        </label>
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-line cursor-pointer bg-white p-0.5"
          aria-label={`${label} picker`}
        />
        <span className="text-xs tabular-nums text-charcoal bg-sand rounded-md px-1.5 py-0.5 uppercase" aria-live="polite">
          {value}
        </span>
      </div>
      <div className="grid grid-cols-8 gap-1.5" role="group" aria-label={`${label} presets`}>
        {PRESET_SWATCHES.map((sw) => (
          <button
            key={sw}
            type="button"
            onClick={() => onChange(sw)}
            title={sw}
            aria-label={`Use color ${sw}`}
            aria-pressed={sw.toLowerCase() === value.toLowerCase()}
            className={cn(
              'aspect-square rounded-lg border transition-transform hover:scale-105',
              sw.toLowerCase() === value.toLowerCase()
                ? 'border-moss ring-2 ring-moss/50'
                : 'border-black/10',
            )}
            style={{ backgroundColor: sw }}
          />
        ))}
      </div>
    </div>
  );
}
