import json

from app.extensions import db
from app.models import EventLog, Player, SaveGame


def create_new_game(player_name="Aprendiz"):
    player = Player(name=player_name)
    db.session.add(player)
    db.session.flush()

    savegame = SaveGame(
        player_id=player.id,
        current_room="archives",
        state=json.dumps(
            {
                "rooms_unlocked": ["archives"],
                "victory": False,
            }
        ),
        progress_pct=0,
    )
    db.session.add(savegame)
    db.session.add(
        EventLog(
            player_id=player.id,
            event_type="game_started",
            detail="New game created",
        )
    )
    db.session.commit()
    return player, savegame


def get_savegame(player_id):
    return SaveGame.query.filter_by(player_id=player_id).first()


def read_state(savegame):
    return json.loads(savegame.state or "{}")


def write_state(savegame, state):
    savegame.state = json.dumps(state)
    db.session.commit()


def update_progress(savegame, progress_pct):
    savegame.progress_pct = min(max(progress_pct, 0), 100)
    db.session.commit()


def log_event(player_id, event_type, detail):
    db.session.add(EventLog(player_id=player_id, event_type=event_type, detail=detail))
    db.session.commit()
