// 방 목록·방 상세 화면 동작
// 자동 조회 없음: 화면 진입·[새로고침] 클릭 때만 조회, 상세는 변경 거부 뒤 1회 재조회 (SEQ-13, ADR-012)
//
// B의 api.js(base.html이 먼저 불러옴)에서 쓰는 함수 — 직접 fetch하지 않는다(CONV-09):
//   apiRequest(method, url, body) → { ok, status, data }   통신 실패는 status 0, 401은 api.js가 /login으로 보냄
//   errorMessage(result), showNotice(message, kind), hideNotice(), formatTime(iso),
//   renderPagination(nav, page, size, total, makeHref), getAccessToken()
// 토큰이 없을 때 /login 이동은 base.html의 data-require-login과 api.js가 한다. 여기서는 바로 끝낸다.
//
// 보안: 서버에서 온 값(방 제목, 닉네임, detail 문구)은 textContent로만 넣는다(XSS 방지).

const FAILED_TO_LOAD = "최신 정보를 불러오지 못했습니다";
const NOT_FOUND_TEXT = "방을 찾을 수 없습니다";
const DISSOLVED_URL = "/?notice=dissolved";
const TEAM_SIZE = 2;

// ------------------------------------------------------------------ 공통 안내 (#notice)

// 지금 #notice에 보이는 것이 조회 실패 안내인지. 거부 사유는 이어진 조회가 성공해도 지우지 않는다.
let showingLoadError = false;

function showLoadError() {
  showNotice(FAILED_TO_LOAD, "error");
  showingLoadError = true;
}

function clearLoadError() {
  if (showingLoadError) {
    hideNotice();
    showingLoadError = false;
  }
}

function showError(message) {
  showNotice(message, "error");
  showingLoadError = false;
}

function isLoadFailure(result) {
  // 통신 실패와 5xx는 SEQ-13대로 같은 조회 실패 문구로 묶는다(팀 결정 필요 항목)
  return result.status === 0 || result.status >= 500;
}

function setupRefreshButton(load) {
  const button = document.getElementById("refresh-button");
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await load();
    } finally {
      button.disabled = false;
    }
  });
}

// ------------------------------------------------------------------ 목록 (SCR-03)

function readListCondition() {
  const data = document.getElementById("room-list").dataset;
  return {
    keyword: data.keyword || "",
    availableOnly: data.availableOnly === "true",
    sort: data.sort || "newest",
    page: Number(data.page) || 1,
  };
}

// 화면 주소와 API가 같은 쿼리 이름을 쓴다(keyword, available_only, sort, page)
function listQuery(cond, page) {
  const query = new URLSearchParams();
  if (cond.keyword) {
    query.set("keyword", cond.keyword);
  }
  if (cond.availableOnly) {
    query.set("available_only", "true");
  }
  query.set("sort", cond.sort);
  query.set("page", String(page));
  return query.toString();
}

function renderRoomRows(rooms) {
  const rows = document.getElementById("room-rows");
  rows.replaceChildren();
  for (const room of rooms) {
    const row = document.createElement("tr");

    const titleCell = document.createElement("td");
    titleCell.className = "cell-title";
    const link = document.createElement("a");
    link.href = "/rooms/" + room.id;
    link.textContent = room.title;
    titleCell.appendChild(link);

    const countCell = document.createElement("td");
    countCell.className = "nowrap";
    countCell.textContent = room.current_count + "/" + room.capacity;

    const timeCell = document.createElement("td");
    timeCell.className = "nowrap";
    timeCell.textContent = formatTime(room.created_at);

    const stateCell = document.createElement("td");
    stateCell.className = "nowrap";
    stateCell.textContent = room.is_full ? "정원 마감" : "참가 가능";

    const joinCell = document.createElement("td");
    const joinButton = document.createElement("button");
    joinButton.type = "button";
    joinButton.className = "secondary";
    joinButton.textContent = "참가";
    joinButton.disabled = room.is_full;
    joinButton.addEventListener("click", () => joinRoom(room.id, joinButton));
    joinCell.appendChild(joinButton);

    row.append(titleCell, countCell, timeCell, stateCell, joinCell);
    rows.appendChild(row);
  }
}

function renderRoomPage(roomPage, cond) {
  document.getElementById("room-total").textContent = "전체 " + roomPage.total + "개";
  document.getElementById("room-empty").hidden = roomPage.items.length > 0;
  renderRoomRows(roomPage.items);
  renderPagination(
    document.getElementById("pagination"),
    roomPage.page,
    roomPage.size,
    roomPage.total,
    (page) => "/?" + listQuery(cond, page),
  );
}

function renderCurrentRoom(currentRoom) {
  const area = document.getElementById("current-room");
  if (currentRoom.room_id === null) {
    area.hidden = true;
    return;
  }
  const link = document.getElementById("current-room-link");
  link.href = "/rooms/" + currentRoom.room_id;
  link.textContent = currentRoom.title;
  area.hidden = false;
}

function showListFailure(result) {
  if (result.status === 401) {
    return;
  }
  if (isLoadFailure(result)) {
    showLoadError();
  } else {
    showError(errorMessage(result));
  }
}

async function loadRoomList(cond) {
  const rooms = await apiRequest("GET", "/api/rooms?" + listQuery(cond, cond.page));
  if (!rooms.ok) {
    showListFailure(rooms);
    return;
  }
  renderRoomPage(rooms.data, cond);

  const current = await apiRequest("GET", "/api/me/room");
  if (!current.ok) {
    showListFailure(current);
    return;
  }
  renderCurrentRoom(current.data);
  clearLoadError();
}

async function joinRoom(roomId, button) {
  button.disabled = true;
  const result = await apiRequest("POST", "/api/rooms/" + roomId + "/participants");
  if (result.ok) {
    location.href = "/rooms/" + roomId;
    return;
  }
  button.disabled = false;
  showListFailure(result);
}

async function createRoom(event) {
  event.preventDefault();
  const button = document.getElementById("create-button");
  const title = document.getElementById("create-room-title").value;
  button.disabled = true;
  const result = await apiRequest("POST", "/api/rooms", { title });
  if (result.ok) {
    location.href = "/rooms/" + result.data.id;
    return;
  }
  button.disabled = false;
  showListFailure(result);
}

function initRoomListPage() {
  if (!getAccessToken()) {
    return;
  }
  const cond = readListCondition();
  setupRefreshButton(() => loadRoomList(cond));
  document.getElementById("create-form").addEventListener("submit", createRoom);
  loadRoomList(cond);
}

// ------------------------------------------------------------------ 상세 (SCR-04)

let detailRoomId = null;
let lastDetail = null;
// 변경 요청을 보내는 동안 모든 버튼을 잠근다. 조회가 다시 그려도 풀리지 않게 상태로 둔다.
let detailBusy = false;

function detailUrl(suffix) {
  return "/api/rooms/" + detailRoomId + suffix;
}

function teamMembers(detail, side) {
  // participants는 서버가 A팀 먼저, 팀 안에서 입장 순서로 정렬해 준다. 순서 번호는 보이지 않는다(REQ-045).
  return detail.participants.filter((participant) => participant.team === side);
}

function renderTeam(side, members) {
  const key = side.toLowerCase();
  document.getElementById("team-" + key + "-count").textContent = members.length + "/" + TEAM_SIZE;
  const list = document.getElementById("team-" + key + "-members");
  list.replaceChildren();
  for (const member of members) {
    const item = document.createElement("li");
    item.textContent = member.is_host ? "★" + member.nickname + " (방장)" : member.nickname;
    list.appendChild(item);
  }
  for (let seat = members.length; seat < TEAM_SIZE; seat += 1) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = "(빈자리)";
    list.appendChild(item);
  }
}

function updateDetailButtons() {
  if (lastDetail === null) {
    return;
  }
  const isMember = lastDetail.my_team !== null;
  document.getElementById("rename-box").hidden = !lastDetail.am_i_host;
  document.getElementById("member-actions").hidden = !isMember;
  document.getElementById("host-actions").hidden = !lastDetail.am_i_host;
  document.getElementById("guest-actions").hidden = isMember;

  const moveButton = document.getElementById("move-button");
  if (isMember) {
    moveButton.textContent = (lastDetail.my_team === "A" ? "B" : "A") + "팀으로 이동";
  }
  for (const button of document.querySelectorAll("#room button")) {
    button.disabled = detailBusy;
  }
  const teamsReady =
    teamMembers(lastDetail, "A").length === TEAM_SIZE &&
    teamMembers(lastDetail, "B").length === TEAM_SIZE;
  document.getElementById("start-button").disabled = detailBusy || !teamsReady;
  document.getElementById("join-button").disabled = detailBusy || lastDetail.is_full;
}

function renderDetail(detail) {
  lastDetail = detail;
  document.getElementById("room").hidden = false;
  document.getElementById("room-title").textContent = detail.title;
  document.getElementById("room-count").textContent = detail.current_count + "/" + detail.capacity;
  renderTeam("A", teamMembers(detail, "A"));
  renderTeam("B", teamMembers(detail, "B"));
  updateDetailButtons();
}

function handleDetailError(result) {
  if (result.status === 401) {
    return;
  }
  if (result.status === 410) {
    location.href = DISSOLVED_URL;
  } else if (result.status === 404) {
    // 해산 안내와 다른 문구(AC-16-7)
    document.getElementById("room").hidden = true;
    showError(NOT_FOUND_TEXT);
  } else if (isLoadFailure(result)) {
    // 마지막으로 그린 정보는 그대로 두고 안내만 보인다(AC-16-5)
    showLoadError();
  } else {
    showError(errorMessage(result));
  }
}

async function loadRoomDetail() {
  const result = await apiRequest("GET", detailUrl(""));
  if (result.ok) {
    renderDetail(result.data);
    clearLoadError();
  } else {
    handleDetailError(result);
  }
}

// 거부 사유를 보이고 상세를 1회 다시 읽는다. 해산된 방이면 400 뒤 조회가 410이라 목록으로 간다(AC-16-4).
async function showChangeFailure(result) {
  if (result.status === 401) {
    return;
  }
  showError(errorMessage(result));
  await loadRoomDetail();
}

// 변경 요청 하나. 성공하면 응답 data를, 실패하면 null을 돌려준다. 성공 뒤에는 다시 조회하지 않는다.
async function sendDetailChange(method, url, body) {
  if (detailBusy) {
    return null;
  }
  detailBusy = true;
  updateDetailButtons();
  let result;
  try {
    result = await apiRequest(method, url, body);
  } finally {
    detailBusy = false;
    updateDetailButtons();
  }
  if (!result.ok) {
    await showChangeFailure(result);
    return null;
  }
  hideNotice();
  showingLoadError = false;
  return result.data;
}

async function renameRoom(event) {
  event.preventDefault();
  const input = document.getElementById("rename-title");
  const detail = await sendDetailChange("PATCH", detailUrl(""), { title: input.value });
  if (detail) {
    renderDetail(detail);
    input.value = "";
  }
}

async function moveTeam() {
  const team = lastDetail.my_team === "A" ? "B" : "A";
  const detail = await sendDetailChange("PATCH", detailUrl("/participants/me"), { team });
  if (detail) {
    renderDetail(detail);
  }
}

async function joinFromDetail() {
  const detail = await sendDetailChange("POST", detailUrl("/participants"));
  if (detail) {
    renderDetail(detail);
  }
}

async function leaveRoom() {
  if (await sendDetailChange("DELETE", detailUrl("/participants/me"))) {
    location.href = "/";
  }
}

async function startGame() {
  if (await sendDetailChange("POST", detailUrl("/start"))) {
    location.href = DISSOLVED_URL;
  }
}

function initRoomDetailPage() {
  if (!getAccessToken()) {
    return;
  }
  detailRoomId = document.getElementById("room").dataset.roomId;
  setupRefreshButton(() => {
    hideNotice();
    showingLoadError = false;
    return loadRoomDetail();
  });
  document.getElementById("rename-form").addEventListener("submit", renameRoom);
  document.getElementById("move-button").addEventListener("click", moveTeam);
  document.getElementById("join-button").addEventListener("click", joinFromDetail);
  document.getElementById("leave-button").addEventListener("click", leaveRoom);
  document.getElementById("start-button").addEventListener("click", startGame);
  loadRoomDetail();
}
