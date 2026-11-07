# 테스트용 가짜 저장소 — 계약(ABC)을 상속하고 dict(메모리)에 저장한다
#
# [핵심 개념] 테스트 더블(Test Double) 중 "Fake"
#   - 진짜처럼 동작하지만 훨씬 단순한 구현 (DB 대신 dict)
#   - 계약을 상속하므로 메서드를 빠뜨리면 객체 생성 때 TypeError → 계약과 어긋날 수 없다
#   - 서비스는 이것이 가짜인지 모른다: 계약 타입만 보기 때문 (= 생성자 주입의 효과)

from dataclasses import replace
from datetime import UTC, datetime

from auth.domain.repository import TokenBlacklistRepository, UserRepository
from auth.domain.token_blacklist import TokenBlacklist
from auth.domain.user import User
from rooms.domain.participation import Participation
from rooms.domain.repository import RoomRepository
from rooms.domain.room import Room


class FakeUserRepository(UserRepository):
    def __init__(self) -> None:
        self._by_id: dict[int, User] = {}

    async def find_by_id(self, user_id: int) -> User | None:
        return self._by_id.get(user_id)

    async def find_by_login_id(self, login_id: str) -> User | None:
        return next((u for u in self._by_id.values() if u.login_id == login_id), None)

    async def exists_login_id(self, login_id: str) -> bool:
        return await self.find_by_login_id(login_id) is not None

    async def exists_nickname(self, nickname: str) -> bool:
        return any(u.nickname == nickname for u in self._by_id.values())

    async def save(self, user: User) -> User:
        # DB가 채워 주던 값(id, created_at)을 흉내 낸다
        saved = replace(user, id=len(self._by_id) + 1, created_at=datetime.now(UTC))
        self._by_id[saved.id] = saved
        return saved


class FakeTokenBlacklistRepository(TokenBlacklistRepository):
    def __init__(self) -> None:
        self.tokens: set[str] = set()

    async def exists(self, token: str) -> bool:
        return token in self.tokens

    async def save(self, entry: TokenBlacklist) -> None:
        self.tokens.add(entry.token)


class FakeRoomRepository(RoomRepository):
    def __init__(self) -> None:
        self.rooms: dict[int, Room] = {}

    async def find_by_id(self, room_id: int) -> Room | None:
        return self.rooms.get(room_id)

    async def find_current_participation(self, user_id: int) -> Participation | None:
        for room in self.rooms.values():
            for p in room.current_participants:
                if p.user_id == user_id:
                    return p
        return None

    async def save(self, room: Room) -> Room:
        if room.id is None:
            room.id = len(self.rooms) + 1
        for p in room.participations:
            p.room_id = room.id
        self.rooms[room.id] = room
        return room
