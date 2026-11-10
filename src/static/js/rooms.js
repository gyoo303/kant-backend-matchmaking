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

// 안내는 페이지 맨 위에 있다. 아래쪽 버튼을 누르다 거부되면 안내가 화면 밖에 뜨므로,
// 보이지 않을 때만 안내까지 스크롤한다(이미 보이면 움직이지 않음).
function revealNotice() {
  const notice = document.getElementById("notice");
  if (notice) {
    notice.scrollIntoView({ block: "nearest" });
  }
}

function showLoadError() {
  showNotice(FAILED_TO_LOAD, "error");
  showingLoadError = true;
  revealNotice();
}

function clearLoadError() {
  if (showingLoadError) {
    hideNotice();
    showingLoadError = false;
  }
}

// [새로고침] 직전에 부른다 — 이전 안내 문구를 종류와 상관없이 지운다(SEQ-13)
//   clearLoadError와 차이: clearLoadError는 "불러오기 실패" 문구만 지운다(조회 성공 뒤 자동 정리용).
//   이 함수는 쓰기 결과 문구("입장 결과를 확인하지 못했습니다." 등)까지 지운다.
//   사용자가 지금 상태를 다시 확인하는 동작이라, 이전 결론은 더 이상 맞지 않기 때문이다.
function clearNoticeForRefresh() {
  hideNotice();
  showingLoadError = false;
}

function showError(message) {
  showNotice(message, "error");
  showingLoadError = false;
  revealNotice();
}

function isLoadFailure(result) {
  // 통신 실패와 5xx는 SEQ-13대로 같은 조회 실패 문구로 묶는다(팀 결정 필요 항목)
  return result.status === 0 || result.status >= 500;
}

// ----- 요청 진행 표시 (ADR-014)
// 고객 요구(CQ-08~12): 누르는 즉시 "처리 중", 3초 지나면 "지연 안내", 5초 안에 결론.
//   5초 시간 제한은 api.js의 apiRequest가 건다. 여기서는 화면에 무엇을 보여 줄지만 정한다.
// 결론별 문구는 상태 코드로 고른다(문구 문자열로 분기하지 않는다, D-016 / D-034):
//   409 = 서버가 바빠서 처리하지 못함, 0 = 결과 모름(시간 초과/통신 실패), 그 밖 = 서버가 준 사유

// **진행 문구가 평소(약 20ms)에도 잠깐 깜빡일 수 있다
// "감수할 점" "인지된 리스크" from ADR-014

const SLOW_NOTICE_MS = 3000;
const SLOW_TEXT = "사람이 많아 처리가 늦어지고 있습니다";
const MESSAGES = {
  // 참가 버튼(목록/상세) - 고객이 정한 문구.
  join: {
    progress: "입장 중...",
    busy: "입장하지 못했습니다. 다시 시도해 주세요",
    unknown: "입장 결과를 확인하지 못했습니다.",
  },
  // 그 밖의 쓰기 동작 (방 생성, 제목, 팀, 나가기, 게임시작)
  // 동일 구조의 기본 문구를 사용
  other: {
    progress: "처리 중...",
    busy: "처리하지 못했습니다. 다시 시도해 주세요",
    unknown: "처리 결과를 확인하지 못했습니다.",
  },
};

// 진행 표시를 "켜고" "끄는" 함수를 돌려준다
//  const stop = startProgress(MESSAGES.join); ---요청--- stop();
//  setTimeout -> 3초 뒤 문구를 한 번 바꾸는 "단발 타이머"다.
//  서버에 다시 묻지 않는다, 자동 조회 금지
function startProgress(texts) {
  showNotice(texts.progress, "");
  showingLoadError = false;
  const slowTimer = setTimeout(() => showNotice(SLOW_TEXT, ""), SLOW_NOTICE_MS);
  return () => clearTimeout(slowTimer);
}

// 실패 결과 -> 화면 문구
function writeFailureMessage(result, texts) {
  if (result.status === 409) {
    return texts.busy;
  }
  if (result.status === 0) {
    // 결과 모름: 서버가 실제론 처리했을 수도 있음, 서버는 다시 확인하지 않는다
    // 사용자가 [새로고침] 하면 목록의 "현재 참가 방"에서 확인 가능!
    return texts.unknown;
  }
  return errorMessage(result);
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

function roomOccupancy(count, capacity) {
  const occupancy = document.createElement("span");
  occupancy.className = "occupancy";
  const slots = document.createElement("span");
  slots.className = "occupancy-slots";
  slots.setAttribute("aria-hidden", "true");
  for (let index = 0; index < capacity; index += 1) {
    const slot = document.createElement("span");
    slot.className = index < count ? "is-filled" : "";
    slots.appendChild(slot);
  }
  const total = document.createElement("span");
  total.textContent = count + "/" + capacity;
  occupancy.append(slots, total);
  return occupancy;
}

function renderRoomRows(rooms, currentRoomId) {
  const rows = document.getElementById("room-rows");
  rows.replaceChildren();
  for (const room of rooms) {
    const row = document.createElement("tr");
    const isCurrent = room.id === currentRoomId;

    const titleCell = document.createElement("td");
    titleCell.className = "cell-title";
    const link = document.createElement("a");
    link.href = "/rooms/" + room.id;
    link.textContent = room.title;
    titleCell.appendChild(link);
    const mobileTime = document.createElement("span");
    mobileTime.className = "room-mobile-time";
    mobileTime.textContent = formatTime(room.created_at);
    titleCell.appendChild(mobileTime);

    const countCell = document.createElement("td");
    countCell.className = "room-occupancy nowrap";
    countCell.appendChild(roomOccupancy(room.current_count, room.capacity));

    const timeCell = document.createElement("td");
    timeCell.className = "nowrap";
    timeCell.textContent = mobileTime.textContent;

    const stateCell = document.createElement("td");
    stateCell.className = "nowrap";
    const state = document.createElement("span");
    state.className = room.is_full && !isCurrent ? "status-badge is-muted" : "status-badge";
    state.textContent = isCurrent ? "참가 중" : room.is_full ? "정원 마감" : "참가 가능";
    stateCell.appendChild(state);

    const joinCell = document.createElement("td");
    if (isCurrent) {
      const returnLink = document.createElement("a");
      returnLink.href = link.href;
      returnLink.className = "button button-outline";
      returnLink.textContent = "돌아가기";
      joinCell.appendChild(returnLink);
    } else {
      const joinButton = document.createElement("button");
      joinButton.type = "button";
      joinButton.textContent = "참가";

      // 꽉 찬 방인지 버튼에 적어둔다 ㅡ 
      // 처리 중 잠갔다가 풀때 "원래 꺼져 있던 버튼" 구분하기 위해
      joinButton.dataset.full = String(room.is_full);
      joinButton.disabled = room.is_full || listBusy;
      joinButton.addEventListener("click", () => joinRoom(room.id));

      joinCell.appendChild(joinButton);
    }

    row.append(titleCell, countCell, stateCell, timeCell, joinCell);
    rows.appendChild(row);
  }
}

function renderRoomPage(roomPage, cond, currentRoomId) {
  document.getElementById("room-total").textContent = "전체 " + roomPage.total + "개";
  document.getElementById("room-empty").hidden = roomPage.items.length > 0;
  renderRoomRows(roomPage.items, currentRoomId);
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
  document.getElementById("current-room-title").textContent = currentRoom.title;
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
  const current = await apiRequest("GET", "/api/me/room");
  renderRoomPage(rooms.data, cond, current.ok ? current.data.room_id : null);
  if (!current.ok) {
    showListFailure(current);
    return;
  }
  renderCurrentRoom(current.data);
  clearLoadError();
}

// 목록 화면에서 쓰기 요청(참가/ 방 만들기)을 보내는 중인지?
// 상세 화면의 detailBusy와 같은 방식: 요청 하나가 끝날 때까지 
//    "모든" 참가/만들기 버튼을 잠근다.
// 누른 버튼만 잠그면 다른 방의 [참가]를 또 눌러 같은 회원의 중복 요청이 생긴다.
let listBusy = false;

function setListBusy(busy) {
  listBusy = busy;
  for (const button of document.querySelectorAll("#room-rows button")) {
    // 꽉 찬 방의 버튼은 처리가 끝나도 계속 끈다
    button.disabled = busy || button.dataset.full === "true";
  }
  document.getElementById("create-button").disabled = busy;
  // [새로고침]도 잠근다 — 처리 중에 누르면 "입장 중..." 진행 표시가 지워진다(CQ-08)
  document.getElementById("refresh-button").disabled = busy;
}

// 목록 화면 쓰기 요청의 공통 흐름: 잠금 -> 진행 표시 -> 요청 -> 결론
// 성공하면 onSuccess(data)를 부르고(보통 화면 이동),
// 실패하면 버튼 풀고 문구를 노출한다.
async function sendListWrite(texts, method, url, body, onSuccess) {
  if (listBusy) {
    return; // 이미 처리 중이면 무시 (연타 방지)
  }

  // 즉시: 버튼 잠금 + 진행 표시 (요청을 보내기 "전"에 화면부터 바꾼다)
  // (즉시 = startProgress를 apiRequest보다 먼저 부른다)
  setListBusy(true); 

  const stopProgress = startProgress(texts);
  const result = await apiRequest(method, url, body); // 최대 5초 응답대기
  stopProgress();

  if (result.ok) {
    onSuccess(result.data); // 성공: 화면 이동. 이동하는 동안 버튼은 잠근채로 둔다
    return;
  }
  setListBusy(false); // 실패: 버튼을 풀고 결론(성공/실패) 노출
  if (result.status !== 401) {
    showError(writeFailureMessage(result, texts));
  }
}


function joinRoom(roomId) {
  return sendListWrite(MESSAGES.join, "POST", 
    "/api/rooms/" + roomId + "/participants", undefined,
    () => {
      location.href = "/rooms/" + roomId;
    }
  );
  // button.disabled = true;
  // const result = await apiRequest("POST", "/api/rooms/" + roomId + "/participants");
  // if (result.ok) {
  //   location.href = "/rooms/" + roomId;
  //   return;
  // }
  // button.disabled = false;
  // showListFailure(result);
}

function createRoom(event) {
  event.preventDefault();
  const title = document.getElementById("create-room-title").value;
  return sendListWrite(MESSAGES.other, 
    "POST",
    "/api/rooms",
    { title },
    (data) => {
      location.href = "/rooms/" + data.id;
    }
  );
  // const button = document.getElementById("create-button");
  // const title = document.getElementById("create-room-title").value;
  // button.disabled = true;
  // const result = await apiRequest("POST", "/api/rooms", { title });
  // if (result.ok) {
  //   location.href = "/rooms/" + result.data.id;
  //   return;
  // }
  // button.disabled = false;
  // showListFailure(result);
}

function initRoomListPage() {
  if (!getAccessToken()) {
    return;
  }
  const cond = readListCondition();
  setupRefreshButton(() => {
    // 새로고침이 먼저 시작돼 버튼이 다시 켜진 사이에 쓰기 요청이 진행 중일 수 있다 → 그때는 무시
    if (listBusy) {
      return Promise.resolve();
    }
    clearNoticeForRefresh();
    return loadRoomList(cond);
  });
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
    item.className = "team-slot icon-user";
    const name = document.createElement("span");
    name.textContent = member.nickname;
    item.appendChild(name);
    if (member.is_host) {
      const badge = document.createElement("span");
      badge.className = "status-badge";
      badge.textContent = "방장";
      item.appendChild(badge);
    }
    list.appendChild(item);
  }
  for (let seat = members.length; seat < TEAM_SIZE; seat += 1) {
    const item = document.createElement("li");
    item.className = "team-slot is-empty icon-user";
    item.textContent = "빈자리";
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
  // [새로고침]은 #room 바깥(머리글)에 있어 따로 잠근다 — 처리 중 진행 표시 보호(CQ-08)
  document.getElementById("refresh-button").disabled = detailBusy;
  const teamsReady =
    teamMembers(lastDetail, "A").length === TEAM_SIZE &&
    teamMembers(lastDetail, "B").length === TEAM_SIZE;
  document.getElementById("start-button").disabled = detailBusy || !teamsReady;
  document.getElementById("start-hint").hidden = teamsReady;
  document.getElementById("join-button").disabled = detailBusy || lastDetail.is_full;
}

function renderDetail(detail) {
  lastDetail = detail;
  document.getElementById("room-summary").hidden = false;
  document.getElementById("room").hidden = false;
  document.getElementById("room-title").textContent = detail.title;
  document.getElementById("room-count").replaceChildren(roomOccupancy(detail.current_count, detail.capacity));
  const state = document.getElementById("room-state");
  state.textContent = detail.is_full ? "정원 마감" : "모집 중";
  state.classList.toggle("is-muted", detail.is_full);
  const titleInput = document.getElementById("rename-title");
  if (titleInput.value === titleInput.defaultValue) {
    titleInput.value = detail.title;
  }
  titleInput.defaultValue = detail.title;
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
    document.getElementById("room-summary").hidden = true;
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

// 거부 사유를 보이고 상세를 1회 다시 읽는다. 
// 해산된 방이면 400 뒤 조회가 410이라 목록으로 간다(AC-16-4).

// 단, 결과모름(status 0) 
// -> 다시 읽지 않는다 (사용자가 직접 화면 진입으로 확인한다)
async function showChangeFailure(result, texts) {
  if (result.status === 401) {
    return;
  }
  showError(writeFailureMessage(result, texts));
  if (result.status !== 0) {
    await loadRoomDetail();
  }
  // showError(errorMessage(result));
  // await loadRoomDetail();
}

// 변경 요청 하나. 성공하면 응답 data를, 실패하면 null을 돌려준다. 
// 성공 뒤에는 다시 조회하지 않는다.
//  texts: 진행/실패 문구 묶음
// 참가 버튼 -> MESSAGES.join / 나머지 MESSAGES.other
async function sendDetailChange(method, url, body, texts = MESSAGES.other) {
  if (detailBusy) {
    return null;
  }
  detailBusy = true;
  updateDetailButtons();
  const stopProgress = startProgress(texts); // 즉시: 진행 표시를 켠다(요청 보내기 전)
  let result;
  try {
    result = await apiRequest(method, url, body);
  } finally {
    stopProgress();
    detailBusy = false;
    updateDetailButtons();
  }
  if (!result.ok) {
    await showChangeFailure(result, texts);
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
    input.value = detail.title;
  }
}

async function moveTeam() {
  const team = lastDetail.my_team === "A" ? "B" : "A";
  const detail = await sendDetailChange("PATCH", detailUrl("/participants/me"), { team });
  if (detail) {
    renderDetail(detail);
  }
}

// <상세 화면 참가 버튼>만 참가문구를 쓴다.
async function joinFromDetail() {
  const detail = await sendDetailChange(
    "POST", 
    detailUrl("/participants"),
    undefined,
    MESSAGES.join
  );
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
    if (detailBusy) {
      return Promise.resolve(); // 변경 요청 처리 중에는 진행 표시를 지우지 않는다
    }
    clearNoticeForRefresh();
    return loadRoomDetail();
  });
  document.getElementById("rename-form").addEventListener("submit", renameRoom);
  document.getElementById("move-button").addEventListener("click", moveTeam);
  document.getElementById("join-button").addEventListener("click", joinFromDetail);
  document.getElementById("leave-button").addEventListener("click", leaveRoom);
  document.getElementById("start-button").addEventListener("click", startGame);
  loadRoomDetail();
}
