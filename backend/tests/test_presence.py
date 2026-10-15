import asyncio
import time

import pytest

from app.services.presence import PresenceHub, hub
from tests.conftest import register


def test_usuario_logado_aparece_online_e_sai_ao_desconectar(client):
    register(client, "ana")
    with client.websocket_connect("/api/ws/presence") as ws:
        msg = ws.receive_json()
        assert msg["count"] == 1
        assert msg["users"][0]["user"]["username"] == "ana"
        assert "email" not in msg["users"][0]["user"]
        assert client.get("/api/presence/online").json()["count"] == 1
    assert client.get("/api/presence/online").json()["count"] == 0


def test_atividade_e_montada_pelo_servidor(client):
    register(client, "ana")
    tid = client.get("/api/titles", params={"q": "Duna"}).json()["results"][0]["id"]
    with client.websocket_connect("/api/ws/presence") as ws:
        ws.receive_json()
        ws.send_json({"type": "beat", "activity": {"kind": "title", "title_id": tid}})
        ws.send_json({"type": "beat", "activity": {"kind": "<script>", "label": "texto livre"}})
        ws.send_json({"type": "beat", "activity": {"kind": "title", "title_id": tid}})
        time.sleep(0.1)
        users = client.get("/api/presence/online").json()["users"]
        assert users[0]["activity"]["label"] == "Vendo Duna"


def test_visitante_anonimo_recebe_lista_mas_nao_aparece(client):
    with client.websocket_connect("/api/ws/presence") as ws:
        assert ws.receive_json()["count"] == 0
        assert client.get("/api/presence/online").json()["count"] == 0


def test_status_oculto_respeita_privacidade(client):
    register(client, "ana")
    client.patch("/api/auth/me", json={"show_online": False})
    with client.websocket_connect("/api/ws/presence") as ws:
        assert ws.receive_json()["count"] == 0
        assert client.get("/api/users/ana").json()["online"] is False


def test_origem_desconhecida_e_recusada(client):
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/ws/presence", headers={"origin": "http://malicioso.example"}) as ws:
            ws.receive_json()


class FakeWS:
    def __init__(self):
        self.closed = False
        self.sent = []

    async def send_json(self, msg):
        self.sent.append(msg)

    async def close(self, code=1000):
        self.closed = True


class FakeUser:
    id, username, name, avatar_hue, is_demo, show_online = 1, "ana", "Ana", 10, False, True


def test_varredura_derruba_conexao_sem_heartbeat():
    async def scenario():
        h = PresenceHub(timeout=0.05)
        ws = FakeWS()
        await h.connect(ws, FakeUser())
        assert h.is_visible_online(1)
        await asyncio.sleep(0.1)
        offline = await h.sweep()
        assert offline == [1]
        assert ws.closed and not h.is_visible_online(1)

    asyncio.run(scenario())


def test_varias_abas_contam_como_uma_pessoa():
    async def scenario():
        h = PresenceHub()
        w1, w2 = FakeWS(), FakeWS()
        await h.connect(w1, FakeUser())
        await h.connect(w2, FakeUser())
        assert len(h.snapshot()) == 1
        assert await h.disconnect(w1) is None  # ainda tem outra aba
        assert await h.disconnect(w2) == 1

    asyncio.run(scenario())


def test_hub_global_limpo_entre_testes():
    assert hub.snapshot() == []
