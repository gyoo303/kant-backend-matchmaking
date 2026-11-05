# rooms 저장소 (flush만, commit은 서비스)
from sqlalchemy.ext.asyncio import AsyncSession

from rooms.domain.participation import Participation
from rooms.domain.room import Room


# RoomRepository — 변경용
# 껍데기: 이름·시그니처만 먼저 올려 C의 service.py가 import할 수 있게 한다. 본문은 PR③에서 채운다
class RoomRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    #   - find_by_id: 없으면 None (404 판단은 서비스)
    async def find_by_id(self, room_id: int) -> Room | None:
        raise NotImplementedError

    #   - find_current_participation: 이 회원의 현재 참가 (0~1건)
    async def find_current_participation(self, user_id: int) -> Participation | None:
        raise NotImplementedError

    #   - save: 끝난 참가는 participation_logs로 옮기고 participations 행은 지운다
    #     flush 후 도메인으로 다시 바꿔 반환한다 (새 방이면 id가 채워짐)
    async def save(self, room: Room) -> Room:
        raise NotImplementedError


# RoomQueryRepository — 조회용, 읽기 모델로 반환
#   - list_active_rooms
#   - get_room_detail
#   - list_history: 현재 참가 + 이용 로그를 합친다
#   - get_archived_room: 이용 로그만 읽는다
