"""rooms JSON API (04-interfaces-api.md §4.2, API-ROOM-01~11)."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from auth.presentation.dependencies import get_current_user_id
from database import get_db
from rooms.application.queries import RoomQueryService
from rooms.application.read_models import RoomListCondition
from rooms.application.service import RoomApplicationService
from rooms.domain.room import TeamSide
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

router = APIRouter(prefix="/api")

DISSOLVED_MESSAGE = "게임이 시작되어 방이 해산되었습니다"


def get_room_service(db: AsyncSession = Depends(get_db)) -> RoomApplicationService:
    return RoomApplicationService(db)


def get_room_query_service(db: AsyncSession = Depends(get_db)) -> RoomQueryService:
    return RoomQueryService(db)


@router.get("/rooms", tags=["rooms"], summary="공개 방 목록", response_model=RoomListResponse)
async def list_rooms(
    keyword: str | None = Query(None, max_length=50, description="제목 부분 검색어"),
    available_only: bool = Query(False, description="빈자리 있는 방만"),
    sort: Literal["newest", "oldest"] = Query("newest", description="생성 시각 정렬"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(10, ge=1, le=50, description="페이지 크기"),
    _: int = Depends(get_current_user_id),
    queries: RoomQueryService = Depends(get_room_query_service),
) -> RoomListResponse:
    trimmed = keyword.strip() if keyword else None
    cond = RoomListCondition(
        keyword=trimmed or None,
        available_only=available_only,
        sort=sort,
        page=page,
        size=size,
    )
    return RoomListResponse.model_validate(await queries.list_rooms(cond))


@router.post("/rooms", tags=["rooms"], summary="방 만들기", response_model=RoomDetailResponse)
async def create_room(
    body: RoomCreateRequest,
    user_id: int = Depends(get_current_user_id),
    service: RoomApplicationService = Depends(get_room_service),
    queries: RoomQueryService = Depends(get_room_query_service),
) -> RoomDetailResponse:
    room = await service.create_room(user_id, body.title)
    return RoomDetailResponse.model_validate(await queries.get_room_detail(room.id, user_id))


@router.get(
    "/rooms/{room_id}", tags=["rooms"], summary="방 상세", response_model=RoomDetailResponse
)
async def get_room(
    room_id: int,
    user_id: int = Depends(get_current_user_id),
    queries: RoomQueryService = Depends(get_room_query_service),
) -> RoomDetailResponse:
    return RoomDetailResponse.model_validate(await queries.get_room_detail(room_id, user_id))


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
    queries: RoomQueryService = Depends(get_room_query_service),
) -> RoomDetailResponse:
    await service.rename_room(room_id, user_id, body.title)
    return RoomDetailResponse.model_validate(await queries.get_room_detail(room_id, user_id))


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
    queries: RoomQueryService = Depends(get_room_query_service),
) -> RoomDetailResponse:
    await service.join_room(room_id, user_id)
    return RoomDetailResponse.model_validate(await queries.get_room_detail(room_id, user_id))


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
    queries: RoomQueryService = Depends(get_room_query_service),
) -> RoomDetailResponse:
    await service.change_team(room_id, user_id, TeamSide(body.team))
    return RoomDetailResponse.model_validate(await queries.get_room_detail(room_id, user_id))


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
    return LeaveResponse.model_validate(await service.leave_room(room_id, user_id))


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
        room_id=result.room_id, dissolved_at=result.dissolved_at, message=DISSOLVED_MESSAGE
    )


@router.get(
    "/me/room", tags=["me"], summary="내가 참가 중인 방", response_model=CurrentRoomResponse
)
async def get_my_room(
    user_id: int = Depends(get_current_user_id),
    queries: RoomQueryService = Depends(get_room_query_service),
) -> CurrentRoomResponse:
    current = await queries.get_current_room(user_id)
    if current is None:
        return CurrentRoomResponse(room_id=None, title=None)
    return CurrentRoomResponse.model_validate(current)


@router.get(
    "/me/room-history", tags=["me"], summary="내 이용 이력", response_model=HistoryListResponse
)
async def list_my_history(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(10, ge=1, le=50, description="페이지 크기"),
    user_id: int = Depends(get_current_user_id),
    queries: RoomQueryService = Depends(get_room_query_service),
) -> HistoryListResponse:
    return HistoryListResponse.model_validate(await queries.list_history(user_id, page, size))


@router.get(
    "/me/room-history/{room_id}",
    tags=["me"],
    summary="삭제된 방 보관 정보",
    response_model=ArchivedRoomResponse,
)
async def get_archived_room(
    room_id: int,
    user_id: int = Depends(get_current_user_id),
    queries: RoomQueryService = Depends(get_room_query_service),
) -> ArchivedRoomResponse:
    return ArchivedRoomResponse.model_validate(await queries.get_archived_room(room_id, user_id))
