// 방 화면 동작 (SCR-03 공개 방 목록, SCR-04 방 상세). api.js 다음에 불러온다.
// 사용자가 입력한 문자열(방 제목·닉네임)은 textContent로만 넣는다.
// 자동 조회는 없다. 화면 진입·[새로고침]·변경 요청 실패 직후에만 조회한다(SEQ-13, ADR-012).

const FAILED_TO_LOAD = "최신 정보를 불러오지 못했습니다";

// 조회 실패 안내는 다음 조회가 성공하면 지운다. 서버가 넘긴 안내(해산 등)는 그대로 둔다.
let showingLoadError = false;

function showLoadError() {
  showingLoadError = true;
  showNotice(FAILED_TO_LOAD, "error");
}

function clearLoadError() {
  if (showingLoadError) {
    showingLoadError = false;
    hideNotice();
  }
}

// [새로고침] 버튼에 조회 함수를 연결한다. 조회가 끝날 때까지 버튼을 막아 요청이 겹치지 않게 한다.
// 돌려주는 함수를 화면 진입 때와 변경 요청 실패 뒤에도 부른다.
function setupRefreshButton(load) {
  const button = document.getElementById("refresh-button");
  async function refresh() {
    button.disabled = true;
    await load();
    button.disabled = false;
  }
  button.addEventListener("click", refresh);
  return refresh;
}

// ---------------------------------------------------------------------------
// SCR-03 공개 방 목록 (메인)
// ---------------------------------------------------------------------------

// URL에서 온 검색 조건(서버가 data-* 속성으로 넘김)
function readListCondition() {
  const list = document.getElementById("room-list");
  return {
    keyword: list.dataset.keyword,
    availableOnly: list.dataset.availableOnly === "true",
    sort: list.dataset.sort,
    page: Number(list.dataset.page) || 1,
  };
}

// 조건을 쿼리 문자열로 만든다. 화면 주소와 API 주소가 같은 이름을 쓴다(PAGE-03, API-ROOM-01).
function listQuery(cond, page) {
  const params = new URLSearchParams();
  if (cond.keyword) {
    params.set("keyword", cond.keyword);
  }
  if (cond.availableOnly) {
    params.set("available_only", "true");
  }
  params.set("sort", cond.sort);
  params.set("page", String(page));
  return params.toString();
}

function renderRoomRows(rooms) {
  const tbody = document.getElementById("room-rows");
  tbody.textContent = "";
  rooms.forEach(function (room) {
    const row = document.createElement("tr");

    const title = document.createElement("td");
    title.className = "cell-title";
    title.textContent = room.title;

    const count = document.createElement("td");
    count.className = "nowrap";
    count.textContent = room.current_count + "/" + room.capacity;

    const created = document.createElement("td");
    created.className = "nowrap";
    created.textContent = formatTime(room.created_at);

    const state = document.createElement("td");
    state.className = "nowrap";
    state.textContent = room.is_full ? "정원 마감" : "빈자리";

    const action = document.createElement("td");
    const joinButton = document.createElement("button");
    joinButton.type = "button";
    joinButton.textContent = "참가";
    joinButton.disabled = room.is_full;
    joinButton.setAttribute("aria-label", room.title + " 참가");
    joinButton.addEventListener("click", function () {
      joinRoom(room.id, joinButton);
    });
    action.append(joinButton);

    row.append(title, count, created, state, action);
    tbody.append(row);
  });
}

function renderRoomPage(cond, data) {
  document.getElementById("room-total").textContent = "전체 " + data.total + "개";
  document.getElementById("room-empty").hidden = data.items.length > 0;
  renderRoomRows(data.items);
  renderPagination(document.getElementById("pagination"), data.page, data.size, data.total, function (page) {
    return "/?" + listQuery(cond, page);
  });
}

function renderCurrentRoom(data) {
  const box = document.getElementById("current-room");
  if (!data || data.room_id === null) {
    box.hidden = true;
    return;
  }
  const link = document.getElementById("current-room-link");
  link.textContent = data.title;
  link.href = "/rooms/" + data.room_id;
  box.hidden = false;
}

// 참가 성공 → 그 방 상세로 이동(사용자 확인 ①). 실패 → 사유 문구(REQ-019).
async function joinRoom(roomId, button) {
  button.disabled = true;
  const result = await apiRequest("POST", "/api/rooms/" + roomId + "/participants");
  if (result.ok) {
    location.href = "/rooms/" + roomId;
    return;
  }
  showNotice(errorMessage(result), "error");
  button.disabled = false;
}

// 방 만들기 성공 → 만든 방 상세로 이동(US-15). 실패 → 사유 문구(AC-15-7).
async function createRoom(event) {
  event.preventDefault();
  const button = document.getElementById("create-button");
  button.disabled = true;
  const result = await apiRequest("POST", "/api/rooms", {
    title: document.getElementById("create-room-title").value,
  });
  if (result.ok) {
    location.href = "/rooms/" + result.data.id;
    return;
  }
  showNotice(errorMessage(result), "error");
  button.disabled = false;
}

// 목록과 현재 참가 방을 함께 조회한다(SEQ-13). 검색·페이지 변경은 URL 이동이라 화면 진입으로 처리된다.
async function loadRoomList(cond) {
  const rooms = await apiRequest("GET", "/api/rooms?" + listQuery(cond, cond.page));
  const mine = await apiRequest("GET", "/api/me/room");
  if (rooms.ok) {
    renderRoomPage(cond, rooms.data);
  } else if (rooms.status !== 0) {
    showNotice(errorMessage(rooms), "error");
  }
  if (mine.ok) {
    renderCurrentRoom(mine.data);
  }
  if (rooms.status === 0 || mine.status === 0) {
    showLoadError();
  } else if (rooms.ok && mine.ok) {
    clearLoadError();
  }
}

function initRoomListPage() {
  if (!getAccessToken()) {
    return;
  }
  const cond = readListCondition();
  document.getElementById("create-form").addEventListener("submit", createRoom);

  const refresh = setupRefreshButton(function () {
    return loadRoomList(cond);
  });
  refresh();
}

// ---------------------------------------------------------------------------
// SCR-04 방 상세 (현황 대시보드)
// ---------------------------------------------------------------------------

const TEAM_SIZE = 2;

let lastDetail = null;
// 변경 요청을 보내는 동안 버튼을 막는다. 조회가 다시 그려도 풀리지 않게 따로 둔다.
let detailBusy = false;
// 상세 조회([새로고침]과 같은 동작). initRoomDetailPage에서 정한다.
let refreshDetail = null;

function detailRoomId() {
  return document.getElementById("room").dataset.roomId;
}

function teamMembers(detail, team) {
  return detail.participants.filter(function (p) {
    return p.team === team;
  });
}

// 팀 칸: 닉네임(방장은 ★·"(방장)"), 남은 자리는 "(빈자리)". 입장 순서는 보이지 않는다(REQ-045).
function renderTeam(team, members) {
  const key = team.toLowerCase();
  document.getElementById("team-" + key + "-count").textContent = members.length + "/" + TEAM_SIZE;
  const list = document.getElementById("team-" + key + "-members");
  list.textContent = "";
  members.forEach(function (member) {
    const item = document.createElement("li");
    item.textContent = member.is_host ? "★" + member.nickname + " (방장)" : member.nickname;
    list.append(item);
  });
  for (let i = members.length; i < TEAM_SIZE; i += 1) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "(빈자리)";
    list.append(empty);
  }
}

// 버튼 노출·활성은 응답의 my_team·am_i_host와 팀 인원으로 정한다(AC-16-2).
function updateDetailButtons() {
  const detail = lastDetail;
  if (detail === null) {
    return;
  }
  const isMember = detail.my_team !== null;
  const teamA = teamMembers(detail, "A").length;
  const teamB = teamMembers(detail, "B").length;

  document.getElementById("rename-box").hidden = !detail.am_i_host;
  document.getElementById("rename-button").disabled = detailBusy;

  document.getElementById("member-actions").hidden = !isMember;
  const otherTeam = detail.my_team === "A" ? "B" : "A";
  const moveButton = document.getElementById("move-button");
  moveButton.textContent = otherTeam + "팀으로 이동";
  moveButton.disabled = detailBusy;
  document.getElementById("leave-button").disabled = detailBusy;

  document.getElementById("host-actions").hidden = !detail.am_i_host;
  document.getElementById("start-button").disabled =
    detailBusy || teamA !== TEAM_SIZE || teamB !== TEAM_SIZE;

  document.getElementById("guest-actions").hidden = isMember || detail.is_full;
  document.getElementById("join-button").disabled = detailBusy;
}

// 제목 변경 입력칸은 건드리지 않는다.
function renderDetail(detail) {
  lastDetail = detail;
  document.getElementById("room-title").textContent = detail.title;
  document.getElementById("room-count").textContent = detail.current_count + "/" + detail.capacity;
  renderTeam("A", teamMembers(detail, "A"));
  renderTeam("B", teamMembers(detail, "B"));
  updateDetailButtons();
  document.getElementById("room").hidden = false;
}

// 410: 게임 시작으로 해산 → 목록 + 해산 안내(AC-16-4). 404: 해산과 다른 안내(AC-16-7).
// 401: api.js가 로그인 화면으로 보낸다(AC-16-6). 통신 실패: 마지막 정보 유지(AC-16-5).
function handleDetailError(result) {
  if (result.status === 401) {
    return;
  }
  if (result.status === 410) {
    location.href = "/?notice=dissolved";
  } else if (result.status === 404) {
    document.getElementById("room").hidden = true;
    showNotice("방을 찾을 수 없습니다", "error");
  } else if (result.status === 0) {
    showLoadError();
  } else {
    showNotice(errorMessage(result), "error");
  }
}

async function loadRoomDetail() {
  const result = await apiRequest("GET", "/api/rooms/" + detailRoomId());
  if (result.ok) {
    clearLoadError();
    renderDetail(result.data);
  } else {
    handleDetailError(result);
  }
}

// 변경 요청이 거부되면 사유를 보이고 상세를 한 번 다시 조회한다(SEQ-13).
// 해산된 방이면 서버는 400을 주고, 이어진 조회가 410이라 목록으로 간다(AC-16-4).
async function showChangeFailure(result) {
  showNotice(errorMessage(result), "error");
  updateDetailButtons();
  await refreshDetail();
}

// 변경 요청 공통: 보내는 동안 버튼을 막고, 성공하면 응답(RoomDetailResponse)으로 다시 그린다.
async function sendDetailChange(method, url, body) {
  detailBusy = true;
  updateDetailButtons();
  const result = await apiRequest(method, url, body);
  detailBusy = false;
  if (result.ok) {
    hideNotice();
    renderDetail(result.data);
  } else {
    await showChangeFailure(result);
  }
  return result;
}

async function renameRoom(event) {
  event.preventDefault();
  const input = document.getElementById("rename-title");
  const result = await sendDetailChange("PATCH", "/api/rooms/" + detailRoomId(), {
    title: input.value,
  });
  if (result.ok) {
    input.value = "";
  }
}

function moveTeam() {
  const otherTeam = lastDetail.my_team === "A" ? "B" : "A";
  sendDetailChange("PATCH", "/api/rooms/" + detailRoomId() + "/participants/me", { team: otherTeam });
}

function joinFromDetail() {
  sendDetailChange("POST", "/api/rooms/" + detailRoomId() + "/participants");
}

// 나가기 성공 → 공개 방 목록(사용자 확인 ②)
async function leaveRoom() {
  detailBusy = true;
  updateDetailButtons();
  const result = await apiRequest("DELETE", "/api/rooms/" + detailRoomId() + "/participants/me");
  if (result.ok) {
    location.href = "/";
    return;
  }
  detailBusy = false;
  await showChangeFailure(result);
}

// 게임 시작 성공 → 공개 방 목록 + 해산 안내(AC-16-3)
async function startGame() {
  detailBusy = true;
  updateDetailButtons();
  const result = await apiRequest("POST", "/api/rooms/" + detailRoomId() + "/start");
  if (result.ok) {
    location.href = "/?notice=dissolved";
    return;
  }
  detailBusy = false;
  await showChangeFailure(result);
}

function initRoomDetailPage() {
  if (!getAccessToken()) {
    return;
  }
  document.getElementById("rename-form").addEventListener("submit", renameRoom);
  document.getElementById("move-button").addEventListener("click", moveTeam);
  document.getElementById("leave-button").addEventListener("click", leaveRoom);
  document.getElementById("start-button").addEventListener("click", startGame);
  document.getElementById("join-button").addEventListener("click", joinFromDetail);

  // 다른 사람의 참가·이동은 [새로고침]으로 보인다(AC-16-1).
  refreshDetail = setupRefreshButton(loadRoomDetail);
  refreshDetail();
}
