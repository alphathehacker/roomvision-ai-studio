"""SQLite implementation of the ProjectStore interface.

Schema note: ``edit_state`` is stored as a JSON-encoded TEXT column so the
frontend's canvas/editor state round-trips untouched. Image fields store the
upload-relative file path (e.g. ``"9f3c....png"``); actual bytes live on disk
under UPLOAD_DIR. List views never include blobs.

Concurrency: each operation opens its own short-lived connection. This is
fine for a single-process Phase-1 dev server; move to a connection pool or a
server database (Postgres/Mongo) when scaling.
"""

import json
import os
import sqlite3


SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    edit_state TEXT,
    original_image_path TEXT,
    thumbnail_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);
"""


class SqliteProjectStore:
    def __init__(self, db_path):
        self.db_path = db_path
        parent = os.path.dirname(os.path.abspath(db_path))
        if parent:
            os.makedirs(parent, exist_ok=True)
        self._init_schema()

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self):
        conn = self._connect()
        try:
            conn.executescript(SCHEMA)
            conn.commit()
        finally:
            conn.close()

    @staticmethod
    def _row_to_dict(row):
        if row is None:
            return None
        d = dict(row)
        raw = d.get("edit_state")
        d["edit_state"] = json.loads(raw) if raw else None
        return d

    @staticmethod
    def _encode_edit_state(edit_state):
        if edit_state is None:
            return None
        return json.dumps(edit_state)

    # ---- ProjectStore interface ----

    def create(self, project_id, name, edit_state, original_image_path,
               thumbnail_path, created_at, updated_at):
        conn = self._connect()
        try:
            conn.execute(
                "INSERT INTO projects (id, name, edit_state, original_image_path,"
                " thumbnail_path, created_at, updated_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (project_id, name, self._encode_edit_state(edit_state),
                 original_image_path, thumbnail_path, created_at, updated_at),
            )
            conn.commit()
        finally:
            conn.close()
        return self.get(project_id)

    def list_all(self):
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT * FROM projects ORDER BY updated_at DESC"
            ).fetchall()
        finally:
            conn.close()
        return [self._row_to_dict(r) for r in rows]

    def get(self, project_id):
        conn = self._connect()
        try:
            row = conn.execute(
                "SELECT * FROM projects WHERE id = ?", (project_id,)
            ).fetchone()
        finally:
            conn.close()
        return self._row_to_dict(row)

    def update(self, project_id, fields):
        if not fields:
            return self.get(project_id)
        allowed = {"name", "edit_state", "original_image_path",
                   "thumbnail_path", "updated_at"}
        sets, values = [], []
        for key, value in fields.items():
            if key not in allowed:
                continue
            if key == "edit_state":
                value = self._encode_edit_state(value)
            sets.append("%s = ?" % key)
            values.append(value)
        if not sets:
            return self.get(project_id)
        values.append(project_id)
        conn = self._connect()
        try:
            conn.execute(
                "UPDATE projects SET %s WHERE id = ?" % ", ".join(sets), values
            )
            conn.commit()
        finally:
            conn.close()
        return self.get(project_id)

    def delete(self, project_id):
        conn = self._connect()
        try:
            cur = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            conn.commit()
            removed = cur.rowcount > 0
        finally:
            conn.close()
        return removed
