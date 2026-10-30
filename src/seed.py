"""초기 시드 (03-db-schema.md §6). lifespan이 create_all 직후 호출하고 commit한다.

도메인 메서드(Room.create·join·start_game·leave)로 만들어 시드도 불변 규칙을 지킨다.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from auth.domain.user import User
from auth.infrastructure.repositories import UserRepository
from auth.infrastructure.security import PasswordHasher
from config import Settings
from rooms.domain.room import Room
from rooms.infrastructure.repositories import RoomRepository

logger = logging.getLogger(__name__)

SEED_MARKER_LOGIN_ID = "seed01"
SEED_USER_COUNT = 14

# (제목, 방장·참가 순서대로 시드 회원 번호, 생성 시각: 기준 시각에서 뺄 분)
ACTIVE_ROOMS: list[tuple[str, list[int], int]] = [
    ("2vs2 시연 방", [1, 2, 3, 4], 5),
    ("한 자리 남음", [5, 6, 7], 15),
    ("Fun Room", [8, 9], 25),
    ("100% 즐겜", [10], 35),
    ("초보 환영", [11], 45),
]

# (제목, 참가 회원 번호, 생성 시각: 기준 시각에서 뺄 분, 삭제 방식)
DELETED_ROOMS: list[tuple[str, list[int], int, str]] = [
    ("어제 한 판", [1, 2, 3, 4], 1440, "game_started"),
    ("아무도 없음", [12], 600, "empty"),
    ("저녁 매치", [5, 6, 7, 8], 300, "game_started"),
]


def _login_id(number: int) -> str:
    return f"seed{number:02d}"


def _nickname(number: int) -> str:
    return f"시드유저{number:02d}"


async def seed_initial_data(session: AsyncSession, settings: Settings) -> None:
    users = UserRepository(session)
    if await users.exists_login_id(SEED_MARKER_LOGIN_ID):
        logger.info("seed skipped: %s already exists", SEED_MARKER_LOGIN_ID)
        return

    base = datetime.now(UTC)
    hashed = PasswordHasher().hash(settings.seed_user_password)
    user_ids: dict[int, int] = {}
    for number in range(1, SEED_USER_COUNT + 1):
        user = await users.save(User.register(_login_id(number), _nickname(number), hashed))
        user_ids[number] = user.id

    rooms = RoomRepository(session)
    room_count = 0
    participation_count = 0

    for title, members, minutes_ago, deletion in DELETED_ROOMS:
        created = base - timedelta(minutes=minutes_ago)
        room = _build_room(title, [user_ids[n] for n in members], created)
        ended = created + timedelta(minutes=30)
        if deletion == "game_started":
            room.start_game(room.host_user_id, ended)
        else:
            room.leave(room.host_user_id, ended)
        await rooms.save(room)
        room_count += 1
        participation_count += len(room.participations)

    for title, members, minutes_ago in ACTIVE_ROOMS:
        created = base - timedelta(minutes=minutes_ago)
        room = _build_room(title, [user_ids[n] for n in members], created)
        await rooms.save(room)
        room_count += 1
        participation_count += len(room.participations)

    await session.flush()
    logger.info(
        "seed inserted: users=%d rooms=%d teams=%d participations=%d total=%d",
        len(user_ids),
        room_count,
        room_count * 2,
        participation_count,
        len(user_ids) + room_count * 3 + participation_count,
    )


def _build_room(title: str, member_ids: list[int], created: datetime) -> Room:
    """첫 회원이 방을 만들고 나머지가 1분 간격으로 참가한다(팀은 도메인 규칙대로 배정)."""
    host_id, *others = member_ids
    room = Room.create(title, host_id, None, created)
    for offset, user_id in enumerate(others, start=1):
        room.join(user_id, None, created + timedelta(minutes=offset))
    return room
