# rooms API — prefix /api

# GET    /rooms                               공개 방 목록
# POST   /rooms                               방 만들기
# GET    /rooms/{room_id}                     방 상세
# PATCH  /rooms/{room_id}                     방 제목 변경
# POST   /rooms/{room_id}/participants        참가
# PATCH  /rooms/{room_id}/participants/me     팀 변경
# DELETE /rooms/{room_id}/participants/me     나가기
# POST   /rooms/{room_id}/start               게임 시작

# GET    /me/room                             내가 참가 중인 방
# GET    /me/room-history                     내 이용 이력
# GET    /me/room-history/{room_id}           보관 정보
