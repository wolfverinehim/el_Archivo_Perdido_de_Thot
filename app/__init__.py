import os

from flask import Flask

from app.config import Config
from app.extensions import db


def create_app(config_object=Config):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_object)

    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)

    from app.routes.admin import admin_bp
    from app.routes.game import game_bp

    app.register_blueprint(game_bp)
    app.register_blueprint(admin_bp)

    with app.app_context():
        from app import models  # noqa: F401

        db.create_all()

    return app
