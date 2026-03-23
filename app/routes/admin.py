import json

from flask import Blueprint, flash, jsonify, redirect, render_template, request, session, url_for

from app.extensions import db
from app.models import EventLog, InventoryItem, Player, PuzzleState, SaveGame
from app.services.content_service import load_puzzles, load_rooms, save_puzzles, save_rooms

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


@admin_bp.get("/")
def dashboard():
    player_id = session.get("player_id")
    if not player_id:
        return jsonify({"message": "No active player", "player": None})

    player = Player.query.get(player_id)
    savegame = SaveGame.query.filter_by(player_id=player_id).first()
    items = InventoryItem.query.filter_by(player_id=player_id, active=True).all()
    puzzles = PuzzleState.query.filter_by(player_id=player_id).all()
    events = (
        EventLog.query.filter_by(player_id=player_id)
        .order_by(EventLog.timestamp.desc())
        .limit(20)
        .all()
    )

    return jsonify(
        {
            "player": {
                "id": player.id,
                "name": player.name,
            }
            if player
            else None,
            "savegame": {
                "current_room": savegame.current_room,
                "progress_pct": savegame.progress_pct,
                "state": savegame.state,
            }
            if savegame
            else None,
            "inventory": [
                {
                    "code": item.code,
                    "name": item.name,
                }
                for item in items
            ],
            "puzzles": [
                {
                    "code": p.puzzle_code,
                    "solved": p.solved,
                    "attempts": p.attempts,
                }
                for p in puzzles
            ],
            "events": [
                {
                    "type": e.event_type,
                    "detail": e.detail,
                    "timestamp": e.timestamp.isoformat(),
                }
                for e in events
            ],
        }
    )


@admin_bp.post("/reset")
def reset_active_game():
    player_id = session.get("player_id")
    if player_id:
        PuzzleState.query.filter_by(player_id=player_id).delete()
        InventoryItem.query.filter_by(player_id=player_id).delete()
        SaveGame.query.filter_by(player_id=player_id).delete()
        EventLog.query.filter_by(player_id=player_id).delete()
        Player.query.filter_by(id=player_id).delete()
        db.session.commit()

    session.pop("player_id", None)
    return redirect(url_for("game.index"))


@admin_bp.get("/editor")
def content_editor():
    rooms = load_rooms()
    puzzles = load_puzzles()
    return render_template(
        "admin_editor.html",
        rooms_json=json.dumps(rooms, ensure_ascii=False, indent=2),
        puzzles_json=json.dumps(puzzles, ensure_ascii=False, indent=2),
    )


@admin_bp.post("/editor/rooms")
def save_rooms_content():
    payload_raw = request.form.get("rooms_json", "{}")
    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError:
        flash("Formato JSON inválido para las salas.", "error")
        return redirect(url_for("admin.content_editor"))

    if not isinstance(payload, dict):
        flash("El JSON de salas debe ser un objeto.", "error")
        return redirect(url_for("admin.content_editor"))

    save_rooms(payload)
    flash("Salas actualizadas correctamente.", "success")
    return redirect(url_for("admin.content_editor"))


@admin_bp.post("/editor/puzzles")
def save_puzzles_content():
    payload_raw = request.form.get("puzzles_json", "{}")
    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError:
        flash("Formato JSON inválido para los enigmas.", "error")
        return redirect(url_for("admin.content_editor"))

    if not isinstance(payload, dict):
        flash("El JSON de enigmas debe ser un objeto.", "error")
        return redirect(url_for("admin.content_editor"))

    save_puzzles(payload)
    flash("Enigmas actualizados correctamente.", "success")
    return redirect(url_for("admin.content_editor"))
