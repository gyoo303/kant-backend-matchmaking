# rooms 요청·응답 스키마 — 04-interfaces-api.md §5.2
#
# - 필드 이름은 문서 표 그대로 snake_case, 별칭(camelCase) 없음. 화면 JS도 같은 이름을 쓴다.
# - 응답은 도메인 객체·읽기 모델(read_models.py의 dataclass)에서 model_validate 한다(ORM 아님).
# - 요청은 정의되지 않은 필드를 무시한다(pydantic 기본값 extra="ignore", AC-01-4).
# - 길이·문자 규칙은 도메인이 검사해 400을 낸다. 여기 max_length는 비정상 입력 방어(422)용.

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class _Schema(BaseModel):
    """rooms 스키마 공통 설정: 읽기 모델 객체의 속성에서 값을 읽는다."""

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- 요청


class RoomCreateRequest(_Schema):
    """방 만들기 요청."""

    title: str = Field(max_length=100, description="방 제목(앞뒤 공백 제외 1~20자)")


class RoomRenameRequest(_Schema):
    """방 제목 변경 요청(방장)."""

    title: str = Field(max_length=100, description="방 제목(앞뒤 공백 제외 1~20자)")


class TeamChangeRequest(_Schema):
    """내 팀 변경 요청. A·B 밖의 값은 422(AC-04-4)."""

    team: Literal["A", "B"] = Field(description="옮길 팀")


# ---------------------------------------------------------------- 응답: 목록·상세


class RoomSummaryResponse(_Schema):
    """공개 방 목록의 한 행."""

    id: int
    title: str
    current_count: int
    capacity: int
    is_full: bool
    created_at: datetime


class RoomListResponse(_Schema):
    """공개 방 목록. total은 조건을 적용한 건수."""

    items: list[RoomSummaryResponse]
    total: int
    page: int
    size: int


class ParticipantResponse(_Schema):
    """방 상세의 참가자. 입장 순서는 보내지 않는다(REQ-045)."""

    user_id: int
    nickname: str
    team: Literal["A", "B"]
    is_host: bool


class RoomDetailResponse(_Schema):
    """방 상세. participants는 A팀 먼저, 팀 안에서 입장 순서(정렬은 조회 서비스가 한다).
    my_team·am_i_host는 조회한 회원 기준."""

    id: int
    title: str
    capacity: int
    current_count: int
    is_full: bool
    host_user_id: int
    participants: list[ParticipantResponse]
    my_team: Literal["A", "B"] | None
    am_i_host: bool
    created_at: datetime


# ---------------------------------------------------------------- 응답: 변경 결과


class LeaveResponse(_Schema):
    """방 나가기 결과."""

    room_deleted: bool
    new_host_user_id: int | None


class GameStartResponse(_Schema):
    """게임 시작(방 해산) 결과."""

    room_id: int
    dissolved_at: datetime
    message: str


class CurrentRoomResponse(_Schema):
    """내가 참가 중인 방. 참가 중이 아니면 둘 다 null."""

    room_id: int | None
    title: str | None


# ---------------------------------------------------------------- 응답: 이용 기록


class HistoryItemResponse(_Schema):
    """이용 기록 한 건. 기록 ID(participation_id)는 넣지 않는다(D-025, AC-13-5)."""

    room_id: int
    room_title: str
    joined_at: datetime
    left_at: datetime | None
    is_current: bool
    room_deleted: bool


class HistoryListResponse(_Schema):
    """내 이용 기록. 정렬은 조회 서비스가 정한다(joined_at DESC, 같으면 로그 id DESC)."""

    items: list[HistoryItemResponse]
    total: int
    page: int
    size: int


class MyRecordResponse(_Schema):
    """보관 정보 안의 내 참가 기록 한 건."""

    joined_at: datetime
    left_at: datetime | None


class ArchivedRoomResponse(_Schema):
    """삭제된 방의 보관 정보. 다른 회원 정보는 없다(D-009)."""

    room_id: int
    title: str
    capacity: int
    created_at: datetime
    deleted_at: datetime
    my_records: list[MyRecordResponse]
