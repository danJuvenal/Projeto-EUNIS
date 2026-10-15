"""Críticas: leitura, exclusão (só autor), curtidas e comentários."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.deps import DB, CurrentUser, OptionalUser, require_feature
from app.models import Comment, Review, ReviewLike
from app.schemas import CommentIn
from app.serializers import comment_out, review_out

router = APIRouter(prefix="/api", tags=["críticas"])


def _review(db, review_id: int) -> Review:
    r = db.get(Review, review_id)
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Crítica não encontrada.")
    return r


@router.get("/reviews")
def recent_reviews(
    db: DB,
    me: OptionalUser,
    with_text: bool = True,
    limit: int = Query(20, ge=1, le=50),
):
    stmt = select(Review).order_by(Review.created_at.desc())
    if with_text:
        stmt = stmt.where(Review.body != "")
    return {"results": review_out(db, list(db.scalars(stmt.limit(limit)).unique()), me, with_title=True)}


@router.get("/reviews/{review_id}")
def get_review(review_id: int, db: DB, me: OptionalUser):
    return review_out(db, [_review(db, review_id)], me, with_title=True)[0]


@router.delete("/reviews/{review_id}", status_code=204)
def delete_review(review_id: int, db: DB, me: CurrentUser):
    r = _review(db, review_id)
    if r.user_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Você só pode excluir as suas críticas.")
    db.delete(r)
    db.commit()


@router.put("/reviews/{review_id}/like")
def like(review_id: int, db: DB, me: CurrentUser):
    _review(db, review_id)
    if not db.get(ReviewLike, (me.id, review_id)):
        db.add(ReviewLike(user_id=me.id, review_id=review_id))
        db.commit()
    return review_out(db, [_review(db, review_id)], me)[0]


@router.delete("/reviews/{review_id}/like")
def unlike(review_id: int, db: DB, me: CurrentUser):
    lk = db.get(ReviewLike, (me.id, review_id))
    if lk:
        db.delete(lk)
        db.commit()
    return review_out(db, [_review(db, review_id)], me)[0]


@router.get("/reviews/{review_id}/comments")
def comments(review_id: int, db: DB, me: OptionalUser):
    _review(db, review_id)
    rows = db.scalars(select(Comment).where(Comment.review_id == review_id).order_by(Comment.created_at)).unique()
    return {"results": [comment_out(c, me) for c in rows]}


@router.post("/reviews/{review_id}/comments", status_code=201)
def add_comment(review_id: int, data: CommentIn, db: DB, me: CurrentUser):
    require_feature(me, "comment")
    _review(db, review_id)
    c = Comment(review_id=review_id, user_id=me.id, body=data.body)
    db.add(c)
    db.commit()
    db.refresh(c)
    return comment_out(c, me)


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, db: DB, me: CurrentUser):
    c = db.get(Comment, comment_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comentário não encontrado.")
    if c.user_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Você só pode excluir os seus comentários.")
    db.delete(c)
    db.commit()

