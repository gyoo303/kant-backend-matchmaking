"""rooms 요청·응답 스키마 (04-interfaces-api.md §5.2). 필드는 snake_case, 별칭 없음."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TeamValue = Literal["A", "B"]


class _Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RoomCreateRequest(_Schema):
    title: str = Field(..., max_length=100, description="방 제목(앞뒤 공백 제외 1~20자)")


class RoomRenameRequest(_Schema):
    title: str = Field(..., max_length=100, description="새 방 제목(앞뒤 공백 제외 1~20자)")


class TeamChangeRequest(_Schema):
    team: TeamValue = Field(..., description="옮길 팀(A 또는 B)")


class RoomSummaryResponse(_Schema):
    id: int = Field(..., description="방 ID")
    title: str = Field(..., description="방 제목")
    current_count: int = Field(..., description="현재 참가 인원")
    capacity: int = Field(..., description="정원(4명 고정)")
    is_full: bool = Field(..., description="정원 마감 여부")
    created_at: datetime = Field(..., description="생성 시각")


class RoomListResponse(_Schema):
    items: list[RoomSummaryResponse] = Field(..., description="이번 페이지의 방 목록")
    total: int = Field(..., description="검색·필터를 적용한 전체 방 수")
    page: int = Field(..., description="페이지 번호")
    size: int = Field(..., description="페이지 크기")


class ParticipantResponse(_Schema):
    user_id: int = Field(..., description="회원 ID")
    nickname: str = Field(..., description="닉네임")
    team: TeamValue = Field(..., description="소속 팀")
    is_host: bool = Field(..., description="방장 여부")


class RoomDetailResponse(_Schema):
    id: int = Field(..., description="방 ID")
    title: str = Field(..., description="방 제목")
    capacity: int = Field(..., description="정원(4명 고정)")
    current_count: int = Field(..., description="현재 참가 인원")
    is_full: bool = Field(..., description="정원 마감 여부")
    host_user_id: int = Field(..., description="현재 방장 회원 ID")
    participants: list[ParticipantResponse] = Field(
        ..., description="참가자(A팀 먼저, 팀 안에서 입장 순서)"
    )
    my_team: TeamValue | None = Field(..., description="조회한 회원의 팀, 참가자가 아니면 null")
    am_i_host: bool = Field(..., description="조회한 회원이 방장인지")
    created_at: datetime = Field(..., description="생성 시각")


class LeaveResponse(_Schema):
    room_deleted: bool = Field(..., description="마지막 참가자가 나가 방이 삭제됐는지")
    new_host_user_id: int | None = Field(..., description="방장이 바뀌었으면 새 방장 ID")


class GameStartResponse(_Schema):
    room_id: int = Field(..., description="해산된 방 ID")
    dissolved_at: datetime = Field(..., description="해산 시각")
    message: str = Field(..., description="안내 문구")


class CurrentRoomResponse(_Schema):
    room_id: int | None = Field(..., description="참가 중인 방 ID, 없으면 null")
    title: str | None = Field(..., description="참가 중인 방 제목, 없으면 null")


class HistoryItemResponse(_Schema):
    room_id: int = Field(..., description="방 ID")
    room_title: str = Field(..., description="방 제목")
    joined_at: datetime = Field(..., description="입장 시각")
    left_at: datetime | None = Field(..., description="퇴장 시각, 참가 중이면 null")
    is_current: bool = Field(..., description="참가 중 여부")
    room_deleted: bool = Field(..., description="방이 삭제됐는지")


class HistoryListResponse(_Schema):
    items: list[HistoryItemResponse] = Field(..., description="이번 페이지의 이용 기록")
    total: int = Field(..., description="전체 이용 기록 수")
    page: int = Field(..., description="페이지 번호")
    size: int = Field(..., description="페이지 크기")


class MyRecordResponse(_Schema):
    joined_at: datetime = Field(..., description="입장 시각")
    left_at: datetime | None = Field(..., description="퇴장 시각")


class ArchivedRoomResponse(_Schema):
    room_id: int = Field(..., description="방 ID")
    title: str = Field(..., description="방 제목")
    capacity: int = Field(..., description="정원")
    created_at: datetime = Field(..., description="생성 시각")
    deleted_at: datetime = Field(..., description="삭제 시각")
    my_records: list[MyRecordResponse] = Field(..., description="본인 이용 기록(입장순)")
