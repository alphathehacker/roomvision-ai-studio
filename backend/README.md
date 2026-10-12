# RoomVision AI Studio — Backend (Phase 1)

Python Flask backend for the RoomVision AI Studio interior-design web app.
Phase 1 scope: functional foundation — project CRUD, image upload/download,
health probe, and **honest** AI stubs (503 until a real provider is
configured in Phase 3).

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
| POST | `/api/segment-room` | multipart `image`. Validates type/size, then: provider unconfigured → **503** `{"error":"AI provider not configured","detail":"..."}`. |
| POST | `/api/transform-room` | Same 503 pattern; optional multipart `params` (JSON string). |

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
- `AI_PROVIDER`, `AI_API_KEY`, `AI_API_URL` (empty = unconfigured → 503)
- `FRONTEND_ORIGIN` (`*` default, or comma-separated origins for CORS)

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
