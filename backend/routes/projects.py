"""Project CRUD + image download endpoints."""

import json

from flask import Blueprint, jsonify, request, send_file

from services.project_service import (
    ValidationError,
    NotFoundError,
    create_project,
    list_projects,
    get_project,
    upsert_project,
    delete_project,
    to_summary,
    to_detail,
)
from services.storage import absolute_path

projects_bp = Blueprint("projects", __name__, url_prefix="/api/projects")

_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def _parse_edit_state(raw):
    """Accept a dict or JSON string; return dict/None or raise ValidationError."""
    if raw is None or raw == "":
        return None
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        raise ValidationError("edit_state must be a valid JSON object.")
    if not isinstance(parsed, dict):
        raise ValidationError("edit_state must be a valid JSON object.")
    return parsed


def _read_payload():
    """Normalize JSON vs multipart bodies into (name, edit_state, files)."""
    if request.is_json:
        data = request.get_json(silent=True)
        if data is None:
            raise ValidationError("Invalid JSON body.", status=400)
        if not isinstance(data, dict):
            raise ValidationError("Request body must be a JSON object.")
        return data.get("name"), _parse_edit_state(data.get("edit_state")), None
    # multipart/form-data (or form-encoded)
    name = request.form.get("name")
    edit_state = _parse_edit_state(request.form.get("edit_state"))
    return name, edit_state, request.files


@projects_bp.route("", methods=["POST"])
def create():
    try:
        name, edit_state, files = _read_payload()
        project = create_project(name=name, edit_state=edit_state, files=files)
    except ValidationError as exc:
        return jsonify({"error": exc.message}), exc.status
    return jsonify(to_detail(project)), 201


@projects_bp.route("", methods=["GET"])
def list_all():
    return jsonify({"projects": list_projects()}), 200


@projects_bp.route("/<project_id>", methods=["GET"])
def detail(project_id):
    try:
        project = get_project(project_id)
    except NotFoundError:
        return jsonify({"error": "Project not found"}), 404
    return jsonify(to_detail(project)), 200


@projects_bp.route("/<project_id>", methods=["PUT"])
def update(project_id):
    """Update; or idempotent upsert when <project_id> is a client-made uuid."""
    try:
        name, edit_state, files = _read_payload()
        project = upsert_project(
            project_id, name=name, edit_state=edit_state, files=files
        )
    except ValidationError as exc:
        return jsonify({"error": exc.message}), exc.status
    except NotFoundError:
        return jsonify({"error": "Project not found"}), 404
    return jsonify(to_detail(project)), 200


@projects_bp.route("/<project_id>", methods=["DELETE"])
def remove(project_id):
    try:
        deleted_id = delete_project(project_id)
    except NotFoundError:
        return jsonify({"error": "Project not found"}), 404
    return jsonify({"deleted": True, "id": deleted_id}), 200


def _serve_image(project_id, column):
    try:
        project = get_project(project_id)
    except NotFoundError:
        return jsonify({"error": "Project not found"}), 404
    rel = project.get(column)
    path = absolute_path(rel)
    if not path:
        return jsonify({"error": "Image not found"}), 404
    import os
    if not os.path.isfile(path):
        return jsonify({"error": "Image not found"}), 404
    ext = os.path.splitext(path)[1].lower()
    return send_file(path, mimetype=_MIME_BY_EXT.get(ext, "application/octet-stream"))


@projects_bp.route("/<project_id>/original", methods=["GET"])
def original(project_id):
    return _serve_image(project_id, "original_image_path")


@projects_bp.route("/<project_id>/thumbnail", methods=["GET"])
def thumbnail(project_id):
    return _serve_image(project_id, "thumbnail_path")
