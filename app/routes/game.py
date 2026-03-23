from flask import Blueprint, flash, redirect, render_template, request, session, url_for

from app.services.content_service import load_rooms
from app.services.game_service import (
    create_new_game,
    get_savegame,
    log_event,
    read_state,
    update_progress,
    write_state,
)
from app.services.inventory_service import add_item, list_inventory
from app.services.puzzle_service import get_puzzle, submit_puzzle_answer

game_bp = Blueprint("game", __name__)


def _get_player_id():
    return session.get("player_id")


def _ensure_savegame_or_redirect():
    player_id = _get_player_id()
    if not player_id:
        return None, redirect(url_for("game.index"))

    savegame = get_savegame(player_id)
    if not savegame:
        session.pop("player_id", None)
        return None, redirect(url_for("game.index"))

    return savegame, None


@game_bp.get("/")
def index():
    has_game = session.get("player_id") is not None
    return render_template("index.html", has_game=has_game)


@game_bp.post("/new-game")
def new_game():
    player_name = request.form.get("player_name", "Aprendiz")
    player, _savegame = create_new_game(player_name=player_name)
    session["player_id"] = player.id
    return redirect(url_for("game.room", room_code="archives"))


@game_bp.get("/continue")
def continue_game():
    savegame, redirect_response = _ensure_savegame_or_redirect()
    if redirect_response:
        flash("No se encontró ninguna partida activa. Inicia una nueva.", "warning")
        return redirect_response
    return redirect(url_for("game.room", room_code=savegame.current_room))


@game_bp.get("/room/<room_code>")
def room(room_code):
    savegame, redirect_response = _ensure_savegame_or_redirect()
    if redirect_response:
        return redirect_response

    state = read_state(savegame)
    unlocked = state.get("rooms_unlocked", ["archives"])
    if room_code not in unlocked:
        flash("Esta sala todavía está bloqueada.", "warning")
        return redirect(url_for("game.room", room_code=savegame.current_room))

    rooms = load_rooms()
    room_data = rooms.get(room_code)
    if not room_data:
        flash("Sala no encontrada.", "error")
        return redirect(url_for("game.room", room_code=savegame.current_room))

    savegame.current_room = room_code
    write_state(savegame, state)

    inventory = list_inventory(savegame.player_id)
    return render_template(
        "room.html",
        room=room_data,
        room_code=room_code,
        inventory=inventory,
        progress=savegame.progress_pct,
        unlocked=unlocked,
        victory=state.get("victory", False),
    )


@game_bp.get("/puzzle/<puzzle_code>")
def puzzle(puzzle_code):
    savegame, redirect_response = _ensure_savegame_or_redirect()
    if redirect_response:
        return redirect_response

    puzzle_data = get_puzzle(puzzle_code)
    if not puzzle_data:
        flash("Enigma no encontrado.", "error")
        return redirect(url_for("game.room", room_code=savegame.current_room))

    return render_template(
        "puzzle.html",
        puzzle=puzzle_data,
        puzzle_code=puzzle_code,
        progress=savegame.progress_pct,
        inventory=list_inventory(savegame.player_id),
    )


@game_bp.post("/puzzle/<puzzle_code>/submit")
def submit_puzzle(puzzle_code):
    savegame, redirect_response = _ensure_savegame_or_redirect()
    if redirect_response:
        return redirect_response

    answer = request.form.get("answer", "")
    result = submit_puzzle_answer(savegame.player_id, puzzle_code, answer)
    if not result.get("ok"):
        flash("Respuesta incorrecta. ¡Sigue intentándolo!", "warning")
        log_event(savegame.player_id, "puzzle_failed", f"{puzzle_code}:{answer}")
        return redirect(url_for("game.puzzle", puzzle_code=puzzle_code))

    reward = result.get("reward")
    if reward:
        add_item(
            savegame.player_id,
            reward["code"],
            reward["name"],
            reward["description"],
        )

    state = read_state(savegame)
    unlock_room = result.get("unlock_room")
    if unlock_room and unlock_room not in state.get("rooms_unlocked", []):
        state["rooms_unlocked"].append(unlock_room)

    if result.get("victory"):
        state["victory"] = True

    write_state(savegame, state)
    update_progress(savegame, savegame.progress_pct + result.get("progress", 0))
    log_event(savegame.player_id, "puzzle_solved", puzzle_code)

    flash("¡Enigma resuelto!", "success")
    if result.get("victory"):
        return redirect(url_for("game.room", room_code=savegame.current_room))

    next_room = unlock_room or savegame.current_room
    return redirect(url_for("game.room", room_code=next_room))


@game_bp.post("/puzzle/<puzzle_code>/hint")
def request_hint(puzzle_code):
    savegame, redirect_response = _ensure_savegame_or_redirect()
    if redirect_response:
        return redirect_response

    puzzle_data = get_puzzle(puzzle_code)
    if not puzzle_data:
        flash("Enigma no encontrado.", "error")
        return redirect(url_for("game.room", room_code=savegame.current_room))

    penalty = int(puzzle_data.get("hint_penalty", 5))
    penalty = max(0, penalty)
    update_progress(savegame, savegame.progress_pct - penalty)

    hints = puzzle_data.get("hints") or [puzzle_data.get("hint", "Observe the symbols.")]
    hint_used_key = f"hints_used_{puzzle_code}"
    state = read_state(savegame)
    used = int(state.get(hint_used_key, 0))
    selected = hints[min(used, len(hints) - 1)]
    state[hint_used_key] = used + 1
    write_state(savegame, state)

    flash(f"Pista: {selected} (-{penalty}% de progreso)", "warning")
    log_event(savegame.player_id, "hint_requested", f"{puzzle_code}:{used + 1}")
    return redirect(url_for("game.puzzle", puzzle_code=puzzle_code))
