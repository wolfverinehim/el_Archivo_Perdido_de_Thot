from app.extensions import db
from app.models import PuzzleState
from app.services.content_service import load_puzzles


def get_puzzle(code):
    puzzles = load_puzzles()
    return puzzles.get(code)


def get_or_create_puzzle_state(player_id, puzzle_code):
    state = PuzzleState.query.filter_by(
        player_id=player_id,
        puzzle_code=puzzle_code,
    ).first()
    if state:
        return state

    state = PuzzleState(player_id=player_id, puzzle_code=puzzle_code)
    db.session.add(state)
    db.session.commit()
    return state


def submit_puzzle_answer(player_id, puzzle_code, answer):
    puzzle = get_puzzle(puzzle_code)
    if not puzzle:
        return {"ok": False, "reason": "Puzzle not found"}

    state = get_or_create_puzzle_state(player_id, puzzle_code)
    state.attempts += 1
    state.last_response = answer

    normalized = (answer or "").strip().lower()
    expected = puzzle["expected_answer"].strip().lower()

    if normalized == expected:
        state.solved = True
        db.session.commit()
        return {
            "ok": True,
            "reward": puzzle.get("reward"),
            "progress": puzzle.get("progress", 0),
            "unlock_room": puzzle.get("unlock_room"),
            "victory": puzzle.get("victory", False),
        }

    db.session.commit()
    return {"ok": False, "reason": "Wrong answer", "attempts": state.attempts}
