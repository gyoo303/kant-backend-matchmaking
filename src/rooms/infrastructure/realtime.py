"""
"application.py 에서 작성한 추상 클래스를 여기서 구현"

- 연결별 참가자 정보와 전송·종료 함수를 보관
- 연결 식별자로 필요한 연결을 찾음
- 같은 방의 연결에 메시지를 전달
- 종료된 연결을 정리
"""
# 방별 실시간 연결을 메모리에서 관리
import asyncio
import logging
from dataclasses import dataclass, field
from uuid import uuid4

from rooms.application.realtime import (
    CloseConnection,
    RealtimeParticipant,
    RoomRealtimeHub,
    SendMessage,
)

# 연결 처리 실패를 기록할 로거를 준비
logger = logging.getLogger(__name__)

# 연결 하나의 참가자 정보와 통신 함수를 보관
@dataclass
class _Connection:
    participant: RealtimeParticipant
    send: SendMessage = field(repr=False)
    close: CloseConnection = field(repr=False)
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    closed: bool = False

# 연결 관리 계약을 프로세스 메모리로 구현
class InMemoryRoomRealtimeHub(RoomRealtimeHub):
    def __init__(self, *, send_timeout: float = 5.0) -> None:
        # 연결 식별자로 연결 정보를 보관
        self._connections: dict[str, _Connection] = {}

        # 방별 메시지 처리를 순서대로 진행할 Lock을 보관
        self._room_locks: dict[int, asyncio.Lock] = {}

        # 전송 작업을 기다릴 최대 시간을 보관
        self._send_timeout = send_timeout

    # 새 연결에 식별자를 부여하고 정보를 보관
    async def register(
        self,
        participant: RealtimeParticipant,
        send: SendMessage,
        close: CloseConnection,
    ) -> str:
        connection_id = uuid4().hex

        # 참가자 정보와 통신 함수를 같은 연결로 묶음
        self._connections[connection_id] = _Connection(
            participant=participant,
            send=send,
            close=close,
        )
        return connection_id

    # 연결 정보를 제거하고 이후 전송을 막음
    async def unregister(self, connection_id: str) -> None:
        connection = self._connections.pop(connection_id, None)
        if connection is not None:
            connection.closed = True
    
    # 연결을 등록 목록에서 제외한 뒤 통신 연결을 닫음
    async def _close_connection(
        self,
        connection_id: str,
        code: int,
        reason: str,
    ) -> None:
        connection = self._connections.get(connection_id)
        if connection is None:
            return
        
        # 종료 처리 중인 연결에 새 전송이 시작되지 않도록 함
        await self.unregister(connection_id)

        # 진행 중인 전송과 연결 종료가 겹치지 않도록 함
        try:
            async with asyncio.timeout(self._send_timeout):
                async with connection.send_lock:
                    await connection.close(code, reason)
        except Exception as error:
            # 메시지나 토큰 대신 연결 식별자와 오류 종류만 기록
            logger.warning(
                "실시간 연결 종료 실패: connection_id=%s error_type=%s",
                connection_id,
                type(error).__name__,
            )
    # 연결 식별자로 대상을 찾아 메시지를 전송
    async def send_to(
        self,
        connection_id: str,
        message: dict[str, object],
    ) -> bool:
        connection = self._connections.get(connection_id)
        if connection is None:
            return False
        
        # 같은 연결의 전송을 순서대로 처리하고 대기 시간을 제한
        try:
            async with asyncio.timeout(self._send_timeout):
                async with connection.send_lock:
                    if connection.closed:
                        return False
                    
                    await connection.send(message)
        except Exception as error:
            # 전송 내용 대신 연결 식별자와 오류 종류만 기록
            logger.warning(
                "실시간 메시지 전송 실패: connection_id=%s error_type=%s",
                connection_id,
                type(error).__name__,
            )

            # 전송에 실패한 연결을 관리 목록에서 제외하고 닫음
            await self._close_connection(
                connection_id,
                1011,
                "메시지 전송 실패"
            )
            return False

        return True

    # 같은 방의 연결에 메시지를 전달
    async def broadcast(
        self,
        room_id: int,
        message: dict[str, object],
    ) -> None:
        # 같은 방의 broadcast 처리를 순서대로 진행
        room_lock = self._room_locks.setdefault(room_id, asyncio.Lock())
        async with room_lock:
            # 전송을 시작하기 전에 대상 연결 식별자를 모음
            connection_ids = [
                connection_id
                for connection_id, connection in self._connections.items()
                if connection.participant.room_id == room_id
                and not connection.closed
            ]

            # 각 연결의 전송을 함께 시작하고 완료를 기다림
            await asyncio.gather(
                *(
                    self.send_to(connection_id, message)
                    for connection_id in connection_ids
                )
            )

    # 지정한 방의 연결을 모두 종료하고 등록 정보를 정리
    async def close_room(
        self,
        room_id: int,
        code: int,
        reason: str,
    ) -> None:
        # 같은 방의 broadcast와 종료 처리가 겹치지 않도록 함
        room_lock = self._room_locks.setdefault(room_id, asyncio.Lock())
        async with room_lock:
            # 종료할 방에 속한 연결 식별자를 모음
            connection_ids = [
                connection_id
                for connection_id, connection in self._connections.items()
                if connection.participant.room_id == room_id
            ]

            # 연결별 등록 제거와 종료 처리를 함께 진행
            await asyncio.gather(
                *(
                    self._close_connection(connection_id, code, reason)
                    for connection_id in connection_ids
                )
            )