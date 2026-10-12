"""Upload validation helpers (type checks; size is enforced while streaming)."""

MAX_CHUNK = 1024 * 1024  # 1 MiB read chunks during streamed size enforcement

# MIME -> canonical extension. webp is supported (Pillow + browsers).
ALLOWED_IMAGE_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
HUMAN_TYPES = "jpg, jpeg, png, webp"


def _extension_of(filename):
    name = (filename or "").rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1].lower()


def allowed_file(filename):
    return _extension_of(filename) in ALLOWED_EXTENSIONS


def extension_for(file_storage):
    """Canonical on-disk extension, preferring the MIME type."""
    mime = (getattr(file_storage, "mimetype", "") or "").lower()
    if mime in ALLOWED_IMAGE_MIME:
        return ALLOWED_IMAGE_MIME[mime]
    ext = _extension_of(getattr(file_storage, "filename", ""))
    return ext if ext in ALLOWED_EXTENSIONS else ".jpg"


def validate_image_upload(file_storage):
    """Check presence/type of an upload. Returns (ok, error_message)."""
    if file_storage is None:
        return False, "No file was uploaded."
    filename = getattr(file_storage, "filename", "") or ""
    if not filename.strip():
        return False, "No file was uploaded."
    if not allowed_file(filename):
        return (
            False,
            "Unsupported file type. Allowed types: %s." % HUMAN_TYPES,
        )
    mime = (getattr(file_storage, "mimetype", "") or "").lower()
    if mime and mime not in ALLOWED_IMAGE_MIME:
        return (
            False,
            "Unsupported file type. Allowed types: %s." % HUMAN_TYPES,
        )
    return True, None
