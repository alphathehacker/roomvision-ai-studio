"""GET /api/health — liveness + capability probe."""

from flask import Blueprint, jsonify

from services.ai_provider import is_configured

health_bp = Blueprint("health", __name__, url_prefix="/api/health")


@health_bp.route("", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "version": "0.1.0-phase1",
        "ai_configured": is_configured(),
        "storage": "sqlite",
    }), 200
