"""Application configuration.

All credentials and environment-specific settings are read from environment
variables here. **Nothing secret is hardcoded anywhere in this codebase.**

Phase 1 supports SQLite only. DATABASE_URL is honored when it uses the
``sqlite:///`` scheme; otherwise SQLITE_PATH points at a custom file path.
"""

import os


def _get_int(name, default):
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


_BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    """Central configuration, populated from environment variables."""

    # Server
    PORT = _get_int("PORT", 5000)

    # Database: DATABASE_URL (sqlite:///...) wins; otherwise SQLITE_PATH file.
    DATABASE_URL = os.environ.get("DATABASE_URL", "")
    SQLITE_PATH = os.environ.get("SQLITE_PATH", os.path.join(_BASE_DIR, "roomvision.db"))

    # Uploads
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(_BASE_DIR, "uploads"))
    MAX_UPLOAD_MB = _get_int("MAX_UPLOAD_MB", 15)

    # AI provider (Phase 3 slot; unconfigured by default)
    AI_PROVIDER = os.environ.get("AI_PROVIDER", "")
    AI_API_KEY = os.environ.get("AI_API_KEY", "")
    AI_API_URL = os.environ.get("AI_API_URL", "")

    # CORS
    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "*")

    @classmethod
    def resolved_sqlite_path(cls):
        """Return the SQLite file path honoring DATABASE_URL / SQLITE_PATH."""
        if cls.DATABASE_URL.startswith("sqlite:///"):
            return cls.DATABASE_URL[len("sqlite:///"):]
        return cls.SQLITE_PATH

    @classmethod
    def max_upload_bytes(cls):
        return cls.MAX_UPLOAD_MB * 1024 * 1024

    @classmethod
    def cors_origins(cls):
        """Return '*' or a list of allowed origins for CORS."""
        raw = (cls.FRONTEND_ORIGIN or "").strip()
        if raw == "*" or not raw:
            return "*"
        return [o.strip() for o in raw.split(",") if o.strip()]
