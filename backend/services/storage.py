"""Safe file storage for uploaded images.

Files are saved under UPLOAD_DIR with uuid-generated names (the original
client filename is never trusted for the on-disk name). Sizes are enforced
by streaming: a file that exceeds the configured limit is rejected with a
413 error before it is fully kept on disk.
"""

import os
import uuid

from config import Config
from utils.validation import (
    validate_image_upload,
    extension_for,
    MAX_CHUNK,
)


def _ensure_upload_dir():
    os.makedirs(Config.UPLOAD_DIR, exist_ok=True)


def save_image_file(file_storage):
    """Stream-save an uploaded image.

    Returns ``(relative_path, None)`` on success, or ``(None, (status, msg))``
    where ``status`` is 400/413 and ``msg`` describes the failure.
    """
    ok, message = validate_image_upload(file_storage)
    if not ok:
        return None, (400, message)

    _ensure_upload_dir()
    ext = extension_for(file_storage)
    stored_name = uuid.uuid4().hex + ext
    abs_path = os.path.join(Config.UPLOAD_DIR, stored_name)

    max_bytes = Config.max_upload_bytes()
    written = 0
    try:
        with open(abs_path, "wb") as out:
            while True:
                chunk = file_storage.stream.read(MAX_CHUNK)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    out.close()
                    os.remove(abs_path)
                    return None, (
                        413,
                        "File exceeds maximum size of %d MB." % Config.MAX_UPLOAD_MB,
                    )
                out.write(chunk)
    except OSError:
        if os.path.exists(abs_path):
            os.remove(abs_path)
        return None, (500, "Failed to store uploaded file.")

    # Guard: empty uploads are rejected.
    if written == 0:
        os.remove(abs_path)
        return None, (400, "Uploaded file is empty.")

    return stored_name, None


def absolute_path(relative_path):
    """Resolve a stored relative path to an absolute path on disk."""
    if not relative_path:
        return None
    return os.path.join(Config.UPLOAD_DIR, os.path.basename(relative_path))


def delete_file(relative_path):
    """Best-effort removal of a stored file. Never raises."""
    try:
        path = absolute_path(relative_path)
        if path and os.path.isfile(path):
            os.remove(path)
    except OSError:
        pass
