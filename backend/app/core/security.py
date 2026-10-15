"""Hash de senha (scrypt, stdlib) e tokens de sessão opacos."""

import base64
import hashlib
import hmac
import secrets

# Parâmetros scrypt (OWASP: N=2^17, r=8, p=1). maxmem ajustado para N*r*128*2.
_N, _R, _P, _DKLEN = 2**17, 8, 1, 32
_MAXMEM = 2 * _N * _R * 128 + 1024 * 1024


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=_N, r=_R, p=_P, dklen=_DKLEN, maxmem=_MAXMEM
    )
    return f"scrypt${_N}${_R}${_P}${_b64(salt)}${_b64(dk)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, n, r, p, salt_b64, dk_b64 = stored.split("$")
        if algo != "scrypt":
            return False
        n_i, r_i, p_i = int(n), int(r), int(p)
        expected = base64.b64decode(dk_b64)
        dk = hashlib.scrypt(
            password.encode("utf-8"),
            salt=base64.b64decode(salt_b64),
            n=n_i,
            r=r_i,
            p=p_i,
            dklen=len(expected),
            maxmem=2 * n_i * r_i * 128 + 1024 * 1024,
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(dk, expected)


# Usado para igualar o tempo de resposta quando o e-mail não existe (evita enumeração de contas)
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
