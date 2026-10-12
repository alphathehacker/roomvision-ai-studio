import type { InputHTMLAttributes } from 'react';
import { cn } from './utils';

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

export function Slider({ label, value, min, max, step = 1, format, onChange, className, ...rest }: SliderProps) {
  const id = rest.id ?? `slider-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={id} className="text-xs font-medium text-charcoal-soft">
          {label}
        </label>
        <span className="text-xs tabular-nums text-charcoal bg-sand rounded-md px-1.5 py-0.5" aria-live="polite">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="rv-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={format ? format(value) : String(value)}
        {...rest}
      />
    </div>
  );
}
