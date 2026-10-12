# RoomVision AI Studio — Phase 1

AI-powered interior design visualization web app. **Phase 1 (functional foundation)** is complete and verified:
a working room editor with camera capture, photo upload, manual polygon surface selection,
procedurally generated materials, ceiling/flooring/lighting studios, undo/redo, before/after
comparison, IndexedDB project library, and PNG/JPEG export — plus a Flask backend with project
CRUD and an honest (unconfigured-by-default) AI provider seam.

> Phase 1 works **fully without the backend**. The backend is only contacted when you explicitly
> use an AI feature ("Try AI segmentation") or project-sync endpoint, which currently returns an
> honest `503 {"error": "AI provider not configured"}` until Phase 3 wires a real provider.

## Project layout

```
roomvision-ai-studio/
├── README.md            ← this file
├── frontend/            ← React 18 + TypeScript + Vite + Tailwind + lucide-react
│   ├── src/
│   │   ├── components/  (ui, layout, camera, image-upload, room-editor,
│   │   │                 surface-tools, material-library, ceiling-designer,
│   │   │                 lighting-tools, comparison, project-library)
│   │   ├── pages/       (Home, Editor, Library, HowItWorks, Settings)
│   │   ├── hooks/       (useHistory, useCamera, …)
│   │   ├── services/    (renderer.ts, textures.ts, masks.ts, materials.ts,
│   │   │                 storage.ts [IndexedDB], api.ts, aiProvider.ts [Phase-3 seam],
│   │   │                 editorState.ts)
│   │   ├── types/  utils/
│   │   └── App.tsx  main.tsx
│   ├── furniture-tools/README.md   ← Phase 2+ seam (no inert UI buttons)
│   └── README.md        ← frontend run + manual camera-testing steps
└── backend/             ← Flask + SQLite (MongoDB-swappable)
    ├── app.py  config.py
    ├── routes/  (health, projects, ai)
    ├── services/ (ai_provider.py [Phase-3 seam], project_service.py, storage.py)
    ├── db/      (ProjectStore ABC + SQLite impl; MongoDB swap documented)
    ├── utils/validation.py
    ├── requirements.txt  .env.example  README.md
    └── uploads/ (gitignored)
```

## Quick start

### Frontend only (no backend needed)

```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173
# or: npm run build && npx vite preview
```

No environment variables, no secrets, works offline. All textures are procedurally
generated on canvas — there are no external image assets.

### Backend (optional for Phase 1)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # placeholders only — fill real values, never commit
python app.py          # → http://localhost:5000
```

The frontend's Settings page lets you change the backend URL (default
`http://localhost:5000`) and test the connection.

### API (Phase 1)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/health` | GET | `{"status":"ok","ai_configured":false,…}` |
| `/api/projects` | GET / POST | JSON or multipart; 201 on create |
| `/api/projects/<id>` | GET / PUT / DELETE | PUT accepts client-generated UUID (idempotent upsert — Phase 4 sync seam) |
| `/api/projects/<id>/original`, `/thumbnail` | GET | image bytes |
| `/api/segment-room` | POST | multipart `image`; **503** until an AI provider is configured |
| `/api/transform-room` | POST | same 503 pattern |

Uploads: JPEG/PNG/WebP, default 15 MB cap (`MAX_UPLOAD_MB`). Structured JSON errors
(400/404/413/503); credentials via environment variables only.

## Phase 1 feature map (all functional, no placeholders)

- **Camera**: `getUserMedia` only after clicking "Open Camera"; front/rear switch;
  capture → editor; retake; full denied/unavailable/unsupported error states with retry;
  tracks stopped on close/unmount. Photo stays in the browser.
- **Upload**: JPEG/PNG/WebP, type + 15 MB validation with useful errors, preview before
  editing, replace/remove, original preserved immutably, downscale long edge to 1920px.
- **Surface selection**: manual polygon editor — click to add points, drag to move,
  right-click/Delete to remove, rectangle quick-select, reset mask; surfaces: multiple
  walls, ceiling, floor. Masks stored separately from the image.
- **Rendering engine** (`services/renderer.ts`): original bitmap → per-surface material
  layers clipped to polygon masks → procedural texture tiling (scale/rotation) →
  alpha blending + brightness/saturation filters → lighting overlays → canvas.
  Original never mutated; single efficient re-render.
- **Materials** (14 procedural canvas generators, cached, lazy thumbnails):
  solid/matte/glossy paint, geometric wallpapers, wood, stone, marble, brick, concrete;
  flooring: ceramic tiles, marble, granite, wood, laminate, vinyl, concrete, stone,
  patterned tiles; ceiling: paint + rectangular panel overlays (rectangles only).
- **Controls**: color picker + preset palettes, texture scale, opacity, brightness,
  saturation, blending intensity, tile size, pattern direction; apply to selected
  surface / all walls / reset surface.
- **Ceiling (Phase-1 basic)**: material + color + rectangular panel layout
  (adjustable width/spacing), ceiling-height visual adjustment. UI states clearly:
  previews are visualizations, not verified structural modifications; structural
  elements/beams are preserved — nothing auto-covers them.
- **Flooring**: material, tile size, pattern direction, mask-clipped perspective-following
  tiling, reset/undo.
- **Lighting (basic)**: warm/neutral/cool color-grade overlays + temperature/intensity
  sliders + up to 8 canvas-placed glow spots; labeled "simplified lighting preview —
  not photorealistic light simulation"; all reversible.
- **Undo/redo**: global immutable history covering materials, masks, lighting,
  ceiling settings (Ctrl+Z / Ctrl+Shift+Z).
- **Comparison**: original/edited toggle, side-by-side, draggable before/after slider —
  all from real image data; reset-to-original with confirm.
- **Save/export**: IndexedDB projects (never localStorage for images): id, name,
  original blob, reproducible edit state, thumbnail, created/updated timestamps.
  "Saved" reported only after the transaction commits; failures surfaced honestly.
  Library: reopen / rename / delete (confirm). Export: rendered PNG/JPEG, plus
  original and edited downloads separately.
- **How It Works**: honest manual-mode vs AI-mode (unavailable until configured).
- **Settings**: backend URL, delete-all-local-designs, storage estimate, version.

## Verification status (Phase 1)

- `npm run build` (tsc --noEmit + vite build): **zero errors**, 1616 modules.
- Flask: `compileall` clean; live boot + curl suite: health 200, full projects CRUD
  lifecycle, multipart PNG upload with byte-identical round-trip, 400 on bad type,
  413 on oversize, 404 on missing project, **503 honest JSON** on both AI endpoints
  without a provider, CORS preflight OK.
- Spec §21 items 1–8, 12–17, 20: verified by headless Chromium E2E (14/14 + 11/12
  pixel-level checks, zero console errors) and code-review where no browser existed on
  the test VM — each item documented with evidence in the verification report.
- **Camera testing**: headless E2E couldn't exercise the camera (no device); manual
  steps are documented in `frontend/README.md`.

## Known limitations

- No real AI segmentation yet (Phase 3) — manual polygon selection is the primary path.
- Backend projects are a separate store from the browser's IndexedDB library (frontend
  uses IndexedDB; backend CRUD is ready for Phase 4 sync via client-UUID upsert).
- Flask dev server + SQLite: fine for Phase 1, needs a real server/DB for production.
- Lighting is a simplified color-grade + glow overlay, not physical light simulation.

## Later phases (seams already in place)

- **Phase 2 — Ceiling designer**: extend `ceiling-designer/` (PVC/gypsum libraries);
  `furniture-tools/` README marks the furniture seam — no inert UI added in Phase 1.
- **Phase 3 — AI segmentation**: implement `AIProvider` in
  `backend/services/ai_provider.py` (plug-in recipe in docstring), register in
  `get_provider()`; frontend seam at `frontend/src/services/aiProvider.ts`.
- **Phase 4 — Project management/sync**: backend CRUD + client-UUID idempotent PUT
  already support sync; frontend `api.ts` has the slot marked.
