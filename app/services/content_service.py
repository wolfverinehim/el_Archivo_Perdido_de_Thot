import json
import os
from functools import lru_cache

from flask import current_app


def _load_json_file(filename):
    data_dir = current_app.config["DATA_DIR"]
    with open(os.path.join(data_dir, filename), "r", encoding="utf-8") as file_obj:
        return json.load(file_obj)


def _write_json_file(filename, payload):
    data_dir = current_app.config["DATA_DIR"]
    full_path = os.path.join(data_dir, filename)
    with open(full_path, "w", encoding="utf-8") as file_obj:
        json.dump(payload, file_obj, ensure_ascii=False, indent=2)


@lru_cache(maxsize=1)
def load_rooms():
    return _load_json_file("rooms.json")


@lru_cache(maxsize=1)
def load_puzzles():
    return _load_json_file("puzzles.json")


def clear_content_cache():
    load_rooms.cache_clear()
    load_puzzles.cache_clear()


def save_rooms(payload):
    _write_json_file("rooms.json", payload)
    clear_content_cache()


def save_puzzles(payload):
    _write_json_file("puzzles.json", payload)
    clear_content_cache()
