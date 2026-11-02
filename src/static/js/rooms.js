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

