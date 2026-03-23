from app.extensions import db
from app.models import InventoryItem


def list_inventory(player_id):
    return (
        InventoryItem.query.filter_by(player_id=player_id, active=True)
        .order_by(InventoryItem.id.asc())
        .all()
    )


def has_item(player_id, code):
    return (
        InventoryItem.query.filter_by(player_id=player_id, code=code, active=True).first()
        is not None
    )


def add_item(player_id, code, name, description):
    existing = InventoryItem.query.filter_by(
        player_id=player_id,
        code=code,
        active=True,
    ).first()
    if existing:
        return existing

    item = InventoryItem(
        player_id=player_id,
        code=code,
        name=name,
        description=description,
        active=True,
    )
    db.session.add(item)
    db.session.commit()
    return item
