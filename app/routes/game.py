import random

from flask import Blueprint, flash, redirect, render_template, request, session, url_for

from app.services.content_service import load_glyphs, load_puzzles, load_rooms
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


def _build_glyph_glossary():
    glossary = {}

    for entry in load_glyphs():
        token = (entry.get("token") or "").strip()
        if not token:
            continue
        glossary[token] = {
            "token": token,
            "label": entry.get("label") or token,
            "glyph": entry.get("glyph") or token,
            "meaning": entry.get("meaning") or "Sin descripción registrada.",
            "source": entry.get("source") or "manual",
        }

    puzzles = load_puzzles()

    for puzzle in puzzles.values():
        for spot in puzzle.get("hotspots", []):
            token = (spot.get("token") or "").strip()
            if not token:
                continue

            glossary[token] = {
                "token": token,
                "label": spot.get("label") or token,
                "glyph": spot.get("glyph") or token,
                "meaning": spot.get("hint") or "Sin descripción registrada.",
                "source": "puzzle",
            }

    return sorted(glossary.values(), key=lambda item: item["label"].lower())


def _build_hotspot_glyph_map():
    token_map = {}
    for puzzle in load_puzzles().values():
        for spot in puzzle.get("hotspots", []):
            token = (spot.get("token") or "").strip()
            if not token:
                continue
            token_map[token] = {
                "token": token,
                "label": spot.get("label") or token,
                "glyph": spot.get("glyph") or token,
            }
    return token_map


def _get_or_create_room_hunt(savegame, state, room_code):
    room_hunts = state.setdefault("room_hunts", {})
    existing = room_hunts.get(room_code)
    if existing:
        return existing, False

    token_map = _build_hotspot_glyph_map()
    candidate_tokens = [token for token in token_map.keys() if not token.startswith("seti_")]
    if not candidate_tokens:
        candidate_tokens = list(token_map.keys())

    object_names = [
        "Altar",
        "Vasija",
        "Pergamino",
        "Estatua",
        "Cofre",
        "Amuleto",
    ]
    base_positions = [
        {"x": 12, "y": 22},   # esquina superior izquierda
        {"x": 50, "y": 18},   # centro superior
        {"x": 85, "y": 28},   # esquina superior derecha
        {"x": 20, "y": 58},   # centro-bajo izquierda
        {"x": 55, "y": 65},   # centro-bajo
        {"x": 82, "y": 72},   # esquina inferior derecha
    ]

    rng = random.Random(f"hunt:{savegame.player_id}:{room_code}")
    rng.shuffle(base_positions)

    if len(candidate_tokens) >= len(object_names):
        selected_tokens = rng.sample(candidate_tokens, len(object_names))
    else:
        selected_tokens = [rng.choice(candidate_tokens) for _ in object_names]

    target_token = rng.choice(selected_tokens)
    target_meta = token_map.get(target_token, {"glyph": target_token, "label": target_token})

    objects = []
    for index, name in enumerate(object_names):
        token = selected_tokens[index]
        meta = token_map.get(token, {"glyph": token, "label": token})
        pos = base_positions[index]
        objects.append(
            {
                "id": f"{room_code}-{index}",
                "name": name,
                "token": token,
                "glyph": meta.get("glyph") or token,
                "label": meta.get("label") or token,
                "x": pos["x"],
                "y": pos["y"],
            }
        )

    room_hunts[room_code] = {
        "target_token": target_token,
        "target_glyph": target_meta.get("glyph") or target_token,
        "target_label": target_meta.get("label") or target_token,
        "objects": objects,
        "claimed": False,
    }

    return room_hunts[room_code], True


def _get_current_objective(savegame=None, puzzle_code=None):
    if not savegame:
        return "Inicia una partida y descifra la primera secuencia de la tablilla."

    state = read_state(savegame)
    if state.get("victory"):
        return "Archivo restaurado. Explora las salas y perfecciona tu dominio de los glifos."

    if puzzle_code:
        puzzle = get_puzzle(puzzle_code)
        if puzzle:
            return f"Resuelve el enigma: {puzzle.get('title', 'Desafío jeroglífico')}."

    room = load_rooms().get(savegame.current_room, {})
    if room.get("puzzle_code"):
        puzzle = get_puzzle(room["puzzle_code"])
        if puzzle:
            return f"Explora {room.get('title', 'la sala actual')} y abre el enigma {puzzle.get('title', '')}."

    return "Continúa la exploración del Archivo Perdido de Thot."


@game_bp.get("/")
def index():
    player_id = _get_player_id()
    savegame = get_savegame(player_id) if player_id else None
    has_game = savegame is not None
    return render_template(
        "index.html",
        has_game=has_game,
        progress=savegame.progress_pct if savegame else 0,
        objective=_get_current_objective(savegame),
    )


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


def _get_room_background(room_code):
    """Mapear código de sala a imagen de fondo SVG."""
    room_bg_map = {
        "archives": url_for("static", filename="img/room_archives.svg"),
        "ritual": url_for("static", filename="img/room_ritual.svg"),
        "sanctum": url_for("static", filename="img/room_sanctum.svg"),
    }
    return room_bg_map.get(room_code, "")


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

    room_hunt, _hunt_changed = _get_or_create_room_hunt(savegame, state, room_code)

    savegame.current_room = room_code
    write_state(savegame, state)

    inventory = list_inventory(savegame.player_id)
    objective = _get_current_objective(savegame)
    if room_hunt and not room_hunt.get("claimed"):
        objective = (
            f"Explora {room_data.get('title', 'la sala')} y localiza el glifo "
            f"{room_hunt.get('target_glyph')} ({room_hunt.get('target_label')})."
        )

    room_bg_image = _get_room_background(room_code)

    return render_template(
        "room.html",
        room=room_data,
        room_code=room_code,
        room_hunt=room_hunt,
        room_bg_image=room_bg_image,
        inventory=inventory,
        progress=savegame.progress_pct,
        objective=objective,
        unlocked=unlocked,
        victory=state.get("victory", False),
    )


@game_bp.get("/puzzle/<puzzle_code>")
def puzzle(puzzle_code):
    savegame, redirect_response = _ensure_savegame_or_redirect()
    if redirect_response:
        flash("Primero inicia o continúa una partida para acceder a este enigma.", "warning")
        return redirect_response

    puzzle_data = get_puzzle(puzzle_code)
    if not puzzle_data:
        flash("Enigma no encontrado.", "error")
        return redirect(url_for("game.room", room_code=savegame.current_room))

    puzzle_bg_image = url_for("static", filename="img/puzzle_chamber.svg")

    return render_template(
        "puzzle.html",
        puzzle=puzzle_data,
        puzzle_code=puzzle_code,
        puzzle_bg_image=puzzle_bg_image,
        progress=savegame.progress_pct,
        objective=_get_current_objective(savegame, puzzle_code=puzzle_code),
        inventory=list_inventory(savegame.player_id),
    )


@game_bp.get("/glyphs")
def glyphs_knowledge():
    player_id = _get_player_id()
    savegame = get_savegame(player_id) if player_id else None

    return render_template(
        "glyphs.html",
        glyphs=_build_glyph_glossary(),
        progress=savegame.progress_pct if savegame else 0,
        objective=_get_current_objective(savegame),
    )


@game_bp.post("/room/<room_code>/hunt-claim")
def claim_room_hunt(room_code):
    savegame, redirect_response = _ensure_savegame_or_redirect()
    if redirect_response:
        return redirect_response

    state = read_state(savegame)
    room_hunts = state.get("room_hunts", {})
    room_hunt = room_hunts.get(room_code)
    if not room_hunt:
        flash("Aún no hay una búsqueda activa en esta sala.", "warning")
        return redirect(url_for("game.room", room_code=room_code))

    if room_hunt.get("claimed"):
        flash("Ya reclamaste la recompensa de esta sala.", "info")
        return redirect(url_for("game.room", room_code=room_code))

    found_token = (request.form.get("found_token") or "").strip()
    if found_token != room_hunt.get("target_token"):
        flash("Debes encontrar el glifo objetivo antes de reclamar la recompensa.", "warning")
        return redirect(url_for("game.room", room_code=room_code))

    room_hunt["claimed"] = True
    room_hunts[room_code] = room_hunt
    state["room_hunts"] = room_hunts
    write_state(savegame, state)

    reward_code = f"glyph_note_{room_code}"
    add_item(
        savegame.player_id,
        reward_code,
        f"Registro de glifo: {room_hunt.get('target_label')}",
        f"Has identificado el glifo {room_hunt.get('target_glyph')} en {room_code}.",
    )
    update_progress(savegame, savegame.progress_pct + 4)
    log_event(savegame.player_id, "room_hunt_claimed", f"{room_code}:{found_token}")
    flash("¡Búsqueda completada! Has obtenido un registro de glifo y +4% de progreso.", "success")
    return redirect(url_for("game.room", room_code=room_code))


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
