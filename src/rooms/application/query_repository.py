# rooms 조회 저장소 계약 : D-030

# [핵심 개념] 왜 이 계약만 application에 있나?
#   - 반환 타입이 read_models(RoomSummary, RoomDetail ...) = application 계층의 타입
#   - 이 계약을 domain에 두면 domain이 application을 import해야 한다
#     - 역방향 의존 (금지패턴)
#   - 규칙: "계약은 인자 또는 반환 타입이 속한 가장 안쪽 계층에 둔다"

# [동작 방식] "조회 흐름" 전용
#   - 도메인 객체를 만들지 않고 SQL 결과를 바로 읽기모델로 담아온다 (빠르다, 단순하다)
#   - 도메인 규칙 검사가 필요없는 방 목록, 방 상세, 방 참여 이력 화면에 쓴다

# [고려사항]
#   - 같은 application 계층의 read_models import -> 허용
#   - 구현(SqlAlchemyRoomQueryRepository)은 infrastructure에서 이 클래스를 상속한다.
#   - (infrastructure -> application 방향 = 바깥에서 안쪽이므로 허용)



from abc import ABC, abstractmethod

from rooms.application.read_models import (
    ArchivedRoom,
    HistoryItem,
    RoomDetail,
    RoomListCondition,
    RoomSummary,
)


class RoomQueryRepository(ABC):
    """화면용 읽기 모델 조회 계약"""


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

