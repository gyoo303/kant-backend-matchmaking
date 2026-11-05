# rooms 조회 서비스 (commit 없음)
# 일단 껍데기
# 이름, 시그니처만 먼저 올린다
# E 파트의 router.py가 import 가능하도록

from sqlalchemy.ext.asyncio import AsyncSession

from rooms.application.read_models import (
    ArchivedRoom,
    CurrentRoom,
    HistoryPage,
    RoomDetail,
    RoomListCondition,
    RoomPage,
)

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
        self.db = db

    # 방 목록 조회
    async def list_rooms(self, cond: RoomListCondition) -> RoomPage:
        raise NotImplementedError

    # 방 상세정보 조회
    async def get_room_detail(self, room_id: int, viewer_id: int) -> RoomDetail:
        raise NotImplementedError

    # 현재 방 조회
    async def get_current_room(self, user_id: int) -> CurrentRoom | None:
        raise NotImplementedError

    # 방 참가 이력 조회
    async def list_history(self, user_id: int, page: int, size: int) -> HistoryPage:
        raise NotImplementedError

    async def get_archived_room(self, room_id: int, user_id: int) -> ArchivedRoom:
        raise NotImplementedError
