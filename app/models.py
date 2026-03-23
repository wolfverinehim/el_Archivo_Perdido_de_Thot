from datetime import UTC, datetime

from sqlalchemy import Text

from app.extensions import db


def utc_now():
    return datetime.now(UTC)


class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    started_at = db.Column(db.DateTime, default=utc_now, nullable=False)


class SaveGame(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"), nullable=False)
    current_room = db.Column(db.String(40), nullable=False, default="archives")
    state = db.Column(Text, nullable=False, default="{}")
    progress_pct = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(
        db.DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class InventoryItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"), nullable=False)
    code = db.Column(db.String(40), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    active = db.Column(db.Boolean, nullable=False, default=True)
    obtained_at = db.Column(db.DateTime, default=utc_now, nullable=False)


class PuzzleState(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"), nullable=False)
    puzzle_code = db.Column(db.String(40), nullable=False)
    solved = db.Column(db.Boolean, nullable=False, default=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    last_response = db.Column(db.String(255), nullable=True)


class EventLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"), nullable=False)
    event_type = db.Column(db.String(50), nullable=False)
    detail = db.Column(Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=utc_now, nullable=False)
