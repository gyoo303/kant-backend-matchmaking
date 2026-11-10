# 방 실시간 처리에 사용하는 데이터와 계약
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from auth.application.service import AuthApplicationService
from rooms.application.queries import RoomQueryService
from rooms.domain.repository import RoomRepository
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4
from exceptions import AuthenticationError
from rooms.domain.exceptions import NotParticipantError


# 인증과 현재 참가 확인 결과를 실시간 처리에 전달
@dataclass(frozen=True)
class RealtimeParticipant:
    room_id: int
    user_id: int
    nickname: str
    join_order: int

# 클라이언트로 메시지를 전송하는 함수의 형식을 정의
SendMessage = Callable[[dict[str, object]], Awaitable[None]]

# 종료 코드와 사유로 연결을 닫는 함수의 형식을 정의
CloseConnection = Callable[[int, str], Awaitable[None]]

# 짧은 DB 작업에서 함게 사용할 부품을 묶음
@dataclass(frozen=True)
class RealtimeServices:
    auth: AuthApplicationService
    rooms: RoomRepository
    queries: RoomQueryService

# 비동기 작업 범위를 만들어 주는 함수의 형식을 정의
RealtimeScope = Callable[[], AbstractAsyncContextManager[RealtimeServices]]

# 실시간 연결 관리 부품이 제공해야 하는 동작을 정의
class RoomRealtimeHub(ABC):
    # 참가자 정보와 전송·종료 함수를 등록
    @abstractmethod
    async def register(
        self,
        participant: RealtimeParticipant,
        send: SendMessage,
        close: CloseConnection,
    ) -> str:
        """연결을 등록하고 연결 식별자를 반환"""

    # 종료된 연결을 관리 목록에서 제거
    @abstractmethod
    async def unregister(self, connection_id: str) -> None:
        """연결 식별자에 해당하는 등록 정보를 제거"""
    
    # 연결 식별자로 메시지를 전송
    @abstractmethod
    async def send_to(
        self,
        connection_id: str,
        message: dict[str, object],
    ) -> bool:
        """전송 함수 호출의 성공 여부를 반환"""

    # 같은 방에 등록된 연결에 메시지를 전송
    @abstractmethod
    async def broadcast(
        self,
        room_id: int,
        message: dict[str, object],
    ) -> None:
        """지정된 방의 연결에 메시지 전송을 요약"""

    # 지정한 방의 연결을 닫고 등록 정보를 정리
    @abstractmethod
    async def close_room(
        self,
        room_id: int,
        code: int,
        reason: str,
    ) -> None:
        """방에 등록된 연결을 종료하고 관리 목록에서 제거"""

# 메시지에 부여할 현재 UTC 시각을 구함
def _utc_now() -> datetime:
    return datetime.now(UTC)

# 실시간 연결의 인증·참가 확인과 메시지 처리를 조율
class RoomRealtimeService:
    def __init__(
        self,
        *,
        hub: RoomRealtimeHub,
        scope: RealtimeScope,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        # 메시지를 전달할 연결 관리자를 보관
        self._hub = hub

        # 인증·조회마다 짧은 DB 작업 범위를 만들 함수를 보관
        self._scope = scope
        # 채팅 메시지의 시각을 만들 함수를 보관
        self._clock = clock
        
    # 토큰을 검증하고 요청한 방의 현재 참가자를 반환
    async def authenticate(
            self,
        room_id: int,
        token: str,
    ) -> RealtimeParticipant:
        # 인증과 참가 확인에 사용할 짧은 작업 범위를 연다
        async with self._scope() as services:
            # 기존 인증 서비스로 토큰의 주인을 확인
            user = await services.auth.authenticate(token)
            if user.id is None:
                raise AuthenticationError('인증된 회원 정보를 확인할 수 없습니다')

            # 방의 존재·해산 여부를 기존 상세 조회로 확인
            await services.queries.get_room_detail(room_id, user.id)

            # 회원의 현재 참가가 요청한 방에 속하는지 확인
            participation = await services.rooms.find_current_participation(user.id)
            if participation is None or participation.room_id != room_id:
                raise NotParticipantError
                
            # 실시간 처리에 필요한 참가자 정보만 반환
            return RealtimeParticipant(
                room_id=room_id,
                user_id=user.id,
                nickname=user.nickname,
                join_order=participation.join_order,
            )
    # 기존 연결이 같은 회원의 같은 참가에 속하는지 확인
    async def ensure_current_participant(
        self,
        participant: RealtimeParticipant,
        token: str,
    ) -> RealtimeParticipant:
        # 현재 토큰과 DB 참가 정보를 다시 확인
        current = await self.authenticate(participant.room_id, token)

        # 다른 회원이나 재입장으로 바뀐 참가를 거부
        if (
            current.user_id != participant.user_id
            or current.join_order != participant.join_order
        ):
            raise NotParticipantError()
        
        return current

    # 인증을 마친 참가자의 통신 연결을 등록
    async def register(
        self,
        participant: RealtimeParticipant,
        send: SendMessage,
        close: CloseConnection,
    ) -> str:
        return await self._hub.register(participant, send, close)

    # 종료된 통신 연결을 관리 목록에서 제거
    async def unregister(self, connection_id: str) -> None:
        await self._hub.unregister(connection_id)
    
    # 현재 참가자가 보낸 채팅을 같은 방의 연결에 전달
    async def send_chat(
        self,
        participant: RealtimeParticipant,
        token: str,
        content: str,
    ) -> None:
        # 전송 전에 발신자의 인증과 현재 참가를 다시 확인
        current = await self.ensure_current_participant(participant, token)

        # 서버가 발신자 정보와 메시지 식별자·시각을 부여
        message: dict[str, object] = {
            'type': 'chat_message',
            'message_id': uuid4().hex,
            'room_id': current.room_id,
            'user_id': current.user_id,
            'nickname': current.nickname,
            'content': content,
            'sent_at': self._clock().isoformat(),
        }

        # 같은 방에 등록된 연결로 메시지를 전달
        await self._hub.broadcast(current.room_id, message)