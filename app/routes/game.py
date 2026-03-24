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

    room_layouts = {
        "archives": [
            {"name": "Atril de papiros", "x": 18, "y": 20, "hint": "Junto a los papiros antiguos.", "size": 1.0, "rotation": -3, "depth": 1},
            {"name": "Mesa de catalogación", "x": 49, "y": 24, "hint": "Sobre la mesa central del archivo.", "size": 1.05, "rotation": 1, "depth": 2},
            {"name": "Estante sellado", "x": 80, "y": 28, "hint": "Entre los estantes polvorientos.", "size": 0.96, "rotation": 4, "depth": 1},
            {"name": "Urna de arcilla", "x": 21, "y": 58, "hint": "Cerca de la urna en sombra.", "size": 0.9, "rotation": -5, "depth": 3},
            {"name": "Cofre ceremonial", "x": 56, "y": 66, "hint": "Frente al cofre tallado.", "size": 1.08, "rotation": 2, "depth": 2},
            {"name": "Lámpara votiva", "x": 83, "y": 74, "hint": "Bajo la luz temblorosa de una lámpara.", "size": 0.88, "rotation": -2, "depth": 4},
        ],
        "ritual": [
            {"name": "Obelisco menor", "x": 16, "y": 22, "hint": "Al pie del obelisco con ofrendas.", "size": 1.02, "rotation": -2, "depth": 1},
            {"name": "Pebetero", "x": 50, "y": 26, "hint": "Entre el humo del pebetero.", "size": 0.92, "rotation": 3, "depth": 2},
            {"name": "Relieve lunar", "x": 83, "y": 30, "hint": "Grabado en un relieve de la pared.", "size": 1.0, "rotation": 0, "depth": 1},
            {"name": "Cuenco de ofrendas", "x": 24, "y": 57, "hint": "Cerca de las ofrendas del altar.", "size": 0.9, "rotation": -4, "depth": 3},
            {"name": "Pilar grabado", "x": 54, "y": 63, "hint": "Tallado en el pilar central.", "size": 1.07, "rotation": 2, "depth": 2},
            {"name": "Máscara ritual", "x": 80, "y": 71, "hint": "Oculto junto a la máscara dorada.", "size": 0.95, "rotation": -1, "depth": 4},
        ],
        "sanctum": [
            {"name": "Trono del sanctum", "x": 14, "y": 24, "hint": "Cerca del trono protegido.", "size": 1.1, "rotation": -2, "depth": 1},
            {"name": "Disco solar", "x": 48, "y": 21, "hint": "Bajo el disco solar del techo.", "size": 1.05, "rotation": 3, "depth": 1},
            {"name": "Nicho del guardián", "x": 82, "y": 27, "hint": "Dentro de un nicho lateral.", "size": 0.94, "rotation": -5, "depth": 2},
            {"name": "Cáliz de ónice", "x": 22, "y": 59, "hint": "Junto al cáliz de ónice.", "size": 0.9, "rotation": 4, "depth": 3},
            {"name": "Sello real", "x": 57, "y": 67, "hint": "Sobre el sello real del santuario.", "size": 1.04, "rotation": 1, "depth": 2},
            {"name": "Sarcófago lateral", "x": 84, "y": 75, "hint": "A un lado del sarcófago.", "size": 0.92, "rotation": -3, "depth": 4},
        ],
    }
    default_layout = [
        {"name": "Altar", "x": 12, "y": 22, "hint": "Algo destaca junto al altar.", "size": 1.0, "rotation": 0, "depth": 1},
        {"name": "Vasija", "x": 50, "y": 18, "hint": "Observa la vasija más alta.", "size": 0.95, "rotation": -2, "depth": 1},
        {"name": "Pergamino", "x": 85, "y": 28, "hint": "Entre los pergaminos enrollados.", "size": 1.0, "rotation": 3, "depth": 2},
        {"name": "Estatua", "x": 20, "y": 58, "hint": "La estatua mira hacia un símbolo.", "size": 1.05, "rotation": -1, "depth": 3},
        {"name": "Cofre", "x": 55, "y": 65, "hint": "Cerca de un cofre cerrado.", "size": 1.08, "rotation": 2, "depth": 2},
        {"name": "Amuleto", "x": 82, "y": 72, "hint": "En la esquina yace un amuleto.", "size": 0.88, "rotation": -4, "depth": 4},
    ]
    room_layout = [dict(item) for item in room_layouts.get(room_code, default_layout)]

    rng = random.Random(f"hunt:{savegame.player_id}:{room_code}")
    rng.shuffle(room_layout)

    if len(candidate_tokens) >= len(room_layout):
        selected_tokens = rng.sample(candidate_tokens, len(room_layout))
    else:
        selected_tokens = [rng.choice(candidate_tokens) for _ in room_layout]

    target_token = rng.choice(selected_tokens)
    target_meta = token_map.get(target_token, {"glyph": target_token, "label": target_token})

    objects = []
    for index, layout in enumerate(room_layout):
        token = selected_tokens[index]
        meta = token_map.get(token, {"glyph": token, "label": token})
        objects.append(
            {
                "id": f"{room_code}-{index}",
                "name": layout.get("name") or f"Objeto {index + 1}",
                "token": token,
                "glyph": meta.get("glyph") or token,
                "label": meta.get("label") or token,
                "x": layout.get("x", 50),
                "y": layout.get("y", 50),
                "hint": layout.get("hint") or "No hay pista registrada.",
                "size": float(layout.get("size", 1.0)),
                "rotation": int(layout.get("rotation", 0)),
                "depth": int(layout.get("depth", 1)),
            }
        )

    room_hunts[room_code] = {
        "target_token": target_token,
        "target_glyph": target_meta.get("glyph") or target_token,
        "target_label": target_meta.get("label") or target_token,
        "objects": objects,
        "claimed": False,
        "wrong_attempts": 0,
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
        player_id=savegame.player_id,
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

    rooms = load_rooms()
    puzzle_room_code = next(
        (code for code, room in rooms.items() if room.get("puzzle_code") == puzzle_code),
        None,
    )
    if puzzle_room_code:
        state = read_state(savegame)
        room_hunt = state.get("room_hunts", {}).get(puzzle_room_code)
        if not room_hunt or not room_hunt.get("claimed"):
            flash("Debes completar la búsqueda de la sala antes de acceder a este enigma.", "warning")
            return redirect(url_for("game.room", room_code=puzzle_room_code))

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

    wrong_attempts = room_hunt.get("wrong_attempts", 0)
    room_hunt["claimed"] = True
    room_hunts[room_code] = room_hunt
    state["room_hunts"] = room_hunts
    write_state(savegame, state)

    if wrong_attempts == 0:
        add_item(
            savegame.player_id,
            f"glyph_insight_{room_code}",
            f"Visión de glifo: {room_hunt.get('target_label')}",
            f"Identificaste el glifo {room_hunt.get('target_glyph')} a la primera en {room_code}.",
        )
        update_progress(savegame, savegame.progress_pct + 6)
        log_event(savegame.player_id, "room_hunt_first_try", f"{room_code}:{found_token}")
        flash("¡Búsqueda perfecta! Encontraste el glifo a la primera. +6% de progreso y visión de glifo desbloqueada.", "success")
    else:
        update_progress(savegame, savegame.progress_pct + 2)
        log_event(savegame.player_id, "room_hunt_claimed", f"{room_code}:{found_token}")
        flash("Búsqueda completada. El enigma está desbloqueado. (+2% de progreso)", "info")

    return redirect(url_for("game.room", room_code=room_code))


@game_bp.post("/room/<room_code>/hunt-wrong")
def record_hunt_wrong(room_code):
    savegame, redirect_response = _ensure_savegame_or_redirect()
    if redirect_response:
        return ("", 403)

    state = read_state(savegame)
    room_hunts = state.get("room_hunts", {})
    room_hunt = room_hunts.get(room_code)
    if room_hunt and not room_hunt.get("claimed"):
        room_hunt["wrong_attempts"] = room_hunt.get("wrong_attempts", 0) + 1
        write_state(savegame, state)

    return ("", 204)


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
