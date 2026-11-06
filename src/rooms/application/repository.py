# rooms -> repository contract (추상클래스)
#   RoomRepository : 도메인 Room 읽고 저장한다 (변경흐름) -> 규칙에 따른 변경이 필요할때
#   RoomQueryRepoistory : 화면용 읽기 모델을 바로생성 (조회흐름, 도메인 안거친다)

# read_models
#   같은 application 계층 > import해도 상관없다.

from abc import ABC, abstractmethod

from rooms.application.read_models import (
    ArchivedRoom,
    HistoryItem,
    RoomDetail,
    RoomListcondition,
    RoomSummary,
)

from rooms.domain.participation import Participation
from rooms.domain.room import Room


class RoomRepository(ABC):
    @abstractmethod
    async def find_by_id(self, room_id: int) -> Room | None:
        """
        team, participations 정보까지 포함해 room 정보를 읽는다
        도메인으로 돌려준다
        없으면 None
        -> 404 판단은 서비스가 한다.
        """


    @abstractmethod
    async def find_current_participation(self, user_id: int) -> Participation | None:
        """
        이 회원의 현재 참가 (0-1건) 
        **participations 테이블은 방에서 나가면 행 삭제(hard delete)
        """

    @abstractmethod
    async def save(self, room: Room) -> Room:
        """
        방 상태를 반영하고 flush한 뒤
        id 채워진 Room 객체를 돌려준다
        commit은 하지 않는다
        """


class RoomQueryRepository(ABC):
    @abstractmethod
    async def list_active_rooms(
        self, cond: RoomListCondition
    ) -> tuple[list[RoomSummary], int]:
        """
        활성 방 목록 한 페이지와 전체 개수
        """

    @abstractmethod
    async def get_room_detail(self, room_id: int) -> RoomDetail | None:
        """
        활성 방 상세, 없거나 삭제된 방 -> None
        """

    @abstractmethod
    async def list_history(
        self, user_id: int, page: int, size: int
    ) -> tuple[list[HistoryItem], int]:
        """
        현재 참가 + 끝난 참가 이력을 최신순 정렬
        """

    @abstractmethod
    async def get_archived_room(self, room_id: int, user_id: int) -> ArchivedRoom | None:
        """
        삭제된 방의 내 기록, 활성 방 or 참가한 적 없으면 None
        """

