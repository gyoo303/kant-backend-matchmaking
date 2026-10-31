# rooms ORM 모델

# RoomModel: rooms 테이블
# TeamModel: teams 테이블 (방마다 A·B 두 행)
# ParticipationModel: participations 테이블 — 현재 참가만 (team_id → teams)
#   - PK (room_id, user_id), user_id unique, left_at 없음 (ADR-011)
# ParticipationLogModel: participation_logs 테이블 — 끝난 이용 1건 = 1행, INSERT만
