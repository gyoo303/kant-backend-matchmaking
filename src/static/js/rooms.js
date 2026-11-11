// 방 목록·방 상세 화면 동작
// 목록은 화면 진입·[새로고침] 클릭 때만 조회한다
// 상세는 기존 조회에 실시간 알림·연결 복구 뒤 재조회를 추가

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
// 현재 화면에 남길 채팅 메시지 수를 제한
const CHAT_MESSAGE_LIMIT = 100;

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

// 현재 상세 화면의 실시간 연결을 보관
let detailSocket = null;

//서버가 인증과 연결 등록을 마쳤는지 보관
let detailSocketReady = false;

// 에약한 재접속 작업을 보관
let detailReconnectTimer = null;

// 연결 응답을 기다리는 제한 시간 작업을 보관
let detailSocketTimer = null;

// 연결 재접속 시도 횟수를 보관
let detailReconnectAttempts = 0;

// 자동 재접속을 중단했는지 보관
let detailSocketBlocked = false;

// 연결 교체와 정리 이전에 시작한 비동기 처리를 구분
let detailSocketGeneration = 0;

// 진행 중인 상세 조회 작업을 보관
let detailLoadTask = null;

// 조회 중 추가로 들어온 갱신 요청을 보관
let detailReloadRequested = false;

// 변경 요청 전후의 조회 결과를 구분
let detailViewVersion = 0;

// 수동 새로고침 뒤 연결을 다시 시작할지 보관
let detailReconnectOnLoad = false;

// 화면 이동 이후의 조회 반영과 연결 시작을 차단
let detailPageLeaving = false;

// 현재 참가 여부와 연결 준비 상태에 맞게 채팅 입력을 제어
function updateChatControls() {
  // 현재 방의 참가자에게만 채팅 영역을 표시
  const isMember = lastDetail !== null && lastDetail.my_team !== null;
  document.getElementById('room-chat').hidden = !isMember;

  // 인증과 등록을 마친 열린 소켓에서만 입력을 허용
  const canSend =
    isMember &&
    detailSocketReady&&
    detailSocket !== null &&
    detailSocket.readyState === WebSocket.OPEN;
  
  document.getElementById('chat-controls').disabled = !canSend;
}

// 서버에서 받은 채팅 한건을 화면에 추가
function appendChatMessage(message) {
  const list = document.getElementById('chat-messages');
  const item = document.createElement('li');

  // 서버가 보낸 발신자와 시각을 표시
  const meta = document.createElement("div");
  meta.className = 'muted';
  meta.textContent =
    message.nickname + " · " + formatTime(message.sent_at);

    // 채팅 본문을 HTML이 아닌 텍스트로 표시
    const content = document.createElement('div');
    content.textContent = message.content;

    item.append(meta, content);
    list.appendChild(item);

    // 표시 상한을 넘으면 가장 오래된 메시지부터 제거
    while (list.children.length > CHAT_MESSAGE_LIMIT) {
      list.firstElementChild.remove();
    }

    // 빈 목록 안내를 숨기고 마지막 메시지를 보여줌
    document.getElementById('chat-empty').hidden = true;
    list.scrollTop = list.scrollHeight;
}

// 채팅 전용 안내 영역에 처리 결과를 표시
function showChatNotice(message, kind = 'error') {
  const notice = document.getElementById('chat-notice');
  notice.textContent = message;
  notice.className = 'notice ' + kind;
  notice.hidden = false;
}

// 채팅 전용 안내를 숨김
function hideChatNotice() {
  document.getElementById('chat-notice').hidden = true;
}

// 현재 HTTPS 페이지와 같은 호스트의 WSS 주소를 만듦
function roomWebSocketUrl() {
  // 비암호화 페이지에서는 실시간 연결을 시작하지 않음
  if (location.protocol !== 'https:') {
    throw new Error('실시간 연결에는 HTTPS 페이지가 필요합니다');
  }

  // 서버에 등록한 방별 경로로 주소를 구성
  const url = new URL(
    '/ws/rooms/' + encodeURIComponent(detailRoomId),
    location.origin,
  );
  url.protocol = 'wss:';
  return url.href;
}

// 실시간 연결 상태를 표시하고 입력 가능 여부를 갱신
function setChatStatus(message) {
  document.getElementById('chat-status').textContent = message;
  updateChatControls();
}

// 현재 연결에서 받은 서버 메시지를 종류별로 처리
function handleRoomSocketMessage(socket, event) {
  // 교체되거나 정리한 이전 소켓의 메시지느 무시
  if (socket !== detailSocket) {
    return;
  }

  // 수신한 텍스트를 JSON 객체로 해석
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    showChatNotice('서버 메시지를 해석하지 못했습니다');
    socket.close(4400, '잘못된 서버 메시지');
    return;
  }

  // 객체 형태가 아닌 메시지는 처리하지 않음
  if (message === null || typeof message !== 'object' || Array.isArray(message)) {
    socket.close(4400, '잘못된 서버 메시지');
    return;
  }

  // 방 정보가 있는 메시지는 현재 화면의 방과 대조
  const roomMessageTypes = ['connected', 'room_changed', 'chat_message'];
  if (
    roomMessageTypes.includes(message.type) &&
    message.room_id !== Number(detailRoomId)
  ) {
    socket.close(4400, '방 정보가 일치하지 않습니다');
    return;
  }

  switch (message.type) {
    case 'connected':
      // 서버의 인증과 등록이 끝나면 입력을 허용
      detailSocketReady = true;
      detailReconnectAttempts = 0;
      setChatStatus('실시간 연결이 준비됐습니다');
      loadRoomDetail();
      return;

    case 'room_changed':
      // 사용자별 상세 정보는 기존 API로 다시 조회
      loadRoomDetail();
      return;
    
    case 'chat_message':
      // 표시할 필드의 자료형을 확인
      if (
        typeof message.nickname !== 'string' ||
        typeof message.content !== 'string' ||
        typeof message.sent_at !== 'string'
      ) {
        socket.close(4400, '잘못된 채팅 메시지')
        return;
      }
      appendChatMessage(message);
      return
    
    case 'ping':
      // 서버의 연결 확인 요청에 응답
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'pong'}))
      }
      return;

    case 'pong':
      return;

    case 'error':
    // 채팅 제한 등의 안내는 채팅 전용 영역에 표시
      showChatNotice(
      typeof message.message == 'string'
      ? message.message
      : '채팅을 처리하지 못했습니다',
    );
    return;

  default:
    socket.close(4400, '지원하지 않는 서버 메시지');
  }
}

// 자동 재접속을 중단하고 현재 화면의 소켓을 정리
function stopRoomSocket (status = '실시간 연결을 종료했습니다') {
  // 예약한 재접속과 응답 대기를 취소
  detailSocketGeneration += 1;
  detailSocketBlocked = true;
  clearTimeout(detailReconnectTimer);
  clearTimeout(detailSocketTimer);
  detailReconnectTimer = null;
  detailSocketTimer = null;
  detailReconnectAttempts = 0;

// 이전 소켓의 이벤트가 현재 연결로 처리되지 않게 분리
const socket = detailSocket;
detailSocket = null;
detailSocketReady = false;

// 분리한 소켓의 연결을 종료
if (socket !== null) {
  socket.close(1000, '화면 연결 종료');
  }

  setChatStatus(status);
}

// 현재 소켓의 서버 응답 대기 시간을 제한
function armRoomSocketTimer(socket, milliseconds) {
  // 이미 교체햇거나 중단한 연결에는 타이머를 예약하지 않음
  if (socket !== detailSocket || detailSocketBlocked) {
    return;
  }

  // 이전 응답 대기를 취소하고 새 제한 시간을 예약
  clearTimeout(detailSocketTimer);
  detailSocketTimer = setTimeout(() => {
    // 예약 이후 연결이 바뀌었다면 현재 상태를 건드리지 않음
    if (socket !== detailSocket || detailSocketBlocked) {
      return;
    }

    // 응답 대기를 끝내고 채팅 입력을 비활성화
    detailSocketTimer = null;
    detailSocketReady = false;
    setChatStatus('서버 응답을 기다리는 시간이 초과됐습니다');

    // 종료 이벤트에서 재접속 여부를 처리하도록 연결을 닫음
    socket.close(4001, '서버 응답 대기 시간 초과');
  }, milliseconds);
}

// 현재 참가자의 실시간 연결을 만들고 이벤트를 등록
function connectRoomSocket() {
  // 중단 상태와 중복 연결을 확인
  if (
    detailSocketBlocked ||
    detailSocket !== null ||
    detailReconnectTimer !== null ||
    lastDetail == null ||
    lastDetail.my_team == null
  ) {
    return;
  }

  // HTTPS 페이지에서 같은 호스트의 WSS 연결을 시작
  let socket;
  try {
    const url = roomWebSocketUrl();
    socket = new WebSocket(url);
  } catch {
    stopRoomSocket('HTTPS·WSS 연결 구성을 확인해 주세요');
    return;
  }

  // 서버의 구독 준비 응답을 기다림
  detailSocketGeneration += 1;
  detailSocket = socket;
  detailSocketReady = false;
  setChatStatus('실시간 연결을 시작하고 있습니다');
  armRoomSocketTimer(socket, 10000);

  socket.addEventListener('open', () => {
    // 이미 교체하거나 중단한 연결에서는 인증하지 않음
    if (socket !== detailSocket || detailSocketBlocked) {
      return;
    }

    // 연결이 열린 시점의 최신 access 토큰을 읽음
    const token = getAccessToken();
    if (!token) {
      stopRoomSocket('로그인이 필요합니다');
      goToLogin(false);
      return
    }

    // 첫 JSON 메시지로 회원 인증을 요청
    setChatStatus('실시간 연결 인증을 확인하고 있습니다');
    try {
      socket.send(JSON.stringify({type: 'auth', token}));
    } catch {
      socket.close(4001, '인증 메시지 전송 실패');
    }
  });

  socket.addEventListener('message', (event) => {
    // 현재 소켓의 메시지만 기존 처리 함수로 전달
    if (socket !== detailSocket) {
      return;
    }
    handleRoomSocketMessage(socket, event);

    // 연결 준비 이후에는 다음 서버 응답의 대기 시간을 갱신
    if (
      socket === detailSocket &&
      detailSocketReady &&
      socket.readyState === WebSocket.OPEN
    ) {
      armRoomSocketTimer(socket, 100000);
    }
  });

  socket.addEventListener('error', () => {
    // 통신 오류가 발생하면 입력을 막음
    if (socket !== detailSocket) {
      return;
    }
    detailSocketReady = false;
    setChatStatus("실시간 연결에 오류가 발생했습니다");
  });

  socket.addEventListener('close', (event) => {
    handleRoomSocketClose(socket, event);
    });
  }

  // 연속 실패 횟수에 따라 제한된 재접속을 예약
  function scheduleRoomReconnect() {
    // 중단 상태와 중복 예약을 확인
    if (
      detailSocketBlocked ||
      detailSocket !== null ||
      detailReconnectTimer !== null ||
      lastDetail === null ||
      lastDetail.my_team === null
    ) {
      return;
    }

    // 연속 재접속 실패가 상한에 도달하면 자동 시도를 중단
    if (detailReconnectAttempts >= 5) {
      stopRoomSocket('자동 재접속을 중단했습니다. 새로고침으로 다시 시도해 주세요');
      return;
    }

    // 실패가 반복되면 다음 시도까지의 대기시간을 늘림
    const delay = 1000 * 2 ** detailReconnectAttempts;
    detailReconnectAttempts += 1;
    setChatStatus(
      "실시간 재접속을 기다리고 있습니다 (" + detailReconnectAttempts + "/5)",
    );

    // 현재 예약이 유효할 때만 연결을 다시 시작
    const timer = setTimeout(() => {
      if (detailSocketBlocked || detailReconnectTimer !== timer) {
        return;
      }
      detailReconnectTimer = null;
      connectRoomSocket();
    }, delay);

    detailReconnectTimer = timer;
  }

// 종료 사유에 따라 연결 중단과 재접속을 결정
async function handleRoomSocketClose(socket, event) {
  // 이미 교체하거나 정리한 소켓의 종료는 무시
  if (socket !== detailSocket) {
    return;
  }

  // 종료한 연결의 대기 작업과 입력 상태를 정리
  const generation = detailSocketGeneration;
  clearTimeout(detailSocketTimer);
  detailSocketTimer = null;
  detailSocket = null;
  detailSocketReady = false;
  setChatStatus('실시간 연결이 끊겼습니다');

  // 방 종료와 참가 자격 상실은 재접속하지 않고 상세를 확인
  if (event.code === 4000 || event.code === 4403) {
    stopRoomSocket('방 종료 또는 참가 상태 변경으로 연결을 종료했습니다');
    await loadRoomDetail();
    return;
  }

  // 메시지 규칙 오류는 같은 요청을 자동으로 반복하지 않음
  if (event.code === 1008 || event.code === 4400) {
    stopRoomSocket('메시지 규칙 오류로 실시간 연결을 중단했습니다');
    showChatNotice('화면을 새로고침한 뒤 다시 시도해 주세요');
    return;
  }

  if (event.code === 4401) {
    // 기존 HTTP 인증 흐름으로 토큰 재발급과 회원 확인을 처리
    detailSocketBlocked = true;
    setChatStatus('로그인 상태를 다시 확인하고 있습니다');
    const result = await apiRequest('GET', '/api/auth/me');

    // 기다리는 동안 정리하거나 교체한 연결은 다시 시작하지 않음
    if (generation !== detailSocketGeneration) {
      return;
    }
    
    // 인증 상태를 확인하지 못하면 자동 재접속을 중단
    if (!result.ok) {
      stopRoomSocket('로그인 상태를 확인하지 못했습니다');
      return;
    }

    detailSocketBlocked = false;
  }

  // 일시적인 종료와 인증 복구 이후에는 제한된 재접속을 예약
  scheduleRoomReconnect();
}

// 입력한 채팅을 현재 방의 준비된 소켓으로 전송
function sendRoomChat(event) {
  // 폼의 기본 전송으로 채팅 내용이 주소에 들어가지 않게 함
  event.preventDefault();

  // 현재 참가자의 인증된 열린 연결인지 확인
  const socket = detailSocket;
  if (
    lastDetail === null ||
    lastDetail.my_team === null ||
    !detailSocketReady ||
    socket === null ||
    socket.readyState !== WebSocket.OPEN
  ) {
    showChatNotice('실시간 연결이 준비되지 않아 전송하지 않았습니다');
    updateChatControls();
    return;
  }

  // 앞뒤 공백을 제거한 본문을 검사
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (content.length === 0) {
    showChatNotice('메시지를 입력해 주세요');
    return;
  }
  if (Array.from(content).length > 300) {
    showChatNotice('메시지는 300자까지 입력할 수 있습니다');
    return;
  }

  // 서버가 받는 채팅 입력 형식으로 전송을 요청
  try {
    socket.send(JSON.stringify({ type: 'chat_message', content}));
  } catch {
    showChatNotice('전송하지 못했습니다. 입력 내용을 유지합니다');
    return;
  }

  // 전송 요청과 서버 반영을 구분해서 안내
  input.value = "";
  input.focus();
  showChatNotice(
    '전송을 요청했습니다. 목록에 반영되기 전에는 처리 결과가 미확인입니다',
    "",
  );
}

// 현재 화면에만 남아있는 채팅 내용을 초기화
function clearRoomChat() {
  // 수신 목록을 빈 상태로 되돌림
  document.getElementById('chat-messages').replaceChildren();
  document.getElementById('chat-empty').hidden = false;

  // 입력 중인 본문과 채팅 안내를 지움
  document.getElementById('chat-input').value = "";
  hideChatNotice();
}

// 최신 참가 상태에 맞게 실시간 연결을 동기화
function syncRoomSocket(wasMember) {
  // 화면 이동 중에는 연결을 새로 만들지 않음
  if (detailPageLeaving) {
    return;
  }

  // 현재 참가자가 아니면 연결과 임시 대화를 정리
  const isMember = lastDetail !== null && lastDetail.my_team !== null;
  if (!isMember) {
    stopRoomSocket('방 참가자만 실시간 연결을 사용할 수 있습니다');
    clearRoomChat();
    detailReconnectOnLoad = false;
    return;
  }

  // 새 참가 또는 명시적인 재시도에서는 연결 중단 상태를 해제
  if (!wasMember || detailReconnectOnLoad) {
    stopRoomSocket('실시간 연결을 준비하고 있습니다');

    // 새 참가에서는 이전 참가 때 표시한 대화를 남기지 않음
    if (!wasMember) {
      clearRoomChat();
    }

    detailReconnectOnLoad = false;
    detailSocketBlocked = false;
  }

  // 기존 연결과 재접속 예약이 있으면 내부 검사에서 중복을 막음
  connectRoomSocket();
}

// 화면 이동 이후의 작업을 차단하고 임시 채팅을 정리
function prepareRoomPageLeave() {
  // 이미 정리한 화면은 다시 처리하지 않는다.
  if (detailPageLeaving) {
    return;
  }

  // 진행 중인 조회 결과와 추가 갱신 요청을 무효
  detailPageLeaving = true;
  detailViewVersion += 1;
  detailReloadRequested = false;
  detailReconnectOnLoad = false;

  // 통신 연결과 현재 화면의 대화를 정리
  stopRoomSocket();
  clearRoomChat();
}

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
  for (const button of document.querySelectorAll("#room button:not(#chat-send-button)")) {
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
  updateChatControls();
}

function renderDetail(detail) {
  // 새 상세 정보를 반영하기 전의 참가 여부를 기억
  const wasMember = lastDetail !== null && lastDetail.my_team !== null;

  // 기존 방 상세 표시를 갱신
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

  // 최신 참가 상태에 맞춰 연결을 유지하거나 정리
  syncRoomSocket(wasMember);
}

function handleDetailError(result) {
  // 기존 인증 처리의 화면 이동에 맞춰 연결을 정리
  if (result.status === 401) {
    prepareRoomPageLeave();
    return;
  }

  if (result.status === 410) {
    // 해산된 방은 기존 안내 화면으로 이동
    prepareRoomPageLeave();
    location.href = DISSOLVED_URL;
  } else if (result.status === 404) {
    // 없는 방의 참가 상태와 실시간 연결을 정리
    lastDetail = null;
    stopRoomSocket('방을 찾을 수 없어 연결을 종료했습니다');
    clearRoomChat();

    // 방 본문과 상단 요약을 함께 숨김
    document.getElementById('room').hidden = true;
    document.getElementById('room-summary').hidden = true;
    
    showError(NOT_FOUND_TEXT);
  } else if (isLoadFailure(result)) {
    // 일시적인 조회 실패에는 마지막 화면 정보를 유지
    showLoadError();
  } else {
    showError(errorMessage(result));
  }
}

async function runRoomDetailLoad() {
  try {
    do {
      // 이번 조회가 처리할 갱신 요청을 소비
      detailReloadRequested = false;
      const version = detailViewVersion;
      const result = await apiRequest("GET", detailUrl(""));
      // 기다리는 동안 화면을 떠났으면 결과를 반영하지 않음
      if (detailPageLeaving) {
        return;
      }

      // 변경 요청과 겹친 이전 결과는 버리고 다시 조회
      if (version !== detailViewVersion) {
        detailReloadRequested = true;
        continue;
      }

      // 기존 성공 표시와 오류 처리를 유지
      if (result.ok) {
        renderDetail(result.data);
        clearLoadError();
      } else {
        handleDetailError(result);
      }
    } while (detailReloadRequested);
  } finally {
    // 성공과 오류 모두에서 진행 중 표시를 해제
    detailLoadTask = null;
  }
}

// 진행 중인 상세 조회를 공유하고 추가 갱신 요청을 합침
async function loadRoomDetail() {
  if (detailPageLeaving) {
    return;
  }

  detailReloadRequested = true;

  if (detailLoadTask === null) {
    detailLoadTask = runRoomDetailLoad();
  }

  return detailLoadTask;
}

// 변경 실패 사유를 표시하고 결과가 불명확하지 않을 때 상세를 재조회
async function showChangeFailure(result, texts) {
  if (result.status === 401) {
    return;
  }

  showError(writeFailureMessage(result, texts));

  if (result.status !== 0) {
    await loadRoomDetail();
  }
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
  detailViewVersion += 1;
  updateDetailButtons();
  const stopProgress = startProgress(texts); // 즉시: 진행 표시를 켠다(요청 보내기 전)
  let result;
  try {
    result = await apiRequest(method, url, body);
  } finally {
  
  // 지연 안내 타이머를 정리
  stopProgress();

  // 변경 요청 이전의 상세 조회 결과를 무효화
  detailViewVersion += 1;

    detailBusy = false;
    updateDetailButtons();
  }
  // 화면 이동 이후에는 변경 결과로 화면을 다시 처리하지 않음
  if (detailPageLeaving) {
    return null;;
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
    prepareRoomPageLeave();
    location.href = "/";
  }
}

async function startGame() {
  if (await sendDetailChange("POST", detailUrl("/start"))) {
    prepareRoomPageLeave();
    location.href = DISSOLVED_URL;
  }
}

function initRoomDetailPage() {
  if (!getAccessToken()) {
    return;
  }

  // 현재 화면의 방 식별자를 설정
  detailRoomId = document.getElementById('room').dataset.roomId;

  // 수동 새로고침은 최신 조회 뒤 연결 재시도를 허용
  setupRefreshButton(() => {
  // 변경 요청 중에는 새로고침을 진행하지 않음
  if (detailBusy) {
    return Promise.resolve();
  }

  // 수동 새로고침 전에 이전 안내를 지움
  clearNoticeForRefresh();

  // 최신 상세 조회 뒤 실시간 재접속을 허용
  detailReconnectOnLoad = true;

  // 새로고침 전에 시작한 조회 결과를 무효화
  detailViewVersion += 1;
  
    return loadRoomDetail();
  });

  // 기존 방 변경 동작을 유지
  document.getElementById('rename-form').addEventListener('submit', renameRoom);
  document.getElementById('move-button').addEventListener('click', moveTeam);
  document.getElementById('join-button').addEventListener('click', joinFromDetail);
  document.getElementById('leave-button').addEventListener('click', leaveRoom);
  document.getElementById('start-button').addEventListener('click', startGame);

  // 채팅 입력을 별도 전송 함수에 연결
  document.getElementById('chat-form').addEventListener('submit', sendRoomChat);
  document.getElementById('chat-input').addEventListener('input', hideChatNotice);

  // 페이지를 떠나면 연결과 임시 대화를 정리
  window.addEventListener('pagehide', prepareRoomPageLeave);

  // 브라우저가 이전 문서를 복원하면 새 페이지로 다시 시작
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      location.reload();
    }
  });

  // 이벤트 등록을 마친 뒤 최초 상세 조회를 시작
  loadRoomDetail();
}
