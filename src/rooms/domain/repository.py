# rooms -> repository contract (추상클래스)
#   RoomRepository : 도메인 Room 읽고 저장한다 (변경흐름) -> 규칙에 따른 변경이 필요할때
#   RoomQueryRepoistory : 화면용 읽기 모델을 바로생성 (조회흐름, 도메인 안거친다)


# [핵심 개념] aggregate와 저장소는 1:1
#   - aggregate = 함께 바뀌어야 하는 개체 묶음, 여기서는 Room(루트) + Team + Participation
#   - 규칙("한 팀 최대 2명", "방장 이전")은 Room 루트를 통해서만 바꾼다
#   - 그래서 저장소도 Room 단위로만 읽고(find_by_id) 저장(save)

# [동작 방식] "변경 흐름"에서 쓰는 저장소
#   서비스: room = await rooms.find_by_id(id) # 도메인 객체로 받기
#           room.join(user_id, side, now) # 도메인 규칙 실행
#           await room.save(room)       # 바뀐 상태 저장
#   (화면용 조회 - 도메인을 거치지 않는 RoomQueryRepository가 따로 맡는다, CQRS 맛보기!)

# [고려사항]
#   - find_current_participation은 Participation(domain 객체)을 반환하므로
#     repository는 도메인 계층에 둔다.
#   - read_models(application) import하면 domain -> application 역참조 (금지패턴)
#   - 읽기 모델을 반환하는 계약은 application/query_repository.py로 분리한다.

from abc import ABC, abstractmethod

from rooms.domain.participation import Participation
from rooms.domain.room import Room

# from rooms.application.read_models import (
#     ArchivedRoom,
#     HistoryItem,
#     RoomDetail,
#     RoomListcondition,
#     RoomSummary,
# )


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




#   - 읽기 모델을 반환하는 계약은 application/query_repository.py로 분리한다.

# class RoomQueryRepository(ABC):
#     @abstractmethod
#     async def list_active_rooms(
#         self, cond: RoomListCondition
#     ) -> tuple[list[RoomSummary], int]:
#         """
#         활성 방 목록 한 페이지와 전체 개수
#         """

#     @abstractmethod
#     async def get_room_detail(self, room_id: int) -> RoomDetail | None:
#         """
#         활성 방 상세, 없거나 삭제된 방 -> None
#         """

#     @abstractmethod
#     async def list_history(
#         self, user_id: int, page: int, size: int
#     ) -> tuple[list[HistoryItem], int]:
#         """
#         현재 참가 + 끝난 참가 이력을 최신순 정렬
#         """

#     @abstractmethod
#     async def get_archived_room(self, room_id: int, user_id: int) -> ArchivedRoom | None:
#         """
#         삭제된 방의 내 기록, 활성 방 or 참가한 적 없으면 None
#         """

