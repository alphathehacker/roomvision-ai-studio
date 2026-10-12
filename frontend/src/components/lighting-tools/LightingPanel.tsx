import { useState } from 'react';
import { Lightbulb, Sun, MoonStar, Trash2, MapPin, Info } from 'lucide-react';
import type { EditorState, LightingPreset } from '../../types';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { cn } from '../ui/utils';

const PRESETS: { value: LightingPreset; label: string; temp: number; icon: React.ReactNode }[] = [
  { value: 'warm', label: 'Warm', temp: 3000, icon: <Sun size={14} aria-hidden="true" /> },
  { value: 'neutral', label: 'Neutral', temp: 4500, icon: <Lightbulb size={14} aria-hidden="true" /> },
  { value: 'cool', label: 'Cool', temp: 6200, icon: <MoonStar size={14} aria-hidden="true" /> },
];

const MAX_GLOWS = 8;

export function LightingPanel({
  state,
  commit,
  glowPlacing,
  onToggleGlowPlacement,
  onToast,
}: {
  state: EditorState;
  commit: (updater: (s: EditorState) => EditorState) => void;
  glowPlacing: boolean;
  onToggleGlowPlacement: () => void;
  onToast: (message: string, kind?: 'info' | 'error') => void;
}) {
  const lighting = state.lighting;
  const [localTemp, setLocalTemp] = useState(lighting.temperature);

  const setLighting = (patch: Partial<typeof lighting>) =>
    commit((s) => ({ ...s, lighting: { ...s.lighting, ...patch } }));

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setLighting({ preset: p.value, temperature: p.temp });
    setLocalTemp(p.temp);
    onToast(`${p.label} lighting applied.`);
  };

  const removeGlow = (id: string) => {
    commit((s) => ({ ...s, lighting: { ...s.lighting, glows: s.lighting.glows.filter((g) => g.id !== id) } }));
  };

  const resetLighting = () => {
    setLighting({ preset: 'neutral', temperature: 4500, intensity: 0.25, glows: [] });
    setLocalTemp(4500);
    onToast('Lighting reset.');
  };

  return (
    <section aria-label="Lighting" className="space-y-4">
      <div>
        <h4 className="text-xs font-medium text-charcoal-soft mb-2">Preset</h4>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Lighting presets">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => applyPreset(p)}
              aria-pressed={lighting.preset === p.value}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors',
                lighting.preset === p.value
                  ? 'border-bronze bg-bronze text-white'
                  : 'border-line bg-white text-charcoal hover:border-bronze/60',
              )}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Slider
        label="Color temperature"
        value={localTemp}
        min={2700}
        max={6500}
        step={50}
        format={(v) => `${Math.round(v)} K`}
        onChange={(v) => {
          setLocalTemp(v);
          setLighting({ temperature: v, preset: v < 3750 ? 'warm' : v > 5250 ? 'cool' : 'neutral' });
        }}
      />
      <Slider
        label="Intensity"
        value={lighting.intensity}
        min={0}
        max={1}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => setLighting({ intensity: v })}
      />

      <div className="rounded-xl border border-line bg-white p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-charcoal-soft">
            Glow spots ({lighting.glows.length}/{MAX_GLOWS})
          </h4>
          <Button
            size="sm"
            variant={glowPlacing ? 'primary' : 'outline'}
            onClick={onToggleGlowPlacement}
            aria-pressed={glowPlacing}
            aria-label={glowPlacing ? 'Cancel glow placement' : 'Add a glow spot'}
          >
            <MapPin size={14} aria-hidden="true" /> {glowPlacing ? 'Placing… click image' : 'Add glow'}
          </Button>
        </div>
        {glowPlacing && (
          <p className="text-xs text-bronze-deep">Click anywhere on the room photo to place a glow spot.</p>
        )}
        {lighting.glows.length === 0 && !glowPlacing && (
          <p className="text-xs text-charcoal-soft">No glow spots yet. Add one to simulate a lamp or window glow.</p>
        )}
        <ul className="space-y-2">
          {lighting.glows.map((g, i) => (
            <li key={g.id} className="rounded-lg bg-sand/60 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-charcoal">Spot {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeGlow(g.id)}
                  aria-label={`Remove glow spot ${i + 1}`}
                  className="p-1 rounded-lg text-charcoal-soft hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
              <Slider
                label={`Spot ${i + 1} intensity`}
                value={g.intensity}
                min={0}
                max={1}
                step={0.01}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) =>
                  commit((s) => ({
                    ...s,
                    lighting: {
                      ...s.lighting,
                      glows: s.lighting.glows.map((gg) => (gg.id === g.id ? { ...gg, intensity: v } : gg)),
                    },
                  }))
                }
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-sand p-3 text-xs text-charcoal-soft">
        <Info size={14} className="mt-0.5 shrink-0 text-bronze" aria-hidden="true" />
        <p>Simplified lighting preview — not photorealistic light simulation.</p>
      </div>

      <Button variant="ghost" className="w-full" onClick={resetLighting}>
        Reset lighting
      </Button>
    </section>
  );
}
