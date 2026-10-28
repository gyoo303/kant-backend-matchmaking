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
