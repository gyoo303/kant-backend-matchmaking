# 조회 결과, 조건을 담는 읽기 모델

# [읽기 모델이란?]
# 화면, API에 보여줄 모양만 담은 아주 단순한 데이터 상자
# - 도메인 모델(Room, Team, Participation)은 규칙을 지키는 "행동하는 객체"
#   - join, leave 같은 메서드가 있고, 잘못된 상태가 되지 않게 스스로 검사한다
# - ORM 모델(RoomModel 등)은 "DB 테이블 한 줄"을 그대로 옮긴 객체
#   - 세션에 묶여 있어서 밖으로 내보내면 지연 로딩 오류 등이 생길 수 있다
# - 읽기 모델은 둘 다 아니다. 조회 결과를 "보여 주기 좋게" 담기만 한다
#   - 규칙도 없고, DB와도 연결되지 않는다. 그래서 어디로 넘겨도 안전.

# [데이터흐름]
# DB 행 ㅡ (RoomQueryRepository가 변환) ㅡ 읽기 모델 ㅡ (RoomQueryService) ㅡ 라우터
#   라우터: RoomDetailResponse.model_validate(detail)

# [이 파일의 규칙]
# - sqlalchemy, ORM 모델(infrastructure.models)을 임포트하지 않는다.
#   application 계층이므로 DB 구현을 몰라야 한다.
# - import는 표준 라이브러리 + 동일 기능의 domain(TeamSide)만 한다.

# [@dataclass(frozen=True)에 대해서]
# - @dataclass: __init__, __repr__, __eq__를 자동으로 생성
#   RoomSummary(id=1, title="방", ...)처럼 바로 생성 가능
# - frozen=True : 만든 뒤에는 값을 바꿀 수 없다 (불변객체)
#   summary.title = "x" -> dataclasses.FrozenInstanceError
#   값을 바꾼 "복사본"이 필요하면 -> dataclasses.replace(obj, 필드=새값)

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

# TeamSide 원래 위치 - rooms.domain.participation
# C의 room.py가 __all__로 다시 내보낸다 -> 여기서 가져와도 동일 클래스
from rooms.domain.room import TeamSide


# RoomListCondition
# 방 목록 검색, 정렬 등
@dataclass(frozen=True)
class RoomListCondition:
    keyword: str | None  # None = 검색 안 함
    available_only: bool  # True면 빈자리(현재 인원 < 정원) 있는 방만.
    sort: Literal["newest", "oldest"]
    # Literal["newest", "oldest"]: 이 두 문자열만 올 수 있다는 타입힌트
    # 실행 중 강제 검사는 X, but 라우터 Query 검증이 이미 두 값만 통과시킨다.

    page: int  # 페이지, 1부터 시작한다
    size: int  # 한 페이지에 표시되는 항목 갯수


# RoomSummary
# 방 목록 한 줄 (API-ROOM-01 items) ↔ schemas.RoomSummaryResponse
@dataclass(frozen=True)
class RoomSummary:
    id: int
    title: str
    current_count: int  # DB 컬럼 없음 -> participations 행 수로 계산
    capacity: int
    is_full: bool
    created_at: datetime


# ParticipantView
# 방 상세의 참가자 한 명 ↔ schemas.ParticipantResponse (입장 순서는 넣지 않는다, REQ-045)
@dataclass(frozen=True)
class ParticipantView:
    user_id: int
    nickname: str
    team: TeamSide
    is_host: bool


# RoomDetail
# 방 상세 (API-ROOM-03, 변경 API 응답) ↔ schemas.RoomDetailResponse
@dataclass(frozen=True)
class RoomDetail:
    id: int
    title: str
    capacity: int
    current_count: int
    is_full: bool
    host_user_id: int
    participants: list[ParticipantView]  # A팀 먼저, 팀 안에서는 입장 순서
    # 보는 사람 기준 값 -> 레포지토리는 None/False로 두고 조회 서비스가 replace로 채운다
    my_team: TeamSide | None
    am_i_host: bool
    created_at: datetime


# CurrentRoom
# 내가 지금 참가 중인 방 (API-ROOM-09) ↔ schemas.CurrentRoomResponse
@dataclass(frozen=True)
class CurrentRoom:
    room_id: int
    title: str


# HistoryItem
# 이용 기록 한 줄 (API-ROOM-10) ↔ schemas.HistoryItemResponse
# 출처: participations(참가 중) + participation_logs(끝난 참가). 기록 ID 없음 (D-025)
@dataclass(frozen=True)
class HistoryItem:
    room_id: int
    room_title: str
    joined_at: datetime
    left_at: datetime | None
    is_current: bool
    room_deleted: bool


# MyRecord
# 보관 정보 안의 내 입장·퇴장 기록 한 건 ↔ schemas.MyRecordResponse
@dataclass(frozen=True)
class MyRecord:
    joined_at: datetime
    left_at: datetime | None


# ArchivedRoom
# 삭제된 방의 보관 정보 (API-ROOM-11) ↔ schemas.ArchivedRoomResponse — 다른 회원 정보 없음 (D-009)
@dataclass(frozen=True)
class ArchivedRoom:
    room_id: int
    title: str
    capacity: int
    created_at: datetime
    deleted_at: datetime
    my_records: list[MyRecord]


# RoomPage
# 페이지 묶음 — total은 자르기 전 전체 개수
@dataclass(frozen=True)
class RoomPage:
    items: list[RoomSummary]
    total: int
    page: int
    size: int


# HistoryPage
@dataclass(frozen=True)
class HistoryPage:
    items: list[HistoryItem]
    total: int
    page: int
    size: int


# LeaveResult
# 변경 결과 — C의 service.py가 만든다
@dataclass(frozen=True)
class LeaveResult:
    room_deleted: bool  # 마지막 1명이 나가 방이 삭제됐는가
    new_host_user_id: int | None  # 방장 위임이 있었으면 새 방장, 아니면 None


# GameStartResult
@dataclass(frozen=True)
class GameStartResult:
    room_id: int
    dissolved_at: datetime
