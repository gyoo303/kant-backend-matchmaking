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
#           await rooms.save(room)      # 바뀐 상태 저장
#   (화면용 조회 - 도메인을 거치지 않는 RoomQueryRepository가 따로 맡는다, CQRS 맛보기!)

# [고려사항]
#   - find_current_participation은 Participation(domain 객체)을 반환하므로
#     repository는 도메인 계층에 둔다.
#   - read_models(application) import하면 domain -> application 역참조 (금지패턴)
#   - 읽기 모델을 반환하는 계약은 application/query_repository.py로 분리한다.

from abc import ABC, abstractmethod

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
    async def find_by_id_for_update(self, room_id: int) -> Room | None:
        """
        find_by_id와 같지만, 이 트랜잭션이 끝날 때까지(commit or rollback) 방을 잠근다.
        - 같은 방을 바꾸려는 다른 요청은 앞 요청이 끝날 때까지 기다린다
          -> 최신 상태를 읽고 검사한다.
        - 잠금을 너무 오래 기다리면 ServiceBusyError
          (어떻게 잠그는가 -> 구현 infrastructure에서 정한다)
        - **방을 바꾸는 쓰기 동작** (참가, 제목변경, 팀변경, 나가기, 게임시작)만 쓴다
        - 조회 화면은 그대로 find_by_id를 쓴다.
        *** 도메인 파일에는 "FOR UPDATE", "PostgreSQL" 등이 노출되어서는 안된다 (인프라의 사정이다)
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
