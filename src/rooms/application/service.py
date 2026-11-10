# rooms 응용 서비스 — 조회 → 도메인 행위 → 저장 → commit
from collections.abc import Callable
from datetime import UTC, datetime

from rooms.application.read_models import GameStartResult, LeaveResult
from rooms.domain.exceptions import RoomNotFoundError
from rooms.domain.participation import TeamSide
from rooms.domain.repository import RoomRepository  # 계약만 가져온다
from rooms.domain.room import Room


# 현재 시각의 기본값 — CONV-06: now()는 서비스의 clock에서만 부른다
def _utc_now() -> datetime:
    return datetime.now(UTC)

# 방을 바꾸는 흐름 (SEQ-05~09). 필수 범위는 잠금 없이 find_by_id로 읽는다(도전 A 제외)
# 도전과제A(동시성) 
#   방을 바꾸는 메서드는 모두 _get_room_for_update로 
#   방을 "잠그고" 읽는다.
#   잠금 -> 도메인 메서드 -> save -> (요청 끝) -> commit & 잠금해제
#   같은 방 요청 - 이 구간을 한 번에 하나씩 지나간다
#   도메인 규칙 검증(정원, 팀 정원, 방장 등) - 그대로 유효
class RoomApplicationService:
    # list_cache 매개변수 제거 (도전C 관련)
    #   캐시 비우기 -> "commit 이후"여야 의미가 있다.
    #   commit -> get_db에서 일괄 수행하도록 변경됨
    #   도전C 진행시, get_db의 commit 뒤에서 비운다 (ADR-007)
    def __init__(
        self,
        *,
        rooms: RoomRepository,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        # 세션은 받지 않는다 — 저장소 구현의 내부 사정 (조립하는 쪽이 저장소에 넣는다)
        self.clock = clock
        self.rooms = rooms

    # 방 만들기 — 한 회원 한 방 판단은 도메인이 하므로 현재 참가를 먼저 읽어 넘긴다
    async def create_room(self, user_id: int, title: str) -> Room:
        current = await self.rooms.find_current_participation(user_id)
        room = Room.create(title, user_id, current, self.clock())
        saved = await self.rooms.save(room)  # id가 채워진 방 — 라우터가 saved.id로 상세를 읽는다
        return saved

    # 참가 — 같은 방에 다시 요청하면 도메인이 기존 기록을 돌려주고 변화가 없다
    async def join_room(self, room_id: int, user_id: int) -> Room:
        ######### 이전 코드 ##########
        # current = await self.rooms.find_current_participation(user_id)
        # room = await self._get_room(room_id)
        # room.join(user_id, current, self.clock())
        # saved = await self.rooms.save(room)
        # return saved

        # 사본 검사와 실제 참가에 같은 시각을 쓰기 위해 변수로 저장
        now = self.clock()

        # 빠른 거절 - 잠금 없이 읽은 "사본"으로 도멩니 규칙을 먼저 돌려본다
        #   "인기 방"이 이미 찼다면 잠금 대기열X, 바로 400 반환("정원이 마감되었습니다") -> db rollback
        #   - 규칙을 서비스에 다시 쓰지 않고 room.join() 그대로 쓴다 (규칙은 도메인 한 곳에만)
        #   - 사본은 저장하지 않고 버린다.
        #   - 이미 이 방에 있는 회원의 재요청은 skip (꽉 찬 방, "변화 없음")
        snapshot = await self._get_room(room_id) # 사본,스냅샷
        if snapshot.participation_of(user_id) is None: # 참가 없음
            snapshot.join(user_id, None, now) # 사본으로 방 참여 시도->확정실패 (room_id = None)

        # 방 잠금 ㅡ 앞 요청이 commit할 때까지 기다린다
        # 최대 lock_timeout만큼 응답대기, 넘으면 409
        room = await self._get_room_for_update(room_id)

        # 잠금 "뒤에" 현재 참가를 읽는다 **순서중요**
        #   잠금 전에 읽으면: 같은 회원이 같은 방에 동시요청 -> "참가없음" 조회 -> INSERT -> PK위반
        #   잠금 뒤에 읽으면: 두 번째 요청은 "같은 방 재요청" -> "변화없음" 처리
        current = await self.rooms.find_current_participation(user_id)
        room.join(user_id, current, now)
        saved = await self.rooms.save(room)
        return saved

    # 제목 변경
    async def rename_room(self, room_id: int, user_id: int, title: str) -> Room:
        # room = await self._get_room(room_id)
        room = await self._get_room_for_update(room_id)
        room.rename(user_id, title)
        saved = await self.rooms.save(room)
        return saved

    # 팀 변경
    async def change_team(self, room_id: int, user_id: int, team: TeamSide) -> Room:
        # room = await self._get_room(room_id)
        room = await self._get_room_for_update(room_id)
        room.change_team(user_id, team)
        saved = await self.rooms.save(room)
        return saved

    # 나가기 — leave 전에 방장을 기억해 둬야 위임이 있었는지 알 수 있다
    async def leave_room(self, room_id: int, user_id: int) -> LeaveResult:
        # room = await self._get_room(room_id)
        room = await self._get_room_for_update(room_id)
        previous_host = room.host_user_id
        room.leave(user_id, self.clock())
        await self.rooms.save(room)
        host_changed = room.is_active and room.host_user_id != previous_host
        return LeaveResult(
            room_deleted=not room.is_active,
            new_host_user_id=room.host_user_id if host_changed else None,
        )

    # 게임 시작 — 시각은 한 번만 얻어 도메인과 결과에 같은 값을 쓴다
    async def start_game(self, room_id: int, user_id: int) -> GameStartResult:
        # room = await self._get_room(room_id)
        room = await self._get_room_for_update(room_id)
        now = self.clock()
        room.start_game(user_id, now)
        await self.rooms.save(room)
        return GameStartResult(room_id=room_id, dissolved_at=now)

    # 없으면 404 — 판단은 서비스, HTTP 변환은 전역 핸들러(CONV-05)
    async def _get_room(self, room_id: int) -> Room:
        room = await self.rooms.find_by_id(room_id)
        if room is None:
            raise RoomNotFoundError()
        return room

    async def _get_room_for_update(self, room_id: int) -> Room:
        room = await self.rooms.find_by_id_for_update(room_id)
        if room is None:
            raise RoomNotFoundError()
        return room
