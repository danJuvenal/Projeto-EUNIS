"""Presença online em tempo real (D-012).

- Cada aba abre um WebSocket em /api/ws/presence. A identidade vem do cookie de sessão,
  nunca de dados enviados pelo cliente — ninguém altera a presença de outra pessoa.
- O cliente manda um heartbeat a cada ~25 s com a atividade atual (tipo + id de título).
  O servidor monta o texto da atividade a partir do banco; o cliente não envia texto livre.
- Uma varredura a cada 10 s derruba conexões sem heartbeat há mais de
  PRESENCE_TIMEOUT_SECONDS — não dependemos do evento de fechar a aba.
- Usuários com `show_online = false` ficam invisíveis (mas continuam recebendo atualizações).
- Estado em memória: vale para uma instância. Para escalar horizontalmente, trocar por Redis pub/sub.
"""

from __future__ import annotations

import contextlib
import logging
import time
from dataclasses import dataclass, field

from fastapi import WebSocket

log = logging.getLogger("eunis.presence")


@dataclass
class Conn:
    ws: WebSocket
    user_id: int | None
    last_beat: float = field(default_factory=time.monotonic)


@dataclass
class UserPresence:
    user_id: int
    username: str
    name: str
    avatar_hue: int
    is_demo: bool
    visible: bool
    since: float
    activity: dict = field(default_factory=lambda: {"kind": "browsing", "label": "Navegando"})
    conns: int = 0
    last_db_write: float = 0.0


class PresenceHub:
    def __init__(self, timeout: float = 70):
        self.timeout = timeout
        self.conns: dict[int, Conn] = {}  # id(ws) → Conn
        self.users: dict[int, UserPresence] = {}
        self._dirty = False
        # Tudo roda no event loop único e as seções críticas não têm await: sem lock.

    # ---------- leitura (segura a partir de threads)

    def is_visible_online(self, user_id: int) -> bool:
        p = self.users.get(user_id)
        return bool(p and p.visible and p.conns > 0)

    def snapshot(self) -> list[dict]:
        now = time.monotonic()
        items = [
            {
                "user": {
                    "id": p.user_id,
                    "username": p.username,
                    "name": p.name,
                    "avatar_hue": p.avatar_hue,
                    "is_demo": p.is_demo,
                },
                "activity": p.activity,
                "online_for_s": int(now - p.since),
            }
            for p in list(self.users.values())
            if p.visible and p.conns > 0
        ]
        items.sort(key=lambda x: x["online_for_s"])
        return items

    def message(self) -> dict:
        snap = self.snapshot()
        return {"type": "presence", "count": len(snap), "users": snap}

    # ---------- escrita

    def mark_dirty(self) -> None:
        self._dirty = True

    def update_user_info(self, user) -> None:
        """Chamado quando o perfil/privacidade muda (de rotas síncronas)."""
        p = self.users.get(user.id)
        if p:
            p.name, p.username, p.avatar_hue = user.name, user.username, user.avatar_hue
            p.visible = user.show_online
            self._dirty = True

    async def connect(self, ws: WebSocket, user) -> Conn:
        conn = Conn(ws=ws, user_id=user.id if user else None)
        self.conns[id(ws)] = conn
        if user:
            p = self.users.get(user.id)
            if p is None:
                p = UserPresence(
                    user_id=user.id,
                    username=user.username,
                    name=user.name,
                    avatar_hue=user.avatar_hue,
                    is_demo=user.is_demo,
                    visible=user.show_online,
                    since=time.monotonic(),
                )
                self.users[user.id] = p
            p.conns += 1
        if user:
            await self.broadcast()
        else:
            await self._send(conn, self.message())
        return conn

    async def disconnect(self, ws: WebSocket) -> int | None:
        """Remove a conexão. Retorna o user_id se o usuário ficou offline."""
        went_offline = None
        conn = self.conns.pop(id(ws), None)
        if conn and conn.user_id is not None:
            p = self.users.get(conn.user_id)
            if p:
                p.conns -= 1
                if p.conns <= 0:
                    self.users.pop(conn.user_id, None)
                    went_offline = conn.user_id
        if went_offline is not None:
            await self.broadcast()
        return went_offline

    async def beat(self, ws: WebSocket, activity: dict | None) -> bool:
        """Registra heartbeat. Retorna True se é hora de gravar last_seen no banco."""
        conn = self.conns.get(id(ws))
        if not conn:
            return False
        conn.last_beat = time.monotonic()
        if conn.user_id is None:
            return False
        p = self.users.get(conn.user_id)
        if not p:
            return False
        if activity and activity != p.activity:
            p.activity = activity
            self._dirty = True
        if conn.last_beat - p.last_db_write > 60:
            p.last_db_write = conn.last_beat
            return True
        return False

    async def sweep(self) -> list[int]:
        """Derruba conexões sem heartbeat. Retorna usuários que ficaram offline."""
        now = time.monotonic()
        stale = [c for c in list(self.conns.values()) if now - c.last_beat > self.timeout]
        offline = []
        for c in stale:
            with contextlib.suppress(Exception):
                await c.ws.close(code=4000)
            uid = await self.disconnect(c.ws)
            if uid is not None:
                offline.append(uid)
        if self._dirty:
            self._dirty = False
            await self.broadcast()
        return offline

    async def broadcast(self) -> None:
        msg = self.message()
        for conn in list(self.conns.values()):
            await self._send(conn, msg)

    async def _send(self, conn: Conn, msg: dict) -> None:
        try:
            await conn.ws.send_json(msg)
        except Exception:  # conexão já morta; a varredura/disconnect limpa
            log.debug("falha ao enviar presença", exc_info=True)


hub = PresenceHub()
