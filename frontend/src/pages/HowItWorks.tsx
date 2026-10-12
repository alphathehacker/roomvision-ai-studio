import { MousePointer2, Sparkles, ShieldCheck, ServerOff } from 'lucide-react';

export function HowItWorks() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-charcoal">How it works</h1>
      <p className="text-charcoal-soft mt-2">
        An honest overview of what RoomVision AI Studio can do today — and what it can't.
      </p>

      <section className="mt-8 rounded-3xl border border-line bg-white p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-charcoal">
          <MousePointer2 size={20} className="text-moss" aria-hidden="true" /> Manual mode — available now
        </h2>
        <ol className="mt-4 space-y-3 text-sm text-charcoal-soft list-decimal list-inside">
          <li>
            <strong className="text-charcoal">Capture or upload</strong> a photo of your room. It is
            processed entirely in your browser.
          </li>
          <li>
            <strong className="text-charcoal">Outline surfaces</strong> with polygon masks: walls,
            ceiling and floor. Click to add points, drag points to reshape, right-click or press
            Delete to remove a point, or drag a rectangle to re-draw a mask quickly.
          </li>
          <li>
            <strong className="text-charcoal">Apply materials</strong> — paints, wallpapers, wood,
            stone, marble, brick, concrete, tiles, laminate and more. Every texture is generated
            procedurally on a canvas; there are no stock photos and it works offline.
          </li>
          <li>
            <strong className="text-charcoal">Preview lighting</strong> with warm/neutral/cool color
            grades and glow spots, then compare before/after and export a PNG or JPEG.
          </li>
        </ol>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-white p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-charcoal">
          <Sparkles size={20} className="text-bronze" aria-hidden="true" /> AI mode — not available in this build
        </h2>
        <p className="mt-4 text-sm text-charcoal-soft">
          Automatic room segmentation (the app detecting your walls, ceiling and floor for you)
          requires a server-side AI provider. That provider is <strong className="text-charcoal">not
          configured</strong> in this Phase 1 build:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-charcoal-soft list-disc list-inside">
          <li>The <em>Try AI segmentation</em> button contacts your configured backend, if any.</li>
          <li>
            If the server answers 503, is unreachable, or returns no usable masks, the app tells you
            plainly and keeps you in manual mode.
          </li>
          <li>The app never invents or fakes AI results.</li>
        </ul>
        <p className="mt-3 flex items-start gap-2 text-sm text-charcoal-soft bg-sand/70 rounded-2xl p-4">
          <ServerOff size={16} className="mt-0.5 shrink-0 text-bronze" aria-hidden="true" />
          You can point the app at your own backend from the Settings page (default
          http://localhost:5000) once a segmentation service is running there.
        </p>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-white p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-charcoal">
          <ShieldCheck size={20} className="text-moss" aria-hidden="true" /> Privacy
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-charcoal-soft list-disc list-inside">
          <li>Camera and uploaded photos stay in your browser. Nothing is uploaded automatically.</li>
          <li>Saved designs live in your browser's IndexedDB — deleting them in Settings removes them.</li>
          <li>Images are sent to a backend <strong className="text-charcoal">only</strong> when you explicitly use an AI feature.</li>
        </ul>
      </section>
    </div>
  );
}
