from fastapi import Request

from exceptions import AuthenticationError

# TODO(TKT-BE-M4-03): 임시 인증. M3에서는 시드 회원 ID를 요청 헤더로 받는다(D-001).
# M4에서 JWT·쿠키 검증(SEQ-03)으로 바꾸고 이 헤더 코드는 지운다.
_DEBUG_USER_HEADER = "X-Debug-User-Id"


async def get_current_user_id(request: Request) -> int:
    raw = request.headers.get(_DEBUG_USER_HEADER)
    if raw is None or not raw.isdigit():
        raise AuthenticationError()
    return int(raw)
