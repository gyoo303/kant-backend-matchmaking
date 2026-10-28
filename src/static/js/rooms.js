// 방 화면 동작 (SCR-03 공개 방 목록, SCR-04 방 상세). api.js·polling.js 다음에 불러온다.
// 사용자가 입력한 문자열(방 제목·닉네임)은 textContent로만 넣는다.

const FAILED_TO_LOAD = "최신 정보를 불러오지 못했습니다";

// 폴링 실패 안내는 다음 조회가 성공하면 지운다. 서버가 넘긴 안내(해산 등)는 그대로 둔다.
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

// 1초마다 다시 그리면 키보드 포커스가 사라지므로, 내용이 바뀌었을 때만 다시 그린다.
let lastRoomPage = "";

function renderRoomPage(cond, data) {
  const snapshot = JSON.stringify(data);
  if (snapshot === lastRoomPage) {
    return;
  }
  lastRoomPage = snapshot;
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

function initRoomListPage() {
  if (!getAccessToken()) {
    return;
  }
  const cond = readListCondition();
  document.getElementById("create-form").addEventListener("submit", createRoom);

  // 목록과 현재 참가 방을 1초마다 함께 조회한다(SEQ-13).
  startPolling(async function (isCurrent) {
    const rooms = await apiRequest("GET", "/api/rooms?" + listQuery(cond, cond.page));
    const mine = await apiRequest("GET", "/api/me/room");
    if (!isCurrent()) {
      return;
    }
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
  });
}

// ---------------------------------------------------------------------------
// SCR-04 방 상세 (현황 대시보드)
// ---------------------------------------------------------------------------

const TEAM_SIZE = 2;

let detailPolling = null;
let lastDetail = null;
let lastDetailSnapshot = "";
// 변경 요청을 보내는 동안 버튼을 막는다. 폴링이 다시 그려도 풀리지 않게 따로 둔다.
let detailBusy = false;

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

// 1초마다 다시 그리면 포커스가 사라지므로 바뀌었을 때만 다시 그린다. 제목 변경 입력칸은 건드리지 않는다.
function renderDetail(detail) {
  lastDetail = detail;
  const snapshot = JSON.stringify(detail);
  if (snapshot !== lastDetailSnapshot) {
    lastDetailSnapshot = snapshot;
    document.getElementById("room-title").textContent = detail.title;
    document.getElementById("room-count").textContent = detail.current_count + "/" + detail.capacity;
    renderTeam("A", teamMembers(detail, "A"));
    renderTeam("B", teamMembers(detail, "B"));
  }
  updateDetailButtons();
  document.getElementById("room").hidden = false;
}

function stopDetailPolling() {
  if (detailPolling !== null) {
    detailPolling.stop();
  }
}

// 410: 게임 시작으로 해산 → 목록 + 해산 안내(AC-16-4). 404: 해산과 다른 안내(AC-16-7).
// 401: api.js가 로그인 화면으로 보낸다(AC-16-6). 통신 실패: 마지막 정보 유지(AC-16-5).
function handleDetailError(result) {
  if (result.status === 410) {
    stopDetailPolling();
    location.href = "/?notice=dissolved";
  } else if (result.status === 404) {
    stopDetailPolling();
    document.getElementById("room").hidden = true;
    showNotice("방을 찾을 수 없습니다", "error");
  } else if (result.status === 401) {
    stopDetailPolling();
  } else if (result.status === 0) {
    showLoadError();
  } else {
    showNotice(errorMessage(result), "error");
  }
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
    showNotice(errorMessage(result), "error");
    updateDetailButtons();
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
    stopDetailPolling();
    location.href = "/";
    return;
  }
  detailBusy = false;
  showNotice(errorMessage(result), "error");
  updateDetailButtons();
}

// 게임 시작 성공 → 조회 중단 후 공개 방 목록(AC-16-3)
async function startGame() {
  detailBusy = true;
  updateDetailButtons();
  const result = await apiRequest("POST", "/api/rooms/" + detailRoomId() + "/start");
  if (result.ok) {
    stopDetailPolling();
    location.href = "/";
    return;
  }
  detailBusy = false;
  showNotice(errorMessage(result), "error");
  updateDetailButtons();
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

  // 상세를 1초마다 조회한다(SEQ-13). 다른 사람의 참가·이동이 2초 안에 보인다(AC-16-1).
  detailPolling = startPolling(async function (isCurrent) {
    const result = await apiRequest("GET", "/api/rooms/" + detailRoomId());
    if (!isCurrent()) {
      return;
    }
    if (result.ok) {
      clearLoadError();
      renderDetail(result.data);
    } else {
      handleDetailError(result);
    }
  });
}
