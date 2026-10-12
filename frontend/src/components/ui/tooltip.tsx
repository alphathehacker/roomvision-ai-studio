import type { ReactNode } from 'react';

/**
 * Minimal accessible tooltip: the trigger keeps its own accessible name via
 * aria-label; the hint appears on hover AND keyboard focus.
 */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="relative inline-flex group/tooltip">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap
          rounded-lg bg-charcoal px-2.5 py-1.5 text-xs text-cream shadow-lg
          opacity-0 translate-y-1 transition-all
          group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0
          group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:translate-y-0"
      >
        {label}
      </span>
    </span>
  );
}
