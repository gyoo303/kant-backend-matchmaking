# rooms 조회 서비스 (commit 없음)
### 개념: 조회 서비스의 역할
# 레포지토리를 불러 결과를 **페이지 묶음**(`RoomPage`, `HistoryPage`)으로 감싼다
# "없음(None)"을 **도메인 예외**로 변경 → A의 전역 핸들러가 404/410으로 변경 
#   여기서 `HTTPException`은 쓰지 않는다(CONV-05).
# `select()`·`session.execute()`를 직접 쓰지 않는다(GATE-07).
#    ORM 모델도 import하지 않는다(GATE-08).
#   **commit도 없다**(조회만 하니까).

### 404 vs. 410 (D-016)
#방이 아예 없음 - 404 `RoomNotFoundError` 
#빈 방이 돼서 삭제됨 (`EMPTY`) - 404 `RoomNotFoundError`
#게임 시작으로 해산됨 (`GAME_STARTED`) - **410** `RoomDissolvedError`

### 개념: `dataclasses.replace`
# `RoomDetail`은 `frozen=True`라 `detail.my_team = ...` 불가능
# `replace(detail, my_team=..., am_i_host=...)`는 **지정한 필드만 바꾼 새 복사본**을 생성한다

from dataclasses import replace
from sqlalchemy.ext.asyncio import AsyncSession

from rooms.application.read_models import (
    ArchivedRoom,
    CurrentRoom,
    HistoryPage,
    RoomDetail,
    RoomListCondition,
    RoomPage,
)
from rooms.domain.exceptions import RoomDissolvedError, RoomNotFoundError
from rooms.domain.room import DeleteReason
# repositories만 import - infrastructure.models(ORM)은 임포트 X
from rooms.infrastructure.repositories import RoomQueryRepository, RoomRepository

# RoomQueryService
#   - list_rooms
#   - get_room_detail
#   - get_current_room
#   - list_history
#   - get_archived_room


class RoomQueryService:
    # 생성자 - (db 세션)만 받는다
    # list_cache -> 도전과제(C) 범위, 필수범위에서 뺀다
    def __init__(self, db: AsyncSession) -> None:
        # 같은 세션을 2개의 repository가 함께 쓴다
        self.room_repo = RoomRepository(db) # 도메인 - DB 사이를 이어준다.
        self.query_repo = RoomQueryRepository(db) # [조회전용] 화면에 나갈 정보를 도메인 안거치고 빠르게 내보낸다
        
    # 방 목록 조회 - 화면 정보 빠르게 가져온다 query_repo
    async def list_rooms(self, cond: RoomListCondition) -> RoomPage:
        # 방 조회 조건값에 따라 활성 방 목록을 가져온다: 객체, 총 갯수
        items, total = await self.query_repo.list_active_rooms(cond)
        return RoomPage(items=items, total=total, page=cond.page, size=cond.size)

    # 방 상세정보 조회 -> 도메인을 거쳐서 조회한다, room_repo
    async def get_room_detail(self, room_id: int, viewer_id: int) -> RoomDetail:
        detail = await self.query_repo.get_room_detail(room_id)

        # 방 정보 조회값이 넘어오지 않음
        if detail is None:
            # 활성 방이 아니다 > 삭제 이유 확인을 위해 변경용 repository로 다시 읽는다.
            room = await self.room_repo.find_by_id(room_id)
            if room is not None and room.delete_reason == DeleteReason.GAME_STARTED:
                # 게임 시작으로 방이 해산되었음
                raise RoomDissolvedError() # 410 (화면이 "해산됨" 안내)
            raise RoomNotFoundError() # 404 (없는 방, 인원수 0명으로 삭제된 방)

        # 유저 기준 값 채우기
        my_team = None
        for participant in detail.participants:
            if participant.user_id == viewer_id:
                my_team = participant.team
                break # 더 볼 필요 없음
        return replace(detail, 
                       my_team = my_team, 
                       am_i_host = detail.host_user_id == viewer_id)


    # 현재 방 조회 -> 도메인을 거쳐서 조회한다, room_repo
    async def get_current_room(self, user_id: int) -> CurrentRoom | None:
        participation = await self.room_repo.find_current_participation(user_id)
        if participation is None:
            return None # 라우터가 {"room_id": null, "title": null}로 응답

        room = await self.room_repo.find_by_id(participation.room_id)
        if room is None:
            return None
        return CurrentRoom(room_id=room.id, title=room.title.value)


    # 방 참가 이력 조회 - 화면에 뿌릴 정보를 빠르게 가져온다 query repo
    async def list_history(self, user_id: int, page: int, size: int) -> HistoryPage:
        items, total = await self.query_repo.list_history(user_id, page, size)
        return HistoryPage(items=items, total=total, page=page, size=size)

    # 내가 참여한 이력이 있고 현재 비활성화 된 방 조회 - 화면 정보 빠르게 query repo
    async def get_archived_room(self, room_id: int, user_id: int) -> ArchivedRoom:
        archived = await self.query_repo.get_archived_room(room_id, user_id)
        if archived is None:
            raise RoomNotFoundError() # 활성 방 or 내가 참가한 적 없는 방

        return archived
