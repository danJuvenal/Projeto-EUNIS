"""Seed opcional da comunidade de demonstração (só desenvolvimento).

    uv run python -m app.seed

Cria as 3 pessoas do MVP como contas `is_demo=True` — a interface sempre mostra o selo "demo".
As senhas são aleatórias e não são exibidas: contas demo não servem para login.
Idempotente: não duplica nada se rodar de novo. Não roda em produção.
"""

import secrets
import sys
from datetime import timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db import SessionLocal
from app.main import prepare_database
from app.models import Comment, Follow, LibraryEntry, ListItem, Review, Title, User, UserList, utcnow
from app.services import social

PEOPLE = [
    ("julia.demo", "Júlia Prado", 330, "Escolho filme para dois. É mais difícil do que parece.", ["romance", "ficcao-cientifica"]),
    ("pedro.demo", "Pedro Lemos", 200, "Faço lista de tudo. Assisto metade.", ["suspense", "ficcao-cientifica", "drama"]),
    ("mariana.demo", "Mariana Reis", 25, "Série boa é a que dorme comigo.", ["comedia", "animacao", "drama"]),
]

# (usuário, título demo, nota 1..10, crítica) — notas do MVP convertidas de 1–5 para meias estrelas
REVIEWS = [
    ("julia.demo", "c05", 10, "Assisti achando que ia ser só pancadaria e chorei duas vezes."),
    ("julia.demo", "c08", 8, ""),
    ("pedro.demo", "c01", 10, "O plano da escada diz tudo o que o filme quer dizer sem falar nada."),
    ("pedro.demo", "c16", 10, "A trilha e o corredor branco me deixaram com raiva do meu próprio escritório."),
    ("pedro.demo", "c13", 8, ""),
    ("mariana.demo", "c14", 10, "Quebra a quarta parede e quebra você junto."),
    ("mariana.demo", "c30", 8, ""),
    ("pedro.demo", "c04", 8, "Segundo ato no trem é aula de tensão em espaço fechado."),
    ("julia.demo", "c27", 10, "Colocaria de novo só pelo som. Fim do mundo nunca foi tão bonito."),
]

COMMENTS = [("mariana.demo", ("pedro.demo", "c16"), "Assisti numa segunda-feira. Erro.")]

LISTS = [
    ("pedro.demo", "Fim do mundo com boa fotografia", "Apocalipse, mas bonito.", ["c04", "c05", "c27", "c31"]),
    ("julia.demo", "Para assistir a dois sem discussão", "Testado em campo.", ["c08", "c20", "c26", "c14"]),
]

FOLLOWS = [("julia.demo", "pedro.demo"), ("pedro.demo", "mariana.demo"), ("mariana.demo", "julia.demo")]


def run() -> None:
    if get_settings().is_production:
        sys.exit("Seed de demonstração não roda em produção.")
    prepare_database()
    with SessionLocal() as db:
        from app.models import Genre

        genres = {g.slug: g for g in db.scalars(select(Genre))}
        titles = {t.external_key.removeprefix("demo:"): t for t in db.scalars(select(Title).where(Title.source == "demo"))}
        if not titles:
            sys.exit("Catálogo demo ausente (TMDB_API_KEY configurada?). O seed usa os títulos demo.")

        users: dict[str, User] = {}
        for username, name, hue, bio, favs in PEOPLE:
            u = db.scalar(select(User).where(User.username == username))
            if u is None:
                u = User(
                    username=username,
                    name=name,
                    email=f"{username}@demo.eunis.invalid",
                    password_hash=hash_password(secrets.token_urlsafe(24)),
                    bio=bio,
                    avatar_hue=hue,
                    is_demo=True,
                    onboarded=True,
                    favorite_genres=[genres[s] for s in favs],
                )
                db.add(u)
                db.flush()
            users[username] = u

        base = utcnow() - timedelta(days=6)
        for i, (username, key, rating, body) in enumerate(REVIEWS):
            u, t = users[username], titles[key]
            if db.scalar(select(Review).where(Review.user_id == u.id, Review.title_id == t.id)):
                continue
            when = base + timedelta(hours=11 * i)
            r = Review(user_id=u.id, title_id=t.id, rating=rating, body=body, created_at=when, updated_at=when)
            db.add(r)
            db.merge(LibraryEntry(user_id=u.id, title_id=t.id, watched=True, watched_at=when, favorite=rating == 10))
            db.flush()
            social.record(db, u, "review", title_id=t.id, review_id=r.id)
            db.flush()

        for username, (author, key), body in COMMENTS:
            r = db.scalar(select(Review).where(Review.user_id == users[author].id, Review.title_id == titles[key].id))
            if r and not db.scalar(select(Comment).where(Comment.review_id == r.id, Comment.user_id == users[username].id)):
                db.add(Comment(review_id=r.id, user_id=users[username].id, body=body))

        for username, name, desc, keys in LISTS:
            u = users[username]
            if db.scalar(select(UserList).where(UserList.user_id == u.id, UserList.name == name)):
                continue
            lst = UserList(user_id=u.id, name=name, description=desc, is_public=True)
            lst.items = [ListItem(title_id=titles[k].id, position=i) for i, k in enumerate(keys)]
            db.add(lst)
            db.flush()
            social.record(db, u, "list_created", list_id=lst.id)

        for a, b in FOLLOWS:
            if not db.get(Follow, (users[a].id, users[b].id)):
                db.add(Follow(follower_id=users[a].id, followee_id=users[b].id))

        db.commit()
        print(f"Comunidade demo pronta: {len(users)} contas demo, {len(REVIEWS)} críticas, {len(LISTS)} listas.")


if __name__ == "__main__":
    run()
