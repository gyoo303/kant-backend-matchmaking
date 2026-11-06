# rooms API — prefix /api, 04-interfaces-api.md §4.2
#
# - 인증: 모든 API가 get_current_user_id(B)를 쓴다. 토큰 없음·잘못된 토큰은 401.
# - 오류: 도메인 예외(400/404/410)·422·500 변환은 bootstrap/error_handlers.py(A)의
#   전역 핸들러가 한다.
#   그래서 여기서는 try/except를 두지 않는다.
# - 변경 API(생성·제목·참가·팀)는 서비스로 바꾼 뒤 조회 서비스로 상세를 다시 읽어 응답한다.
# - 서비스는 요청마다 새로 만든다(CONV-04). 같은 요청의 db 세션을 함께 쓴다.
# - /me/room-history.csv(API-ROOM-12, 도전 B)는 필수 범위가 아니라 두지 않았다.
#   넣을 때는 /me/room-history/{room_id}보다 먼저 등록해야 한다.

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
# from sqlalchemy.ext.asyncio import AsyncSession

from database import DbSession
from auth.presentation.dependencies import get_current_user_id
# from database import get_db
from rooms.application.queries import RoomQueryService
from rooms.application.read_models import RoomListCondition
from rooms.application.service import RoomApplicationService
from rooms.domain.participation import TeamSide
from rooms.presentation.schemas import (
    ArchivedRoomResponse,
    CurrentRoomResponse,
    GameStartResponse,
    HistoryListResponse,
    LeaveResponse,
    RoomCreateRequest,
    RoomDetailResponse,
    RoomListResponse,
    RoomRenameRequest,
    TeamChangeRequest,
)

GAME_START_MESSAGE = "게임이 시작되어 방이 해산되었습니다"

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------- 서비스 조립 (CONV-04)

def get_room_service(db: DbSession) -> RoomApplicationService:
    """변경 서비스. 현재 시각은 서비스가 clock으로 한 번 얻어 쓴다."""
    return RoomApplicationService(db, clock=lambda: datetime.now(UTC))

# def get_room_service(db: AsyncSession = Depends(get_db)) -> RoomApplicationService:
#     """변경 서비스. 현재 시각은 서비스가 clock으로 한 번 얻어 쓴다(§8)."""
#     return RoomApplicationService(db, clock=lambda: datetime.now(UTC))

def get_query_service(db: DbSession) -> RoomQueryService:
    """조회 서비스(commit 없음)."""
    return RoomQueryService(db)

# def get_query_service(db: AsyncSession = Depends(get_db)) -> RoomQueryService:
#     """조회 서비스(commit 없음)."""
#     return RoomQueryService(db)


# ---------------------------------------------------------------- rooms


@router.get("/rooms", tags=["rooms"], summary="공개 방 목록", response_model=RoomListResponse)
async def list_rooms(
    keyword: str | None = Query(default=None, max_length=50),
    available_only: bool = False,
    sort: Literal["newest", "oldest"] = "newest",
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=50),
    user_id: int = Depends(get_current_user_id),
    queries: RoomQueryService = Depends(get_query_service),
) -> RoomListResponse:
    # 검색어는 앞뒤 공백을 빼고, 빈 문자열이면 조건 없음으로 본다(SEQ-10).
    cleaned = keyword.strip() if keyword is not None else ""
    cond = RoomListCondition(
        keyword=cleaned or None,
        available_only=available_only,
        sort=sort,
        page=page,
        size=size,
    )
    room_page = await queries.list_rooms(cond)
    return RoomListResponse.model_validate(room_page)


@router.post("/rooms", tags=["rooms"], summary="방 만들기", response_model=RoomDetailResponse)
async def create_room(
    body: RoomCreateRequest,
    user_id: int = Depends(get_current_user_id),
    service: RoomApplicationService = Depends(get_room_service),
    queries: RoomQueryService = Depends(get_query_service),
) -> RoomDetailResponse:
    room = await service.create_room(user_id, body.title)
    detail = await queries.get_room_detail(room.id, user_id)
    return RoomDetailResponse.model_validate(detail)


@router.get(
    "/rooms/{room_id}", tags=["rooms"], summary="방 상세", response_model=RoomDetailResponse
)
async def get_room_detail(
    room_id: int,
    user_id: int = Depends(get_current_user_id),
    queries: RoomQueryService = Depends(get_query_service),
) -> RoomDetailResponse:
    # 없는 방·빈 방 삭제는 404, 게임 시작으로 해산된 방은 410(조회 서비스의 예외).
    detail = await queries.get_room_detail(room_id, user_id)
    return RoomDetailResponse.model_validate(detail)


@router.patch(
    "/rooms/{room_id}",
    tags=["rooms"],
    summary="방 제목 변경(방장)",
    response_model=RoomDetailResponse,
)
async def rename_room(
    room_id: int,
    body: RoomRenameRequest,
    user_id: int = Depends(get_current_user_id),
    service: RoomApplicationService = Depends(get_room_service),
    queries: RoomQueryService = Depends(get_query_service),
) -> RoomDetailResponse:
    await service.rename_room(room_id, user_id, body.title)
    detail = await queries.get_room_detail(room_id, user_id)
    return RoomDetailResponse.model_validate(detail)


@router.post(
    "/rooms/{room_id}/participants",
    tags=["rooms"],
    summary="방 참가",
    response_model=RoomDetailResponse,
)
async def join_room(
    room_id: int,
    user_id: int = Depends(get_current_user_id),
    service: RoomApplicationService = Depends(get_room_service),
    queries: RoomQueryService = Depends(get_query_service),
) -> RoomDetailResponse:
    await service.join_room(room_id, user_id)
    detail = await queries.get_room_detail(room_id, user_id)
    return RoomDetailResponse.model_validate(detail)


@router.patch(
    "/rooms/{room_id}/participants/me",
    tags=["rooms"],
    summary="내 팀 변경",
    response_model=RoomDetailResponse,
)
async def change_team(
    room_id: int,
    body: TeamChangeRequest,
    user_id: int = Depends(get_current_user_id),
    service: RoomApplicationService = Depends(get_room_service),
    queries: RoomQueryService = Depends(get_query_service),
) -> RoomDetailResponse:
    await service.change_team(room_id, user_id, TeamSide(body.team))
    detail = await queries.get_room_detail(room_id, user_id)
    return RoomDetailResponse.model_validate(detail)


@router.delete(
    "/rooms/{room_id}/participants/me",
    tags=["rooms"],
    summary="방 나가기",
    response_model=LeaveResponse,
)
async def leave_room(
    room_id: int,
    user_id: int = Depends(get_current_user_id),
    service: RoomApplicationService = Depends(get_room_service),
) -> LeaveResponse:
    result = await service.leave_room(room_id, user_id)
    return LeaveResponse.model_validate(result)


@router.post(
    "/rooms/{room_id}/start",
    tags=["rooms"],
    summary="게임 시작(방 해산, 방장)",
    response_model=GameStartResponse,
)
async def start_game(
    room_id: int,
    user_id: int = Depends(get_current_user_id),
    service: RoomApplicationService = Depends(get_room_service),
) -> GameStartResponse:
    result = await service.start_game(room_id, user_id)
    return GameStartResponse(
        room_id=result.room_id,
        dissolved_at=result.dissolved_at,
        message=GAME_START_MESSAGE,
    )


# ---------------------------------------------------------------- me


@router.get(
    "/me/room", tags=["me"], summary="내가 참가 중인 방", response_model=CurrentRoomResponse
)
async def get_current_room(
    user_id: int = Depends(get_current_user_id),
    queries: RoomQueryService = Depends(get_query_service),
) -> CurrentRoomResponse:
    current = await queries.get_current_room(user_id)
    if current is None:
        return CurrentRoomResponse(room_id=None, title=None)
    return CurrentRoomResponse.model_validate(current)


@router.get(
    "/me/room-history", tags=["me"], summary="내 이용 이력", response_model=HistoryListResponse
)
async def list_history(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=50),
    user_id: int = Depends(get_current_user_id),
    queries: RoomQueryService = Depends(get_query_service),
) -> HistoryListResponse:
    history_page = await queries.list_history(user_id, page, size)
    return HistoryListResponse.model_validate(history_page)


@router.get(
    "/me/room-history/{room_id}",
    tags=["me"],
    summary="삭제된 방 보관 정보",
    response_model=ArchivedRoomResponse,
)
async def get_archived_room(
    room_id: int,
    user_id: int = Depends(get_current_user_id),
    queries: RoomQueryService = Depends(get_query_service),
) -> ArchivedRoomResponse:
    # 삭제되지 않은 방이거나 내가 참가한 적 없는 방은 404(조회 서비스의 예외).
    archived = await queries.get_archived_room(room_id, user_id)
    return ArchivedRoomResponse.model_validate(archived)
