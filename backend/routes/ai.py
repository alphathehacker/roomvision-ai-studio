"""AI endpoints (Phase 3 slot).

Both endpoints validate the uploaded image first, then delegate to the
configured AIProvider. In Phase 1 the default provider is unconfigured, so
these honestly answer HTTP 503 — no fake AI.
"""

import json

from flask import Blueprint, jsonify, request

from config import Config
from services.ai_provider import get_provider, ProviderNotConfigured
from utils.validation import validate_image_upload, MAX_CHUNK

ai_bp = Blueprint("ai", __name__, url_prefix="/api")

_UNCONFIGURED_DETAIL = (
    "Set AI_PROVIDER and credentials in environment to enable segmentation."
)
_UNCONFIGURED_TRANSFORM_DETAIL = (
    "Set AI_PROVIDER and credentials in environment to enable transformation."
)


def _read_validated_image():
    """Return (image_bytes, None) or (None, (status, error_message))."""
    file_storage = request.files.get("image")
    if file_storage is None or not (getattr(file_storage, "filename", "") or "").strip():
        return None, (400, "No image file provided. Send multipart field 'image'.")
    ok, message = validate_image_upload(file_storage)
    if not ok:
        return None, (400, message)

    max_bytes = Config.max_upload_bytes()
    chunks, total = [], 0
    while True:
        chunk = file_storage.stream.read(MAX_CHUNK)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            return None, (
                413,
                "File exceeds maximum size of %d MB." % Config.MAX_UPLOAD_MB,
            )
        chunks.append(chunk)
    image_bytes = b"".join(chunks)
    if not image_bytes:
        return None, (400, "Uploaded file is empty.")
    return image_bytes, None


def _parse_params():
    """Optional 'params' multipart field as a JSON object."""
    raw = request.form.get("params")
    if raw is None or raw == "":
        return {}
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        return None
    return parsed if isinstance(parsed, dict) else None


@ai_bp.route("/segment-room", methods=["POST"])
def segment_room():
    image_bytes, error = _read_validated_image()
    if error:
        status, message = error
        return jsonify({"error": message}), status
    try:
        result = get_provider().segment_room(image_bytes)
    except ProviderNotConfigured as exc:
        return jsonify({
            "error": "AI provider not configured",
            "detail": str(exc) or _UNCONFIGURED_DETAIL,
        }), 503
    except ValueError as exc:  # unknown AI_PROVIDER name
        return jsonify({
            "error": "AI provider not configured",
            "detail": str(exc),
        }), 503
    return jsonify(result), 200


@ai_bp.route("/transform-room", methods=["POST"])
def transform_room():
    image_bytes, error = _read_validated_image()
    if error:
        status, message = error
        return jsonify({"error": message}), status
    params = _parse_params()
    if params is None:
        return jsonify({"error": "params must be a valid JSON object."}), 400
    try:
        result = get_provider().transform_room(image_bytes, params)
    except ProviderNotConfigured as exc:
        return jsonify({
            "error": "AI provider not configured",
            "detail": str(exc) or _UNCONFIGURED_TRANSFORM_DETAIL,
        }), 503
    except ValueError as exc:  # unknown AI_PROVIDER name
        return jsonify({
            "error": "AI provider not configured",
            "detail": str(exc),
        }), 503
    return jsonify(result), 200
