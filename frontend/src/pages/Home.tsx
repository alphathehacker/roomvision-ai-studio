import { useEffect, useRef } from 'react';
import { Camera, Upload, MousePointer2, Paintbrush, Lightbulb, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { generateTexture } from '../services/textures';

interface HomeProps {
  onOpenCamera: () => void;
  onOpenUpload: () => void;
}

/** Landing page: hero with a fully procedural architectural backdrop (no photos). */
export function Home({ onOpenCamera, onOpenUpload }: HomeProps) {
  const heroRef = useRef<HTMLDivElement>(null);

  // Paint a procedural architectural texture into the hero background, once.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    try {
      const { canvas: tile } = generateTexture('wallpaper', '#e9dfc9', { pattern: 'diamond' });
      const bg = document.createElement('canvas');
      bg.width = 720;
      bg.height = 420;
      const ctx = bg.getContext('2d');
      if (!ctx) return;
      const grad = ctx.createLinearGradient(0, 0, 720, 420);
      grad.addColorStop(0, '#f7f1e5');
      grad.addColorStop(0.55, '#f1e7d2');
      grad.addColorStop(1, '#e4d5b8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 720, 420);
      ctx.globalAlpha = 0.5;
      const pattern = ctx.createPattern(tile, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, 720, 420);
      }
      // soft "room" vignette: darker floor band + light ceiling band
      ctx.globalAlpha = 1;
      const floor = ctx.createLinearGradient(0, 300, 0, 420);
      floor.addColorStop(0, 'rgba(154,123,79,0)');
      floor.addColorStop(1, 'rgba(154,123,79,0.25)');
      ctx.fillStyle = floor;
      ctx.fillRect(0, 300, 720, 120);
      el.style.backgroundImage = `url(${bg.toDataURL('image/png')})`;
      el.style.backgroundSize = 'cover';
    } catch {
      /* hero still looks fine on the gradient fallback */
    }
  }, []);

  return (
    <div>
      {/* hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div ref={heroRef} className="absolute inset-0 bg-gradient-to-br from-cream via-sand to-sand-deep" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-bronze-deep bg-white/70 border border-line rounded-full px-3 py-1.5 mb-5">
            <ShieldCheck size={13} aria-hidden="true" /> 100% in-browser · nothing uploaded
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-charcoal max-w-2xl">
            See your room in a <span className="text-moss">new light</span> before you lift a brush.
          </h1>
          <p className="mt-5 text-lg text-charcoal-soft max-w-xl">
            RoomVision AI Studio lets you repaint walls, lay new flooring, restyle the ceiling and
            preview lighting — on a photo of your own room, right in your browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" onClick={onOpenCamera}>
              <Camera size={18} aria-hidden="true" /> Open Camera
            </Button>
            <Button variant="secondary" size="lg" onClick={onOpenUpload}>
              <Upload size={18} aria-hidden="true" /> Upload Room Photo
            </Button>
          </div>
        </div>
      </section>

      {/* start cards */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-charcoal mb-6">Start a design</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onOpenCamera}
            className="group text-left rounded-3xl border border-line bg-white p-6 shadow-sm hover:shadow-md hover:border-moss/60 transition-all"
          >
            <span className="w-12 h-12 rounded-2xl bg-moss/15 flex items-center justify-center mb-4 group-hover:bg-moss/25 transition-colors">
              <Camera size={24} className="text-moss" aria-hidden="true" />
            </span>
            <span className="block text-lg font-semibold text-charcoal">Capture with your camera</span>
            <span className="block text-sm text-charcoal-soft mt-1.5">
              Point your camera at the room. The photo is captured locally — nothing is uploaded;
              it stays in your browser.
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-moss-deep mt-3">
              Open camera <ArrowRight size={14} aria-hidden="true" />
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenUpload}
            className="group text-left rounded-3xl border border-line bg-white p-6 shadow-sm hover:shadow-md hover:border-moss/60 transition-all"
          >
            <span className="w-12 h-12 rounded-2xl bg-bronze/15 flex items-center justify-center mb-4 group-hover:bg-bronze/25 transition-colors">
              <Upload size={24} className="text-bronze" aria-hidden="true" />
            </span>
            <span className="block text-lg font-semibold text-charcoal">Upload a room photo</span>
            <span className="block text-sm text-charcoal-soft mt-1.5">
              JPEG, PNG or WebP up to 15 MB. Photos are resized for editing; your original is kept
              untouched.
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-bronze-deep mt-3">
              Choose a photo <ArrowRight size={14} aria-hidden="true" />
            </span>
          </button>
        </div>
      </section>

      {/* how camera use works */}
      <section className="bg-sand/60 border-y border-line">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-charcoal mb-2">How it works</h2>
          <p className="text-charcoal-soft mb-8 max-w-2xl">
            Three steps from photo to preview. No account, no uploads, no waiting on a server.
          </p>
          <ol className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: <MousePointer2 size={22} className="text-moss" aria-hidden="true" />,
                title: '1. Outline your surfaces',
                text: 'Trace walls, ceiling and floor with simple polygon masks. Click to add points, drag to reshape.',
              },
              {
                icon: <Paintbrush size={22} className="text-bronze" aria-hidden="true" />,
                title: '2. Apply materials',
                text: 'Paints, wallpapers, wood, marble, tiles and more — every texture is generated procedurally in your browser.',
              },
              {
                icon: <Lightbulb size={22} className="text-moss" aria-hidden="true" />,
                title: '3. Preview & compare',
                text: 'Tune lighting, compare before/after, then save your design locally or export a PNG.',
              },
            ].map((s) => (
              <li key={s.title} className="rounded-3xl border border-line bg-white p-6">
                <span className="block mb-3">{s.icon}</span>
                <h3 className="font-semibold text-charcoal">{s.title}</h3>
                <p className="text-sm text-charcoal-soft mt-1.5">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* privacy note */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="rounded-3xl border border-moss/30 bg-moss/10 p-6 sm:p-8 flex gap-4">
          <ShieldCheck size={28} className="text-moss shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-charcoal">Your photos stay yours</h2>
            <p className="text-sm text-charcoal-soft mt-1.5 max-w-2xl">
              The camera is used only to capture a photo of your room. Nothing is uploaded; the
              photo stays in your browser and in your browser's local storage if you choose to save
              a design. Photos are sent to a backend only if you explicitly use an AI feature — and
              AI segmentation is not configured in this build.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
