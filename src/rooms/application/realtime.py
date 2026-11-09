# 방 실시간 처리에 사용하는 데이터와 계약
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from auth.application.service import AuthApplicationService
from rooms.application.queries import RoomQueryService
from rooms.domain.repository import RoomRepository
from dataclasses import dataclass


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
