# RoomVision AI Studio — Backend

Python Flask backend for the RoomVision AI Studio interior-design web app.
Scope: project CRUD, image upload/download, health probe, and AI endpoints —
**honest** 503s when no provider is configured, real room segmentation via
the Hugging Face Inference API when `AI_PROVIDER=huggingface`.

## Layout

```
backend/
  app.py               Flask app factory (create_app), JSON error handlers, CORS
  config.py            Env-var configuration (no hardcoded secrets)
  db/
    __init__.py        ProjectStore abstract interface + get_store() factory
    sqlite_store.py    SQLite implementation (metadata + edit_state JSON)
  routes/
    health.py          GET /api/health
    projects.py        Project CRUD + image downloads
    ai.py              POST /api/segment-room, POST /api/transform-room (503 stub)
  services/
    ai_provider.py     AIProvider interface + UnconfiguredProvider (Phase 3 slot)
    project_service.py Validation + orchestration (Phase 4 upsert note)
    storage.py         Safe uuid-named file saving under UPLOAD_DIR
  utils/validation.py  Upload type checks (size enforced while streaming)
```

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real values; never commit .env
python app.py          # serves on PORT (default 5000)
```

Health check:

```bash
curl http://localhost:5000/api/health
# {"status":"ok","version":"0.1.0-phase1","ai_configured":false,"storage":"sqlite"}
```

## API

All endpoints live under `/api`, speak JSON, and use correct status codes.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | 200 `{"status":"ok","version":"0.1.0-phase1","ai_configured":false,"storage":"sqlite"}` |
| POST | `/api/projects` | JSON `{name, edit_state}` **or** multipart (`name`, `edit_state` JSON string, `original_image` file, `thumbnail` file). 201. Missing name → 400. |
| GET | `/api/projects` | 200 `{"projects":[{id,name,created_at,updated_at,has_original,has_thumbnail}]}` — no blobs |
| GET | `/api/projects/<id>` | 200 full project incl. `edit_state` + `original_image_url` / `thumbnail_url`. 404 if missing. |
| GET | `/api/projects/<id>/original` | Image bytes (`image/*`). 404 JSON if missing. |
| GET | `/api/projects/<id>/thumbnail` | Same for the thumbnail. |
| PUT | `/api/projects/<id>` | JSON or multipart (name and/or edit_state and/or new images). 200. **Idempotent upsert**: a missing id that looks like a uuid is created under that id (Phase 4 sync seam); other missing ids → 404. |
| DELETE | `/api/projects/<id>` | 200 `{"deleted":true,"id":...}`; also deletes stored files. 404 if missing. |
| POST | `/api/segment-room` | multipart `image`. Validates type/size, then: provider unconfigured → **503** `{"error":"AI provider not configured","detail":"..."}`. With `AI_PROVIDER=huggingface` → **200** `{"regions":[{label,bbox,coverage,segments,score}],"masks":{wall,ceiling,...: base64 PNG},"model", "image_size"}`. Upstream failures → **502** (honest message), timeouts → **504**, model cold-start → **502** with retry hint. |
| POST | `/api/transform-room` | Same validation; optional multipart `params` (JSON string). Unconfigured → **503**. The huggingface provider supports segmentation only → **501** here. |

Global errors: unknown routes → 404 `{"error":"Not found"}`; unhandled
errors → 500 `{"error":"Internal server error"}` (no tracebacks/secrets).

Upload rules: allowed types `jpg/jpeg/png/webp`; per-file size limit from
`MAX_UPLOAD_MB` (default 15 MB) enforced while streaming — oversized → 413,
bad type → 400. Files are stored with uuid names under `UPLOAD_DIR`; the
client filename is never trusted on disk.

## Environment variables

See `.env.example`. Key ones:

- `PORT` (default 5000), `DATABASE_URL` (`sqlite:///...`) or `SQLITE_PATH`
- `UPLOAD_DIR` (default `uploads/`), `MAX_UPLOAD_MB` (default 15)
- `AI_PROVIDER` (`huggingface` supported; empty = unconfigured → 503)
- `AI_API_KEY`, `AI_API_URL` (generic fallback)
- `HF_TOKEN` (free token from https://huggingface.co/settings/tokens; `AI_API_KEY` also accepted)
- `HF_SEG_MODEL` (default `nvidia/segformer-b2-finetuned-ade-512-768`), `HF_API_URL`
- `FRONTEND_ORIGIN` (`*` default, or comma-separated origins for CORS)

## Enabling Hugging Face segmentation

1. Create a free token at https://huggingface.co/settings/tokens (no credit card).
2. Set in `.env` (or Render env vars):
   ```
   AI_PROVIDER=huggingface
   HF_TOKEN=hf_your_token_here
   ```
3. Restart the server and test:
   ```bash
   curl -X POST http://localhost:5000/api/segment-room \
     -F "image=@room.jpg;type=image/jpeg"
   ```
   → `{"regions":[{"label":"wall","bbox":[...],"coverage":0.51,...}],"masks":{"wall":"<base64 PNG>",...},...}`.
   Labels follow ADE20K (`wall`, `floor`, `ceiling`, `windowpane`, `door`, …)
   mapped to RoomVision categories: `wall`, `ceiling`, `floor`, `window`,
   `door`, `furniture`, `other`.

Notes: first request to a model can cold-start (HTTP 503 + retry hint —
wait ~20s and retry). Free-tier rate limits apply; 429 surfaces an honest
error. The token is sent only as an `Authorization` header and never logged.

## Deploying to Render

The backend runs on Render as a standard Python web service:

- **Repo:** `alphathehacker/roomvision-ai-studio`, branch `main`
- **Root directory:** `backend`
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
  (`app.py` exposes the Flask `app`; Render sets `PORT` itself)
- **Plan:** Free (service sleeps after 15 min idle; cold starts take ~30–60s)
- **Env vars:** set `HF_TOKEN` + `AI_PROVIDER=huggingface` in the Render
  dashboard to enable segmentation; `FRONTEND_ORIGIN` to the frontend URL.

Caveats: the free tier has an ephemeral filesystem — the SQLite database
and `uploads/` reset when the service restarts. Frontend IndexedDB saves are
unaffected. Attach a Render PostgreSQL (and later a `ProjectStore` Postgres
implementation) for persistent backend storage.

## Stub seams for later phases

- **Phase 2 (ceiling designer / editor features):** extend `edit_state`
  schema — it is opaque JSON, no backend changes needed.
- **Phase 3 (real AI):** implement `AIProvider` in `services/ai_provider.py`
  (see its docstring), register the provider name in `get_provider()`, and
  set `AI_PROVIDER` + credentials. Routes already delegate to it.
- **Phase 4 (project management / sync):** `ProjectStore` is swappable —
  implement it with pymongo per the docstring in `db/__init__.py`. `PUT`
  already does client-uuid upsert for offline sync.

## Known limitations (Phase 1)

- Single-process dev server; SQLite opens a connection per operation (no pool).
- AI endpoints return 503 by design until a provider is wired in.
- Uploads live on local disk (ephemeral on some hosts); move to object
  storage when deploying for real.
