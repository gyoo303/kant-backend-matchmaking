from logging import exception
from errno import errorcode
from fastapi import Depends
import asyncio
import logging
from collections import deque # 최근 채팅을 처리한 시각을 보관
from collections.abc import Callable
from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from pydantic import Field, TypeAdapter, ValidationError
from exceptions import AuthenticationError, DomainError
from container import Container

from rooms.application.realtime import (
    RealtimeParticipant,
    RoomRealtimeService,
    CloseConnection,
    SendMessage,
)

from rooms.presentation.schemas import (
    RoomWebSocketAuth,
    RoomWebSocketChat,
    RoomWebSocketPing,
    RoomWebSocketPong,
)

# 방 WebSocket 경로를 등록할 라우터를 준비
router = APIRouter()

# 연결 처리 실패의 종류를 기록할 로거를 준비
logger = logging.getLogger(__name__)

# 인증 이후 받을 메시지를 type 필드로 구분
RoomWebSocketClientMessage = Annotated[
    RoomWebSocketChat | RoomWebSocketPing | RoomWebSocketPong,
    Field(discriminator='type'),
]

# JSON 메시지를 해당 스키마로 검사할 객체를 준비
_client_message_adapter = TypeAdapter(RoomWebSocketClientMessage)

# 수신 메시지의 UTF-8 크기를 제한
MAX_MESSAGE_BYTES = 4096

# 최초 메시지 수신과 인증 처리의 최대 시간을 제한
AUTH_TIMEOUT_SECONDS = 5

# 소켓 전송과 종료 작업의 최대 시간을 제한
SEND_TIMEOUT_SECONDS = 5

# 입력 대기와 무응답 연결의 정리 기준을 정함
HEARTBEAT_INTERVAL_SECONDS = 30
IDLE_TIMEOUT_SECONDS = 90

# 연결별 채팅 처리 횟수를 제한
CHAT_RATE_LIMIT = 3
CHAT_RATE_WINDOW_SECONDS = 1.0

# 수신 형식 오류를 소켓 종료 코드와 함께 전달
class _MessageError(Exception):
    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

# 연결을 요청한 페이지의 출처가 허용 목록에 있는지 확인
def _is_allowed_origin(
    websocket: WebSocket,
    allowed_origins: list[str],
) -> bool:
    origin = websocket.headers.get('origin')

    # 출처를 확인할 수 없는 요청을 거부
    if not origin or origin == 'null':
        return False

    return origin in allowed_origins

# 연결 종료와 입력 제한을 확인한 뒤 텍스트를 반환
async def _receive_text(websocket: WebSocket) -> str:
    message = await websocket.receive()

    # 상대가 연결을 종료했으면 수신 처리를 중단
    if message['type'] == 'websocket.disconnect':
        raise WebSocketDisconnect(code=message.get('code', 1000))
        
    # 바이너리 메시지는 받지 않음
    text = message.get('text')
    if text is None:
        raise _MessageError(1003, '텍스트 메시지만 사용할 수 있습니다')
        
    # JSON을 해석하기 전에 UTF-8 바이트 크기를 검사
    if len(text.encode('utf-8')) > MAX_MESSAGE_BYTES:
        raise _MessageError(1009, '메시지가 너무 큽니다')
        
    return text

# 최초 메시지로 회원을 인증하고 현재 참가 정보를 받음
async def _authenticate_connection(
    websocket: WebSocket,
    room_id: int,
    service: RoomRealtimeService,
) -> tuple[str, RealtimeParticipant]:
    # 메시지 수신과 인증이 제한 시간 안에 끝나도록 함
    async with asyncio.timeout(AUTH_TIMEOUT_SECONDS):
        # 첫 메시지가 인증 메시지 형식인지 검사
        text = await _receive_text(websocket)
        auth_message = RoomWebSocketAuth.model_validate_json(text)

        # 기존 응용 서비스로 토큰과 현재 참가를 확인
        token = auth_message.token.get_secret_value()
        participant = await service.authenticate(room_id, token)

    return token, participant

# 해당 소켓과 전송 잠금을 사용할 종료 함수를 만듦
def _make_close_callback(
    websocket: WebSocket,
    socket_lock: asyncio.Lock,
) -> CloseConnection:
    # 진행 중인 전송과 겹치지 않도록 소켓을 닫음
    async def close(code: int, reason: str) -> None:
        async with asyncio.timeout(SEND_TIMEOUT_SECONDS):
            async with socket_lock:
                # 이미 종료한 소켓에는 종료 요청을 반복하지 않음
                if websocket.application_state == WebSocketState.DISCONNECTED:
                    return
                
                await websocket.close(code=code, reason=reason)
    
    return close

# 수신자의 인증과 참가 상태를 확인할 전송 함수를 만듦
def _make_send_callback(
    websocket: WebSocket,
    socket_lock: asyncio.Lock,
    participant: RealtimeParticipant,
    token: str,
    service: RoomRealtimeService,
    close: CloseConnection,
) -> SendMessage:
    # 현재 참가 자격이 있는 연결에만 메시지를 보냄
    async def send(message: dict[str, object]) -> None:
        async with asyncio.timeout(SEND_TIMEOUT_SECONDS):
            # 이 연결의 회원이 지금도 같은 참가에 속하는지 확인
            try:
                await service.ensure_current_participant(participant, token)
            except AuthenticationError:
                await close(4401, "인증이 유효하지 않습니다")
                raise
            except DomainError:
                await close(4403, '이 방의 참가 상태가 유효하지 않습니다')
                raise

            # 종료 작업과 실제 메시지 전송이 겹치지 않도록 함
            async with socket_lock:
                if websocket.application_state != WebSocketState.CONNECTED:
                    raise WebSocketDisconnect(code=1000)
                
                await websocket.send_json(message)
        
    return send

# 해당 연결에서 사용할 실시간 응용 서비스를 받음
@inject
def get_realtime_service(
    factory: Callable[..., RoomRealtimeService] = Depends(
        Provide[Container.room_realtime_service.provider]
    ),
) -> RoomRealtimeService:
    return factory()

# 연결 요청의 출처 검사에 사용할 허용 목록을 받음
@inject
def get_allowed_origins(
    origins: list[str] = Depends(Provide[Container.config.cors_origins]),
) -> list[str]:
    return origins

#인증한 연결의 채팅과 연결 확인 메시지를 계속 처리
async def _receive_messages(
    websocket: WebSocket,
    participant: RealtimeParticipant,
    token: str,
    service: RoomRealtimeService,
    send: SendMessage,
) -> None:
    # 시간 간격과 최근 채팅 처리 시각을 관리
    loop = asyncio.get_running_loop()
    last_received = loop.time()
    chat_times: deque[float] = deque()

    while True:
        # 마지막 입력 이후 남은 대기 시간을 계산
        remaining = IDLE_TIMEOUT_SECONDS - (loop.time() - last_received)
        if remaining <= 0:
            raise _MessageError(1001, '연결 확인 응답이 없습니다')
        
        # 입력이 없으면 연결 확인 메시지를 보냄
        try:
            async with asyncio.timeout(
                min(HEARTBEAT_INTERVAL_SECONDS, remaining)
            ):
                text = await _receive_text(websocket)
        except TimeoutError:
            if loop.time() - last_received >= IDLE_TIMEOUT_SECONDS:
                raise _MessageError(1001, '연결 확인 응답이 없습니다')
            await send({'type':'ping'})
            continue
        
        # 메시지 종류에 맞는 스키마로 검사
        message = _client_message_adapter.validate_json(text)
        last_received = loop.time()

        if isinstance(message, RoomWebSocketChat):
            # 최근 시간 범위에서 벗어난 채팅 시각을 제거
            now = loop.time()
            while chat_times and now - chat_times[0] >= CHAT_RATE_WINDOW_SECONDS:
                chat_times.popleft()
            
            # 제한을 넘긴 채팅은 전달하지 않음
            if len(chat_times) >= CHAT_RATE_LIMIT:
                await send({
                    'type': 'error',
                    'code': 'chat_rate_limited',
                    'message': '채팅 전송 횟수 제한을 초과했습니다',
                })
                continue
            
            chat_times.append(now)
            await service.send_chat(participant, token, message.content)
        
        elif isinstance(message, RoomWebSocketPing):
            # 클라이언트의 연결 확인 요청에 답함
            await send({'type': 'pong'})

        elif isinstance(message, RoomWebSocketPong):
            # 응답한 연결의 인증과 현재 참가도 다시 확인
            await service.ensure_current_participant(participant, token)

async def _run_authenticated_connection(
    websocket: WebSocket,
    room_id: int,
    service: RoomRealtimeService,
    socket_lock: asyncio.Lock,
    close: CloseConnection,
) -> None:
    # 최초 메시지로 토큰과 현재 참가를 확인
    token, participant = await _authenticate_connection(
        websocket, room_id, service
    )

    # 이 연결의 수신 자격을 검사할 전송 함수를 만듦
    send = _make_send_callback(
        websocket, socket_lock, participant, token, service, close
    )

    # 인증을 통과한 연결을 같은 방의 메시지 전달 대상에 등록
    connection_id = await service.register(participant, send, close)

    try:
        # 구독 준비를 알리고 클라이언트의 최신 상세 조회를 유도
        await send({
            'type': 'connected',
            'room_id': room_id,
        })

        # 연결이 유지되는 동안 채팅과 연결 확인 메시지를 처리
        await _receive_messages(
            websocket, participant, token, service, send
        )
    finally:
        # 정상 종료와 오류 발생 모두에서 통신 연결 등록을 제거
        await service.unregister(connection_id)

# 연결 요청을 검사하고 처리 결과에 맞게 소케슬 종료
@router.websocket("/ws/rooms/{room_id}")
async def room_websocket(
    websocket: WebSocket,
    room_id: int,
    service: RoomRealtimeService = Depends(get_realtime_service),
    allowed_origins: list[str] = Depends(get_allowed_origins),
) -> None:
    # 전송과 종료가 함께 사용할 잠금과 종료 함수를 만듦
    socket_lock = asyncio.Lock()
    close = _make_close_callback(websocket, socket_lock)

    # 정상 종룔르 기본값으로 준비
    close_code = 1000
    close_reason = ""

    try:
        # WSS와 허용한 페이지 출처를 모두 확인
        if (
            websocket.url.scheme != 'wss'
            or not _is_allowed_origin(websocket, allowed_origins)
        ):
            close_code = 1008
            close_reason = '허용되지 않은 연결 요청입니다'
            return
        
        # 연결을 수락한 뒤 최초 메시지로 회원을 인증
        await websocket.accept()
        await _run_authenticated_connection(
            websocket, room_id, service, socket_lock, close
        )
    
    except WebSocketDisconnect:
        # 상대가 종료한 연결은 오류로 기록하지 않음
        pass
    except _MessageError as error:
        # 수신 제한 위반에 지정한 종료 정보를 사용
        close_code = error.code
        close_reason = error.message

    except ValidationError:
        # 입력 원문을 포함하지 않는 고정 문구로 형식 오류를 알림
        close_code = 1008
        close_reason = '메시지 형식이 올바르지 않습니다'
    
    except AuthenticationError:
        # 유효한 회원 인증이 없는 연결을 종료
        close_code = 4401
        close_reason = '인증이 유효하지 않습니다'
    
    except DomainError:
        # 요청한 방의 현재 참가 자격이 없는 연결을 종료
        close_code = 4403
        close_reason = '이 방의 참가 상태가 유효하지 않습니다'

    except TimeoutError:
        # 제한 시간 안에 처리를 끝내지 못한 연결을 종료
        close_code = 1008
        close_reason = '연결 처리 시간이 초과되었습니다'
    
    except Exception as error:
        # 예상하지 못한 실패는 내부 내용을 노출하지 않음
        close_code = 1011
        close_reason = '연결을 처리하지 못했습니다'
        logger.warning(
            '방 WebSocket 처리 실패: room_id=%s error_type=%s',
            room_id,
            type(error).__name__,
        )
    
    finally:
        # 처리 결과에 맞게 소켓 종료를 시도
        try:
            await close(close_code, close_reason)
        except (WebSocketDisconnect, RuntimeError, TimeoutError):
            # 이미 끊겼거나 종료할 수 없는 소켓의 정리를 마침
            pass