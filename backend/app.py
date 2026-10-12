"""RoomVision AI Studio — Flask backend (Phase 1).

Run from this directory:
    python app.py
or:
    flask --app app:create_app run

All configuration comes from environment variables (see config.py and
.env.example). No secrets are logged or returned in responses.
"""

import logging
import os
import sys

# Make flat imports (config, db, routes, ...) work regardless of how the
# server is launched (python app.py vs flask run).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request  # noqa: E402
from flask_cors import CORS  # noqa: E402
from werkzeug.exceptions import RequestEntityTooLarge  # noqa: E402

from config import Config  # noqa: E402
from routes.health import health_bp  # noqa: E402
from routes.projects import projects_bp  # noqa: E402
from routes.ai import ai_bp  # noqa: E402


def create_app():
    app = Flask(__name__)

    # Hard request cap (per-file limits are enforced while streaming).
    app.config["MAX_CONTENT_LENGTH"] = Config.max_upload_bytes() * 3 + 1024 * 1024

    CORS(app, resources={r"/api/*": {"origins": Config.cors_origins()}})

    app.register_blueprint(health_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(ai_bp)

    os.makedirs(Config.UPLOAD_DIR, exist_ok=True)

    @app.errorhandler(404)
    def not_found(_exc):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_exc):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(400)
    def bad_request(_exc):
        return jsonify({"error": "Bad request"}), 400

    @app.errorhandler(RequestEntityTooLarge)
    @app.errorhandler(413)
    def too_large(_exc):
        return jsonify({
            "error": "Request too large. Maximum upload size is %d MB per file."
                     % Config.MAX_UPLOAD_MB,
        }), 413

    @app.errorhandler(500)
    def internal_error(exc):
        # Log only the exception type and route — never bodies, headers,
        # or env values (those could carry secrets).
        app.logger.error(
            "Unhandled error on %s %s: %s",
            request.method, request.path, type(exc).__name__,
        )
        return jsonify({"error": "Internal server error"}), 500

    @app.after_request
    def _no_store_secrets(response):
        return response

    return app


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger("roomvision").info(
        "Starting RoomVision backend (storage=sqlite, ai_configured=%s)",
        __import__("services.ai_provider", fromlist=["is_configured"]).is_configured(),
    )
    create_app().run(host="0.0.0.0", port=Config.PORT)
