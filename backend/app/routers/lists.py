"""Listas: CRUD com autorização por dono; privadas só visíveis ao dono."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.deps import DB, Catalog, CurrentUser, OptionalUser, require_feature
from app.models import ListItem, UserList, utcnow
from app.schemas import ListIn, ListItemIn, ListUpdateIn
from app.serializers import list_out
from app.services import social

router = APIRouter(prefix="/api/lists", tags=["listas"])


def _visible(db, list_id: int, me) -> UserList:
    lst = db.get(UserList, list_id)
    # Lista privada de outra pessoa responde 404 (não revela que existe)
    if not lst or (not lst.is_public and (not me or me.id != lst.user_id)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lista não encontrada.")
    return lst


def _owned(db, list_id: int, me) -> UserList:
    lst = _visible(db, list_id, me)
    if lst.user_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só quem criou a lista pode alterá-la.")
    return lst


@router.get("")
def public_lists(db: DB, me: OptionalUser, limit: int = Query(12, ge=1, le=50)):
    stmt = (
        select(UserList)
        .join(ListItem, ListItem.list_id == UserList.id)
        .where(UserList.is_public)
        .group_by(UserList.id)
        .having(func.count(ListItem.id) > 0)
        .order_by(UserList.updated_at.desc())
        .limit(limit)
    )
    return {"results": [list_out(db, lst, me) for lst in db.scalars(stmt).unique()]}


@router.get("/mine")
def my_lists(db: DB, me: CurrentUser, title_id: int | None = None):
    lists = db.scalars(select(UserList).where(UserList.user_id == me.id).order_by(UserList.updated_at.desc()))
    out = []
    for lst in lists.unique():
        d = list_out(db, lst, me)
        if title_id is not None:
            d["has_title"] = any(i.title_id == title_id for i in lst.items)
        out.append(d)
    return {"results": out}


@router.post("", status_code=201)
def create_list(data: ListIn, db: DB, me: CurrentUser):
    if data.is_public:
        require_feature(me, "public_list")
    lst = UserList(user_id=me.id, name=data.name.strip(), description=data.description.strip(), is_public=data.is_public)
    db.add(lst)
    db.flush()
    social.record(db, me, "list_created", list_id=lst.id)
    db.commit()
    db.refresh(lst)
    return list_out(db, lst, me, full=True)


@router.get("/{list_id}")
def get_list(list_id: int, db: DB, me: OptionalUser):
    return list_out(db, _visible(db, list_id, me), me, full=True)


@router.patch("/{list_id}")
def update_list(list_id: int, data: ListUpdateIn, db: DB, me: CurrentUser):
    lst = _owned(db, list_id, me)
    if data.name is not None:
        lst.name = data.name.strip()
    if data.description is not None:
        lst.description = data.description.strip()
    if data.is_public is not None:
        if data.is_public and not lst.is_public:
            require_feature(me, "public_list")
        lst.is_public = data.is_public
    db.commit()
    return list_out(db, lst, me, full=True)


@router.delete("/{list_id}", status_code=204)
def delete_list(list_id: int, db: DB, me: CurrentUser):
    db.delete(_owned(db, list_id, me))
    db.commit()


@router.post("/{list_id}/items", status_code=201)
def add_item(list_id: int, data: ListItemIn, cat: Catalog, db: DB, me: CurrentUser):
    lst = _owned(db, list_id, me)
    if not cat.get(data.title_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Título não encontrado.")
    if any(i.title_id == data.title_id for i in lst.items):
        return list_out(db, lst, me, full=True)
    pos = max((i.position for i in lst.items), default=-1) + 1
    lst.items.append(ListItem(title_id=data.title_id, position=pos))
    lst.updated_at = utcnow()
    db.flush()
    social.record(db, me, "list_item", list_id=lst.id, title_id=data.title_id)
    db.commit()
    db.refresh(lst)
    return list_out(db, lst, me, full=True)


@router.delete("/{list_id}/items/{title_id}")
def remove_item(list_id: int, title_id: int, db: DB, me: CurrentUser):
    lst = _owned(db, list_id, me)
    lst.items = [i for i in lst.items if i.title_id != title_id]
    social.unrecord(db, me, "list_item", list_id=lst.id, title_id=title_id)
    db.commit()
    db.refresh(lst)
    return list_out(db, lst, me, full=True)
