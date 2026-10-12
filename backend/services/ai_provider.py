"""AI provider seam — the Phase 3 plug-in point.

Phase 1 ships only the abstract ``AIProvider`` interface plus
``UnconfiguredProvider``. Any request that needs real AI honestly returns
HTTP 503 until a provider is configured (see routes/ai.py).

Adding a real provider later (Phase 3), e.g. a segmentation model on
Replicate or a custom GPU endpoint:

    1. Subclass ``AIProvider`` and implement ``segment_room(image_bytes)``
       and ``transform_room(image_bytes, params)``. Read credentials only
       from ``Config.AI_API_KEY`` / ``Config.AI_API_URL`` — never hardcode
       them, never log them, never return them in responses.
    2. Give it a short name (e.g. ``"replicate"``) and register it in
       ``get_provider()`` below:

           elif name == "replicate":
               from services.replicate_provider import ReplicateProvider
               return ReplicateProvider()

    3. Set ``AI_PROVIDER=replicate`` (+ ``AI_API_KEY``) in the environment.

Contracts:
    - ``segment_room`` returns a dict like
      ``{"regions": [{"label": "wall", "bbox": [x, y, w, h]}, ...]}``.
    - ``transform_room`` returns a dict like
      ``{"image_url": "/api/...", "params": {...}}`` — it may store its
      output under UPLOAD_DIR and return an app-relative URL.
    - Raise ``ProviderNotConfigured`` when credentials are missing so the
      route layer can answer 503.
"""

from abc import ABC, abstractmethod


class ProviderNotConfigured(Exception):
    """Raised when AI is requested but no provider is configured."""


class AIProvider(ABC):
    """Abstract interface every AI backend must implement."""

    @abstractmethod
    def segment_room(self, image_bytes):
        """Segment a room photo. Returns a dict describing detected regions."""
        raise NotImplementedError

    @abstractmethod
    def transform_room(self, image_bytes, params):
        """AI-transform a room photo with the given params dict."""
        raise NotImplementedError


class UnconfiguredProvider(AIProvider):
    """Default provider: raises on every call so routes answer HTTP 503."""

    _HINT = ("Set AI_PROVIDER and credentials in environment "
             "to enable this feature.")

    def segment_room(self, image_bytes):
        raise ProviderNotConfigured(self._HINT)

    def transform_room(self, image_bytes, params):
        raise ProviderNotConfigured(self._HINT)


def get_provider():
    """Return the configured AIProvider (unconfigured by default)."""
    from config import Config
    name = (Config.AI_PROVIDER or "").strip().lower()
    if not name:
        return UnconfiguredProvider()
    # Future providers register here, e.g.:
    #   elif name == "replicate":
    #       from services.replicate_provider import ReplicateProvider
    #       return ReplicateProvider()
    raise ValueError(
        "Unknown AI_PROVIDER %r. Leave AI_PROVIDER empty for the "
        "unconfigured (503) default." % Config.AI_PROVIDER
    )


def is_configured():
    """True only when a real, recognized provider is configured."""
    try:
        return not isinstance(get_provider(), UnconfiguredProvider)
    except ValueError:
        return False
