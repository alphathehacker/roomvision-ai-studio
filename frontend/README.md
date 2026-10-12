# RoomVision AI Studio — Frontend (Phase 1)

React + TypeScript + Vite frontend for RoomVision AI Studio, an in-browser interior-design
visualizer. **Everything runs locally in the browser** — no backend required, no uploads,
no image assets (all textures are procedurally generated on canvas, works offline).

## Run it

```bash
cd frontend
npm install
npm run dev      # dev server, usually http://localhost:5173
npm run build    # typecheck + production build into dist/
```

Requires Node 18+. No environment variables, no secrets, no backend.

## What works in Phase 1

- **Home** — hero with fully procedural backdrop, "Open Camera" / "Upload Room Photo" cards.
- **Camera** (`src/components/camera/CameraView.tsx`) — `getUserMedia` is requested **only**
  when the user clicks "Open Camera" (never on page load). Live preview, front/rear switch,
  Capture → Retake → Use Photo. Distinct error states for denied / no-device / unsupported
  browsers, each with Retry and an "Upload Room Photo" alternative. All tracks stop on close,
  unmount, and after capture.
- **Upload** — JPEG/PNG/WebP via picker or drag-drop; wrong type and >15 MB files are rejected
  with plain-language errors; preview → "Use This Photo" / "Choose Different". Originals are
  never mutated; the editor works on a copy downscaled to a 1920px long edge.
- **Editor** — polygon masks (click to add, drag to move, right-click/Delete to remove,
  rectangle-drag mode, reset), default wall + ceiling (top 35%) + floor (bottom 30%) masks,
  procedural materials (paints, wallpapers, wood, stone, marble, brick, concrete, tiles,
  laminate, vinyl, granite, ceiling panels), per-surface color/scale/opacity/blend/
  brightness/saturation/rotation/tile-size controls, ceiling panel layout + ceiling-height
  preview, warm/neutral/cool lighting + temperature/intensity + up to 8 canvas-placed glow
  spots, global undo/redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), zoom, fullscreen.
- **Compare** — Original/Edited toggle, side-by-side, draggable before/after slider, all from
  the real original bitmap and the live render; "Reset to original" (confirmed).
- **Save/Library** — IndexedDB (`projects` store: id, name, originalBlob, editState JSON,
  thumbnailBlob, timestamps). "Saved" is reported only after the transaction completes.
  Reopen / rename / delete (delete is confirmed). Export PNG / JPEG at full editor resolution,
  plus "Download original".
- **AI hook** (`src/services/aiProvider.ts`) — "Try AI segmentation" POSTs to the configured
  backend; on 503 / network failure / empty result it reports honestly and never fakes success.
- **Settings** — backend URL (localStorage, default `http://localhost:5000`), connection test,
  storage estimate, "Delete all local designs" (confirmed), About (v0.1.0).

UI categories are exactly **Walls, Ceiling, Flooring, Lighting** — no Furniture/Decor buttons
until those features exist (see `src/components/furniture-tools/README.md`).

## Manual camera-testing steps

Camera capture needs a secure context (`https://` or `http://localhost`) and a real device:

1. `npm run dev`, open the printed `http://localhost:PORT` URL on a phone/laptop with a camera.
2. Click **Open Camera** → the browser must prompt for permission (proves `getUserMedia`
   was *not* called on page load — no prompt appears before the click).
3. Deny once → you should see "Camera access was denied" with how-to-enable guidance and Retry.
4. Allow → live preview appears. Use the switch-camera button to flip front/rear (mobile).
5. **Capture** → preview of the still → **Retake** restarts the stream, **Use This Photo**
   enters the editor. After leaving, the camera indicator must turn off (tracks stopped).
6. On a desktop without a camera you should get the "No camera found" state with the upload
   alternative.

## Project structure

```
src/
  components/ui/        hand-rolled accessible primitives (button, dialog, slider, tabs, tooltip, input)
  components/layout/    TopNav, LeftSidebar, RightPanel
  components/camera/    CameraView
  components/image-upload/ ImageUploader
  components/room-editor/  EditorCanvas (canvas + SVG polygon overlay)
  components/surface-tools/ SurfacePanel (mask list, edit modes, AI button)
  components/material-library/ MaterialGrid (lazy thumbnails), ColorPicker, MaterialControls
  components/ceiling-designer/ CeilingControls
  components/lighting-tools/  LightingPanel
  components/comparison/ CompareView
  components/project-library/ LibraryView, SaveDialog
  components/furniture-tools/ README only (Phase 2+ seam — no UI)
  pages/  Home, Editor, Library (wrapper), HowItWorks, Settings
  hooks/  useHistory (undo/redo), useCamera
  services/ renderer.ts, textures.ts, materials.ts, masks.ts, editorState.ts,
            storage.ts (IndexedDB), api.ts, aiProvider.ts
  types/  index.ts
  utils/  image.ts, common.ts
```

## Notes & limitations

- Rendering is a straightforward 2D canvas composite (clip → procedural tile → color grade),
  not a 3D or photometrically accurate simulation — the UI says so where it matters.
- Ceiling previews are visualizations only, not structural advice (stated in the UI).
- AI segmentation needs a server implementing `POST /api/segment-room`; Phase 4 stubs for
  project sync live in `api.ts` and are not wired to any UI.
- Verified: `npm run build` + `npx tsc --noEmit` clean; headless-Chromium E2E (upload →
  editor → material apply → undo → save → library) green with zero console errors.
