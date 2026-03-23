from app.models import InventoryItem, PuzzleState, SaveGame


def start_game(client):
    return client.post("/new-game", data={"player_name": "Tester"}, follow_redirects=True)


def test_index_loads(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Nueva Partida" in response.data.decode("utf-8")


def test_new_game_creates_savegame(client, app):
    start_game(client)
    with app.app_context():
        assert SaveGame.query.count() == 1


def test_room_requires_session(client):
    response = client.get("/room/archives")
    assert response.status_code in (301, 302)


def test_puzzle_wrong_answer_increments_attempts(client, app):
    start_game(client)
    client.post(
        "/puzzle/glyph_translator/submit",
        data={"answer": "wrong answer"},
        follow_redirects=True,
    )
    with app.app_context():
        state = PuzzleState.query.filter_by(puzzle_code="glyph_translator").first()
        assert state is not None
        assert state.attempts == 1
        assert state.solved is False


def test_puzzle_success_adds_inventory_item(client, app):
    start_game(client)
    client.post(
        "/puzzle/glyph_translator/submit",
        data={"answer": "life reed owl water"},
        follow_redirects=True,
    )
    with app.app_context():
        item = InventoryItem.query.filter_by(code="tablet_fragment").first()
        savegame = SaveGame.query.first()
        assert item is not None
        assert savegame.progress_pct >= 30


def test_admin_reset_clears_current_game(client, app):
    start_game(client)
    client.post("/admin/reset", follow_redirects=True)
    with app.app_context():
        assert SaveGame.query.count() == 0


def test_request_hint_reduces_progress(client, app):
    start_game(client)
    client.post(
        "/puzzle/glyph_translator/submit",
        data={"answer": "life reed owl water"},
        follow_redirects=True,
    )
    with app.app_context():
        savegame = SaveGame.query.first()
        assert savegame.progress_pct >= 30

    client.post("/puzzle/ritual_sequence/hint", follow_redirects=True)
    with app.app_context():
        savegame = SaveGame.query.first()
        assert savegame.progress_pct == 25


def test_admin_editor_updates_rooms_json(client):
    response = client.post(
        "/admin/editor/rooms",
        data={
            "rooms_json": '{"archives": {"title": "A", "description": "B", "clues": [], "links": []}}'
        },
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"Salas actualizadas correctamente" in response.data


def test_admin_editor_rejects_invalid_json(client):
    response = client.post(
        "/admin/editor/puzzles",
        data={"puzzles_json": "{invalid_json"},
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert "Formato JSON" in response.data.decode("utf-8")


def test_glyph_puzzle_renders_tablet_hotspots(client):
    start_game(client)
    response = client.get("/puzzle/glyph_translator")
    assert response.status_code == 200
    assert b"tablet-board" in response.data
    assert b'data-token="life"' in response.data
    assert b'data-strict-sequence="true"' in response.data
    assert "Pulsa los s" in response.data.decode("utf-8")


def test_ritual_puzzle_renders_hard_mode_and_spot_hints(client):
    start_game(client)
    response = client.get("/puzzle/ritual_sequence")
    assert response.status_code == 200
    assert b'data-sequence-mode="hard"' in response.data
    assert b"data-spot-hint" in response.data
