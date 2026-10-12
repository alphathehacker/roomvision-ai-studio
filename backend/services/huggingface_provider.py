"""Hugging Face segmentation provider (wired 2026-10-12).

Uses a semantic-segmentation model from the Hugging Face Inference API
(default: SegFormer fine-tuned on ADE20K, whose label set includes wall,
floor, ceiling, window and door classes) to produce per-category masks for
room photos.

Environment:
    AI_PROVIDER=huggingface
    HF_TOKEN=hf_...            (free token from https://huggingface.co/settings/tokens;
                                AI_API_KEY is accepted as a fallback)
    HF_SEG_MODEL=...           (optional model override)
    HF_API_URL=...             (optional endpoint override)

Response shape for ``segment_room`` (also honors the base contract):
    {
      "regions": [{"label": "wall", "bbox": [x, y, w, h],
                   "coverage": 0.42, "segments": 3, "score": 0.91}, ...],
      "masks": {"wall": "<base64 PNG>", "ceiling": "<base64 PNG>", ...},
      "model": "nvidia/segformer-b2-finetuned-ade-512-768",
      "image_size": [width, height]
    }
``bbox``/``coverage`` are measured on the original image; ``masks`` are
downscaled (long edge 256px) base64 PNGs, one per detected category.

Security: the token is sent only as an Authorization header to the
configured HF endpoint. It is never logged and never appears in responses.
All upstream failures surface as ProviderError with an honest message —
masks are never fabricated.
"""

import base64
import io
import logging

import requests
from PIL import Image, ImageChops

from config import Config
from services.ai_provider import (
    AIProvider,
    ProviderError,
    ProviderNotConfigured,
)

log = logging.getLogger("roomvision")

_DEFAULT_MODEL = "nvidia/segformer-b2-finetuned-ade-512-768"
_DEFAULT_API_URL = "https://api-inference.huggingface.co/models"
_REQUEST_TIMEOUT = 90  # seconds; HF cold starts can be slow
_MASK_LONG_EDGE = 256  # downscale masks to keep responses small

# ADE20K label -> RoomVision category (labels normalized via strip().lower()).
_WALL = {"wall"}
_CEILING = {"ceiling"}
_FLOOR = {"floor"}
_WINDOW = {"windowpane", "window"}
_DOOR = {"door", "screen door"}
_FURNITURE = {
    "bed", "cabinet", "table", "chair", "sofa", "shelf", "armchair",
    "seat", "desk", "wardrobe", "lamp", "cushion", "chest of drawers",
    "counter", "pillow", "bookcase", "coffee table", "bench",
    "countertop", "swivel chair", "kitchen island", "stove",
    "refrigerator", "dishwasher", "bathtub", "toilet", "sink",
    "rug", "curtain", "television receiver", "monitor", "crt screen",
    "fan", "computer",
}
# Anything else (painting, mirror, plant, stairs, column, people, ...) -> "other".


def _categorize(label):
    """Map an ADE20K segment label to a RoomVision surface category."""
    normalized = (label or "").strip().lower()
    if normalized in _WALL:
        return "wall"
    if normalized in _CEILING:
        return "ceiling"
    if normalized in _FLOOR:
        return "floor"
    if normalized in _WINDOW:
        return "window"
    if normalized in _DOOR:
        return "door"
    if normalized in _FURNITURE:
        return "furniture"
    return "other"


def _decode_mask(mask_b64):
    """Decode a base64 PNG segment mask to a binary ('1') PIL image."""
    raw = mask_b64 or ""
    if "," in raw:  # tolerate data-URI prefixes
        raw = raw.split(",", 1)[1]
    try:
        img = Image.open(io.BytesIO(base64.b64decode(raw))).convert("L")
    except Exception as exc:
        raise ProviderError("Segmentation model returned an unreadable mask: %s" % exc)
    return img.point(lambda v: 255 if v > 127 else 0, mode="1")


def _mask_to_b64_png(img):
    """Encode a PIL image as a base64 PNG string (downscaled)."""
    w, h = img.size
    scale = _MASK_LONG_EDGE / max(w, h)
    if scale < 1:
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.NEAREST)
    buf = io.BytesIO()
    img.convert("L").save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _bbox_of(mask):
    """Bounding box [x, y, w, h] of nonzero pixels, or None if empty."""
    bbox = mask.getbbox()
    if not bbox:
        return None
    x0, y0, x1, y1 = bbox
    return [x0, y0, x1 - x0, y1 - y0]


class HuggingFaceProvider(AIProvider):
    """Room segmentation via the Hugging Face Inference API."""

    name = "huggingface"

    def __init__(self):
        self.token = (Config.HF_TOKEN or Config.AI_API_KEY or "").strip()
        if not self.token:
            raise ProviderNotConfigured(
                "HF_TOKEN is not set. Create a free token at "
                "https://huggingface.co/settings/tokens and set HF_TOKEN "
                "(or AI_API_KEY) in the environment, with "
                "AI_PROVIDER=huggingface."
            )
        self.model = (Config.HF_SEG_MODEL or _DEFAULT_MODEL).strip() or _DEFAULT_MODEL
        self.api_url = (Config.HF_API_URL or _DEFAULT_API_URL).strip() or _DEFAULT_API_URL

    def _post(self, image_bytes):
        url = "%s/%s" % (self.api_url.rstrip("/"), self.model)
        try:
            resp = requests.post(
                url,
                headers={
                    "Authorization": "Bearer %s" % self.token,
                    "Content-Type": "application/octet-stream",
                },
                data=image_bytes,
                timeout=_REQUEST_TIMEOUT,
            )
        except requests.Timeout:
            raise ProviderError(
                "Segmentation request timed out after %ds. Try again shortly."
                % _REQUEST_TIMEOUT, status=504,
            )
        except requests.RequestException as exc:
            raise ProviderError("Could not reach the segmentation service: %s" % exc)

        if resp.status_code == 200:
            try:
                return resp.json()
            except ValueError:
                raise ProviderError("Segmentation service returned invalid JSON.")
        if resp.status_code in (401, 403):
            raise ProviderError(
                "Hugging Face rejected the API token (HTTP %d). Check HF_TOKEN." % resp.status_code
            )
        if resp.status_code == 429:
            raise ProviderError(
                "Hugging Face rate limit reached (HTTP 429). Wait a little and retry."
            )
        if resp.status_code == 503:
            eta = None
            try:
                eta = resp.json().get("estimated_time")
            except ValueError:
                pass
            hint = (" Estimated load time: ~%ss — retry shortly." % int(eta)) if eta else " Retry shortly."
            raise ProviderError("Segmentation model is still loading (HTTP 503).%s" % hint)
        raise ProviderError(
            "Segmentation service failed (HTTP %d): %s"
            % (resp.status_code, (resp.text or "")[:200])
        )

    def segment_room(self, image_bytes):
        segments = self._post(image_bytes)
        if not isinstance(segments, list):
            raise ProviderError("Segmentation service returned an unexpected response shape.")

        composites = {}   # category -> binary mask composited at model resolution
        stats = {}        # category -> {"segments": n, "score": max}
        for seg in segments:
            if not isinstance(seg, dict) or "mask" not in seg:
                continue
            category = _categorize(seg.get("label", ""))
            mask = _decode_mask(seg["mask"])
            score = seg.get("score")
            try:
                score = float(score)
            except (TypeError, ValueError):
                score = None
            if category in composites:
                composites[category] = ImageChops.lighter(composites[category], mask)
                stats[category]["segments"] += 1
                if score is not None:
                    stats[category]["score"] = max(stats[category]["score"] or 0, score)
            else:
                composites[category] = mask
                stats[category] = {"segments": 1, "score": score}

        regions, masks = [], {}
        width = height = 0
        for category, mask in composites.items():
            bbox = _bbox_of(mask)
            if bbox is None:
                continue
            w, h = mask.size
            width, height = w, h
            total = w * h
            # coverage via histogram on the binary mask
            hist = mask.histogram()
            nonzero = hist[-1] if len(hist) > 1 else 0
            regions.append({
                "label": category,
                "bbox": bbox,
                "coverage": round(nonzero / total, 4) if total else 0,
                "segments": stats[category]["segments"],
                "score": stats[category]["score"],
            })
            masks[category] = _mask_to_b64_png(mask)

        regions.sort(key=lambda r: r["coverage"], reverse=True)
        return {
            "regions": regions,
            "masks": masks,
            "model": self.model,
            "image_size": [width, height],
        }

    def transform_room(self, image_bytes, params):
        raise ProviderError(
            "Image transformation is not supported by the huggingface provider "
            "(segmentation only).", status=501,
        )
