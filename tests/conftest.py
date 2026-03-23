import pytest
import shutil

from pathlib import Path

from app import create_app
from app.config import TestConfig
from app.extensions import db


@pytest.fixture
def app(tmp_path):
    source_data_dir = Path(__file__).resolve().parents[1] / "data"
    test_data_dir = tmp_path / "data"
    shutil.copytree(source_data_dir, test_data_dir)

    app = create_app(TestConfig)
    app.config["DATA_DIR"] = str(test_data_dir)

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()
