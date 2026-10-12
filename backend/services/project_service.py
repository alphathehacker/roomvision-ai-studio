"""Project business logic: validation + orchestration.

Phase-4 sync note (documented, partially implemented): ``PUT
/api/projects/<project_id>`` accepts a client-generated uuid as the id and
behaves as an idempotent upsert — it creates the project with that id when
missing, so the frontend can sync offline-created projects by pushing them
with their local ids. Non-uuid ids that do not exist still return 404.
"""

import uuid
from datetime import datetime, timezone

from db import get_store
from services.storage import save_image_file, delete_file


class ValidationError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


class NotFoundError(Exception):
    pass


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _is_uuid(value):
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def validate_name(name):
    if name is None or not str(name).strip():
        raise ValidationError("Project name is required.")


def validate_edit_state(edit_state):
    if edit_state is None:
        return None
    if not isinstance(edit_state, dict):
        raise ValidationError("edit_state must be a JSON object.")
    return edit_state


def to_summary(project):
    return {
        "id": project["id"],
        "name": project["name"],
        "created_at": project["created_at"],
        "updated_at": project["updated_at"],
        "has_original": bool(project.get("original_image_path")),
        "has_thumbnail": bool(project.get("thumbnail_path")),
    }


def to_detail(project):
    summary = to_summary(project)
    summary["edit_state"] = project.get("edit_state")
    pid = project["id"]
    summary["original_image_url"] = (
        "/api/projects/%s/original" % pid if summary["has_original"] else None
    )
    summary["thumbnail_url"] = (
        "/api/projects/%s/thumbnail" % pid if summary["has_thumbnail"] else None
    )
    return summary


def _store_image(field_name, files):
    """Save an optional uploaded image; return its stored path or None."""
    file_storage = files.get(field_name) if files else None
    if file_storage is None or not getattr(file_storage, "filename", ""):
        return None
    stored, error = save_image_file(file_storage)
    if error:
        status, message = error
        raise ValidationError(message, status=status)
    return stored


def create_project(name, edit_state=None, files=None):
    validate_name(name)
    edit_state = validate_edit_state(edit_state)
    original = _store_image("original_image", files)
    try:
        thumbnail = _store_image("thumbnail", files)
    except ValidationError:
        delete_file(original)
        raise
    project_id = uuid.uuid4().hex
    stamp = now_iso()
    project = get_store().create(
        project_id=project_id,
        name=str(name).strip(),
        edit_state=edit_state,
        original_image_path=original,
        thumbnail_path=thumbnail,
        created_at=stamp,
        updated_at=stamp,
    )
    return project


def list_projects():
    return [to_summary(p) for p in get_store().list_all()]


def get_project(project_id):
    project = get_store().get(project_id)
    if project is None:
        raise NotFoundError()
    return project


def upsert_project(project_id, name=None, edit_state=None, files=None):
    """Update a project; create it with the client-given uuid if missing.

    This is the Phase-4 sync seam: the frontend may PUT with its own uuid.
    """
    store = get_store()
    existing = store.get(project_id)
    if existing is None and not _is_uuid(project_id):
        raise NotFoundError()

    fields = {"updated_at": now_iso()}
    if name is not None:
        validate_name(name)
        fields["name"] = str(name).strip()
    if edit_state is not None:
        fields["edit_state"] = validate_edit_state(edit_state)

    old_paths = []
    if files:
        for field_name, column in (("original_image", "original_image_path"),
                                   ("thumbnail", "thumbnail_path")):
            file_storage = files.get(field_name)
            if file_storage is not None and getattr(file_storage, "filename", ""):
                stored, error = save_image_file(file_storage)
                if error:
                    status, message = error
                    raise ValidationError(message, status=status)
                fields[column] = stored
                if existing and existing.get(column):
                    old_paths.append(existing[column])

    if existing is None:
        # Idempotent upsert: create under the client-supplied id.
        if "name" not in fields:
            raise ValidationError("Project name is required.")
        project = store.create(
            project_id=project_id,
            name=fields["name"],
            edit_state=fields.get("edit_state"),
            original_image_path=fields.get("original_image_path"),
            thumbnail_path=fields.get("thumbnail_path"),
            created_at=fields["updated_at"],
            updated_at=fields["updated_at"],
        )
    else:
        project = store.update(project_id, fields)

    for path in old_paths:
        delete_file(path)
    return project


def delete_project(project_id):
    project = get_store().get(project_id)
    if project is None:
        raise NotFoundError()
    removed = get_store().delete(project_id)
    if removed:
        delete_file(project.get("original_image_path"))
        delete_file(project.get("thumbnail_path"))
    return project_id
