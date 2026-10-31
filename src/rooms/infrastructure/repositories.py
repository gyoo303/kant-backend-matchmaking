# rooms 저장소 (flush만, commit은 서비스)

# RoomRepository — 변경용
#   - find_by_id
#   - find_current_participation
#   - save: 끝난 참가는 participation_logs로 옮기고 participations 행은 지운다

# RoomQueryRepository — 조회용, 읽기 모델로 반환
#   - list_active_rooms
#   - get_room_detail
#   - list_history: 현재 참가 + 이용 로그를 합친다
#   - get_archived_room: 이용 로그만 읽는다
