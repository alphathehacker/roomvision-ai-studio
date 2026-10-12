"""Project persistence layer.

This module defines the abstract ``ProjectStore`` interface plus a
``get_store()`` factory. Phase 1 ships a SQLite implementation
(``SqliteProjectStore`` in ``sqlite_store.py``).

Swapping in MongoDB later (Phase 4):
    1. ``pip install pymongo``
    2. Implement ``ProjectStore`` in ``db/mongo_store.py`` with the same
       method signatures — store ``edit_state`` as a sub-document, keep
       ``original_image_path`` / ``thumbnail_path`` as plain strings.
    3. Change ``get_store()`` (or branch on a ``STORE_BACKEND`` env var) to
       return the Mongo implementation. No route/service code changes are
       needed because every caller programs against the abstract interface.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class ProjectNotFound(Exception):
    """Raised when a project id does not exist in the store."""


class ProjectStore(ABC):
    """Abstract persistence interface for RoomVision projects."""

    @abstractmethod
    def create(self, project_id, name, edit_state, original_image_path,
               thumbnail_path, created_at, updated_at):
        """Create and return the project dict."""
        raise NotImplementedError

    @abstractmethod
    def list_all(self):
        """Return all project dicts, newest-first."""
        raise NotImplementedError

    @abstractmethod
    def get(self, project_id):
        """Return the project dict, or None if missing."""
        raise NotImplementedError

    @abstractmethod
    def update(self, project_id, fields):
        """Update fields dict; return updated project dict or None if missing."""
        raise NotImplementedError

    @abstractmethod
    def delete(self, project_id):
        """Delete; return True if a row was removed, else False."""
        raise NotImplementedError


_store = None


def get_store():
    """Return the process-wide ProjectStore (SQLite in Phase 1)."""
    global _store
    if _store is None:
        from config import Config
        from db.sqlite_store import SqliteProjectStore
        _store = SqliteProjectStore(Config.resolved_sqlite_path())
    return _store


def reset_store():
    """Testing hook: drop the cached store so env/config changes take effect."""
    global _store
    _store = None
