### 개념 1: 레포지토리는 "번역가"
# 서비스(C) ──Room(도메인)──▶ RoomRepository ──RoomModel(ORM)──▶ DB
#          ◀──Room(도메인)──                ◀──RoomModel(ORM)──
# 서비스는 `Room`, `Participation` 같은 **도메인 객체만** 알고있다. 
# DB 행(ORM 객체)을 도메인으로 바꾸는 `_to_domain`, 
# 그 반대를 하는 `save`가 레포지토리의 일(책임)
# **ORM 객체는 레포지토리 밖으로 절대 내보내지 않는다**(GATE-08).

### 개념 2: `selectinload`와 `MissingGreenlet`
# 비동기 세션에서 `room_model.participations` 처럼 
# **아직 안 읽은 관계 속성**에 접근하면 SQLAlchemy가 
# 몰래 SELECT를 하려다 `MissingGreenlet` 오류 발생(STK-02). 
# 그래서 **사용해야 하는 관계는 처음 조회할 때 미리 같이 읽어들인다**
# select(RoomModel).options(
#     selectinload(RoomModel.teams),                    # 방 → 팀들
#     selectinload(RoomModel.participations)            # 방 → 참가들
#         .selectinload(ParticipationModel.team),       #        → 각 참가의 팀 (체인)
# )

# rooms 저장소 (flush만, commit은 서비스)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from rooms.domain.participation import Participation, TeamSide
from rooms.domain.room import DeleteReason, Room, RoomTitle
from rooms.domain.team import Team
from rooms.application.read_models import (
    ArchivedRoom,
    HistoryItem,
    MyRecord,
    ParticipantView,
    RoomDetail,
    RoomListCondition,
    RoomSummary
)

# v2에서 container로 의존성 분리한다.
from rooms.infrastructure.models import (
    ParticipationLogModel,
    ParticipationModel,
    RoomModel,
    TeamModel
)
from auth.infrastructure.models import UserModel

# RoomRepository
class RoomRepository:
    def __init__(self, session: AsyncSession) -> None:
        # 동일 요청 안에서는 서비스, 레파지토리가 세션 하나를 함께 쓴다.
        self.session = session

    #   - find_by_id: 없으면 None (404 판단은 서비스)
    async def find_by_id(self, room_id: int) -> Room | None:
        model = await self._find_model(room_id) # 방 아이디로 조회
        if model is None:
            return None  # "없음"만 알려주고, 응답코드로 내보낼지 여부는 서비스가 정한다.

    # 파일/클래스 안에서만 쓰는 메서드 -> _ 표시
    async def _find_model(self, room_id: int) -> RoomModel | None:
        """
        방 ORM 객체를 team, participation, participation의 team까지 한 번에 읽어온다
        (save도 재사용한다)
        """
        stmt = (
            select(RoomModel)
            .where(RoomModel.id == room_id)
            .options(
                selectinload(RoomModel.teams),
                selectinload(RoomModel.participations).selectinload(ParticipationModel.team),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    #   - find_current_participation: 이 회원의 현재 참가 (0~1건)
    async def find_current_participation(self, user_id: int) -> Participation | None:
        # participations에는 "현재 참가"만 있고, user_id가 unique하므로 결과는 0건 또는 1건이다.
        stmt = (
            select(ParticipationModel)
            .where(ParticipationModel.user_id == user_id)
            .options(selectinload(ParticipationModel.team))
        )
        result = await self.session.execute(stmt)
        # scalar_one_or_none() : 0건이면 None, 1건이면 해당 객체, 2건 이상이면 오류
        row = result.scalar_one_or_none()
        if row is None: # 0건이면 None 반환한다 // 2건 이상이면 오류가 난다.
            return None
        return self._participation_to_domain(row)

    def _to_domain(self, model: RoomModel) -> Room:
        """RoomModel (DB 계층의 형식) -> Room (도메인 계층의 형식)"""
        # 팀은 id, side만 넘긴다. 팀원 목록은 Room 생성자가 참가 목록으로 다시 채운다.
        teams = [Team(id=t.id, side=TeamSide(t.side)) for t in model.teams]

        # 입장 순서대로 정렬한다
        # 방장 위임(가장 먼저 들어온 사람) 판단이 가능해진다
        rows = sorted(model.participations, key=lambda row: row.join_order)
        
        return Room(
            id = model.id,
            title = RoomTitle(model.title), # str -> 값 객체로 감싼다 
            host_user_id = model.host_user_id,
            last_join_order = model.last_join_order,
            created_at = model.created_at,
            deleted_at = model.deleted_at,
            # DB - 문자열저장("EMPTY") -> 도메인 - Enum저장
            delete_reason = DeleteReason(model.delete_reason) if model.delete_reason else None,
            teams = teams,
            participations = [self.participation_to_domain(row) for row in rows],
        )

    def _participation_to_domain(self, row: ParticipationModel) -> Participation:
        # Participation에는 id가 없다 (두 외래키를 결합한 복합키 사용)
        # left_at은 DB에 없다 -> 넘기지 않는다 (기본값 None)
        return Participation(
            room_id = row.room_id,
            user_id = row.user_id,
            join_order = row.join_order,
            team = TeamSide(row.team.side), # selectinload 한 이유!
            joined_at = row.joined_at
        )


    #### RoomRepository.save -> 가장 중요한 메서드!!

    # 개념: save가 받는 'Room'의 모양
    # 서비스는 'find_by_id'로 받은 'Room'에 대하여
    # join / leave / start_game 등을 실행한 뒤 save(room) 호출
    # 그 시점의 room.participations에는 4종류 케이스가 존재한다.

    # 1. 참가중 & DB 행 없음
    # save -> 새 'ParticipationModel' 추가
    # 2. 참가중 & DB 행 있음
    # save -> 'team'만 갱신한다 (팀 변경 가능성)
    # 3. 종료 & left_at 있음 & DB 행 있음
    # ParticipationLogModel INSERT + DB Participation 행 삭제 (from leave/start_game)
    # 4. 종료 & DB 행 없음
    # ParticipationLogModel INSERT (save 동작 전에 들어왔다가 바로 나간 경우)

    #### 왜 team_id=숫자 대신 team=객체를 받을까?
    # 새 방은 flush 전까지 팀 id를 부여받지 못한 상태
    # 객체를 받으면 SQLAlchemy flush 시점에 팀을 먼저 INSERT 
    #   -> id를 Participations / ParticipationLog 테이블 행에 채운다
    # +다른 방의 팀 번호를 잘못 넣을 위험도 없어진다

    async def save(self, room: Room) -> Room:
        """
        도메인 Room 상태를 DB에 반영하고, flush 후 id가 채워진 Room을 돌려준다.
        commit은 하지 않는다. 서비스가 한 요청의 마지막에 1회만 commit 수행한다.
        """

        # 1. 방 ORM 객체 준비
        if room.id is None: # 새로운 방 : id 부여되지 않은 시점
            team_a = TeamModel(side=TeamSide.A.value)
            team_b = TeamModel(side=TeamSide.B.value)
            
            model = RoomModel(teams=[team_a, team_b], participations=[])
            self.session.add(model) # 세션에 등록
        else: # 기존 방: 팀, 참가 정보 모두 읽는다
            model = await self._find_model(room.id)
            if model is None: # room id는 존재하지만 DB 조회가 안될 경우
                raise ValueError(f"저장할 방이 DB에 없습니다: id={room.id}")

        # 2. 방 필드 복사 (도메인 to ORM)
        model.title = room.title.value # 값 객체 -> 문자열
        model.capacity = Room.CAPACITY
        model.host_user_id = room.host_user_id
        model.last_join_order = room.last_join_order
        model.created_at = room.created_at
        model.deleted_at = room.deleted_at
        model.delete_reason = room.delete_reason.value if room.delete_reason else None

        # 3. 참가 짝짓기
        # TeamSide -> 같은 방의 TeamModel 객체 (team_id 숫자를 직접 쓰지 않기 위해)
        team_models = {TeamSide(t.side): t for t in model.teams}
        # 지금 DB에 있는 participations 테이블 행을 (user_id, join_order)로 찾을 수 있게 dict
        rows = {(row.user_id, row.join_order): row for row in model.participations}

        for participation in room.participations:
            key = (participation.user_id, participation.join_order)
            row = rows.get(key) # 없으면 None
            team_model = team_models[participation.team]

            # 4종류 케이스 별로 분류하고 처리한다.
            if participation.is_current:
                if row is None:
                    # (1번케이스)참가 중 + 행 없음 -> 방금 들어온 사람: 새 행 추가
                    # room_id는 적지 않는다
                    #   -> model.participations에 append 하면 관계가 채워줌
                    model.participations.append(
                        ParticipationModel(
                            user_id = participation.user_id,
                            join_order = participation.join_order,
                            team = team_model,
                            joined_at = participation.joined_at
                        )
                    )
                else:
                    # (2번케이스) 참가 중 + 행 있음 -> 팀만 맞춘다
                    # 팀 변경 없었다면 값이 같으므로 UPDATE도 일어나지 않는다.
                    row.team = team_model
            else:
                # 끝난 참가 -> 로그 먼저 INSERT
                self.session.add(
                    ParticipationLogModel(
                        room = model, # 방도 객체로 연결한다 (새 방이어도 ok)
                        user_id = participation.user_id,
                        join_order = participation.join_order,
                        team = team_model, # 나갈 때(마지막) 시점의 최종 팀 정보
                        joined_at = participation.joined_at,
                        left_at = participation.left_at,
                    )
                )

                # 그 다음 참가 행 제거//
                # cascade="delete orphan" 설정 -> flush로 DELETE된다.
                # 행이 없으면 저장 전에 이미 끝난 참가이므로, 로그만 남긴다.
                if row is not None:
                    model.participations.remove(row)

        # 4. flush -> SQL을 DB로 보낸다, 확정(commit)은 안한다
        # 이 시점에서 새로운 방 / 룸 / 로그 테이블 행의 id가 입력된다.
        await self.session.flush()

        # 서비스는 이 반환값을 받아 room.id 등을 읽는다.
        return self._to_domain(model)



### 개념: 조회 전용 레포지토리 - 
# "화면 or API 모양의" 읽기 모델을 돌려준다
# 도메인 규칙이 필요없는 '보여주기' - 도메인 안 거치고 바로 만든다(단순+빠름)

class RoomQueryRepository:
    """
    조회 전용 저장소. ORM 객체 -> 읽기 모델(frozen dataclass)로 바꿔준다.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_active_rooms(self, cond: RoomListCondition) -> tuple[list[RoomSummary], int]:
        # 화면 -> 정렬 옵션 선택
        # 정렬: 생성 시각이 같을 때를 대비해 id를 두 번째 기준으로 추가한다(보험)
        if cond.sort == "newest":
            order = (RoomModel.created_at.desc(), 
                     RoomModel.id.desc())
        else:
            order = (RoomModel.created_at.asc(),
                     RoomModel.id.asc())

        stmt = (
            select(RoomModel)
            .where(RoomModel.deleted_at == None) # 삭제된 방은 제외
            .options(selectinload(RoomModel.participations)) # 현재 인원 계산용
            .order_by(*order) # 튜플을 풀어서 -> order_by(a, b)로 넘겨준다
        )

        result = await self.session.execute(stmt)

        # scalars(): 행 대신 RoomModel 객체들만 꺼낸다.
        models = result.scalars().all() 

        summaries: list[RoomSummary] = []
        for model in models:
            # participations에는 현재 참가만 있다 -> 길이(len) = 인원(count)
            current_count = len(model.participations)

            # 검색어 필터 (keyword의 strip, 빈 문자열 처리 -> router에서 수행)
            if cond.keyword is not None and cond.keyword.lower() not in model.title.lower():
                continue # 조건에 안맞으면 건너뜀

            # 빈자리 필터
            if cond.available_only and current_count >= model.capacity:
                continue

            summaries.append(
                RoomSummary(
                    id = model.id,
                    title = model.title,
                    current_count = current_count,
                    capacity = model.capacity,
                    is_full = current_count >= model.capacity,
                    created_at = model.created_at,
                )
            )

        total = len(summaries) # 전체 페이지 숫자를 계산하기 전 총 갯수
        start = (cond.page - 1) * cond.size 
        return summaries[start : start + cond.size], total

    async def get_room_detail(self, room_id: int) -> RoomDetail | None:
        stmt = (
            select(RoomModel)
            .where(RoomModel.id == room_id, RoomModel.deleted_at == None) 
            .options(selectinload(RoomModel.participations).selectinload(ParticipationModel.team))
        )
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None # 없는 방, 삭제된 방 -> 서비스에서 응답코드 결정한다.

        # 정렬 : A팀 먼저, 같은 팀 안에서는 입장 순서대로.
        rows = sorted(model.participations, key=lambda row: (row.team.side, row.join_order))

        participants: list[ParticipantView] = []
        for row in rows:
            # session.get(모델, PK) : PK로 한 행 읽기
            # 세션에 이미 있으면 SQL 안거치고 바로 돌려준다.
            user = await self.session.get(UserModel, row.user_id)
            participants.append(
                ParticipantView(
                    user_id = row.user_id,
                    nickname = user.nickname if user is not None else "", # FK이므로 정상 시나리오에서 존재
                    team = TeamSide(row.team.side),
                    is_host = row.user_id == model.host_user_id, 
                )
            )

            current_count = len(model.participations)
            return RoomDetail(
                id = model.id,
                title = model.title,
                capacity = model.capacity,
                current_count = current_count,
                is_full = current_count >= model.capacity,
                host_user_id = model.host_user_id,
                participants = participants,
                my_team = None, # 레포지토리는 "방에 입장한 어떤 유저가 보는지" 모른다 -> 서비스가 replace로 채운다.
                am_i_host = False,
                created_at = model.created_at,
            )

    ## `list_history`·`get_archived_room`
    ### 개념: 이력 = 두 테이블 합치기

    # 현재 참가 (participations, 0~1건)   ─┐
    #                                    ├─▶ HistoryItem 목록 → joined_at 최신순 정렬 → 페이지 자르기
    # 끝난 기록 (participation_logs, N건) ─┘

    ##### 여기서 잠깐: python - stable sort (안정 정렬)
    # 정렬 기준값이 동일하면, 정렬 이전 원래 순서를 보존한다.
    # SQL에서 joined_at desc, id desc로 미리 정렬 
    #   -> 파이썬 최종 정렬 시 joined_at 기준으로만 정렬해도 id desc 정렬조건이 보존된다.

    async def list_history(
            self, user_id: int, page: int, size: int
    ) -> tuple[list[HistoryItem], int]:
        
        # 현재 참가 (본인 것만)
        # 방 제목, 삭제 여부를 읽으므로 .room을 미리 로딩한다
        current_stmt = (
            select(ParticipationModel)
            .where(ParticipationModel.user_id == user_id)
            .options(selectinload(ParticipationModel.room))
        )
        current_rows = (await self.session.execute(current_stmt)).scalars().all()

        # 끝난 기록 (본인 것만)
        # 최신순, 같으면 id 큰 것 먼저.
        log_stmt = (
            select(ParticipationLogModel)
            .where(ParticipationLogModel.user_id == user_id)
            .options(selectinload(ParticipationLogModel.room))
            .order_by(ParticipationLogModel.joined_at.desc(),
                      ParticipationLogModel.id.desc())
        )

        log_rows = (await self.session.execute(log_stmt)).scalars().all()

        # 현재 참가(본인) + 끝난 참가(본인) 
        # -> 둘다 HistoryItem으로 바꿔 리스트 하나에 담는다
        items: list[HistoryItem] = []
        for row in current_rows:
            items.append(
                HistoryItem(
                    room_id = row.room_id,
                    room_title = row.room.title,
                    joined_at = row.joined_at,
                    left_at = None, # 아직 안 나감
                    is_current = True,
                    room_deleted = rw.room.deleted_at is not None,
                )
            )

        for log in log_rows:
            items.append(
                HistoryItem(
                    room_id = log.room_id,
                    room_title = log.room.title,
                    joined_at = log.joined_at,
                    left_at = log.left_at,
                    is_current = False,
                    room_deleted = log.room.deleted_at is not None,
                )
            )

        # 현재기록, 끝난기록 합쳐서 최신순 정렬
        # 안정 정렬이므로 기존 로그의 id 순서는 유지된다
        items.sort(key=lambda item: item.joined_at, reverse=True)

        total = len(items)
        start = (page - 1) * size
        return items[start : start + size], total


    async def get_archived_room(self, room_id: int, user_id: int) -> ArchivedRoom | None:
        # 관계를 안 읽는다, selectinload 없이 PK 조회로 충분하다.
        room = await self.session.get(RoomModel, room_id)
        if room is None or room.deleted_at is None:
            return None # 없는 방, 또는 아직 활성 상태인 방은 보관정보X -> 404 (NotFoundError)

        stmt = (
            select(ParticipationLogModel)
            .where(
                ParticipationLogModel.room_id == room_id,
                ParticipationLogModel.user_id == user_id,
            )
            .order_by(ParticipationLogModel.joined_at,
                      ParticipationLogModel.id) # 오래된 순
        )

        logs = (await self.session.execute(stmt)).scalars().all() # 객체 형태로 모두 꺼내기
        if not logs:
            return None # 이 방에 참가한 적이 없으면 NotFoundError 404

        return ArchivedRoom(
            room_id = room.id,
            title = room.title,
            capacity = room.capacity,
            created_at = room.created_at,
            deleted_at = room.deleted_at,
            my_records = [MyRecord(joined_at=log.joined_at, left_at=log.left_at) for log in logs]
        )


