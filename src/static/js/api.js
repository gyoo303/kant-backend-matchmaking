// API 호출과 화면 공통 도우미 (04-interfaces-api.md §7, ADR-002, D-021)
// - access·refresh 토큰은 localStorage에 둔다(쿠키 없음, CONV-09).
// - 모든 API 호출은 apiRequest()로 한다. 401이면 refresh 토큰으로 한 번 재발급하고 다시 시도한다.
// - 사용자가 입력한 문자열(방 제목·닉네임 등)은 textContent로만 화면에 넣는다(innerHTML 금지).

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

function saveTokens(accessToken, refreshToken) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }
}

function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function goToLogin(expired) {
  location.href = expired ? "/login?expired=1" : "/login";
}

// 로그인이 필요한 화면에서 토큰이 없으면 바로 로그인 화면으로 보낸다(AC-11-3).
function requireLogin() {
  if (!getAccessToken()) {
    goToLogin(false);
    return false;
  }
  return true;
}

// refresh 토큰으로 access 토큰을 다시 받는다(API-AUTH-05). 성공하면 true.
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) {
    return false;
  }
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    saveTokens(data.access_token, null);
    return true;
  } catch (error) {
    return false;
  }
}

async function sendOnce(method, url, body) {
  const headers = {};
  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }
  const options = { method: method, headers: headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  return fetch(url, options);
}

// API를 부르고 { ok, status, data }를 돌려준다.
// - 통신 실패: status 0, data.detail에 안내 문구
// - 401: 재발급 1회 → 다시 시도 → 그래도 401이면 토큰을 지우고 /login?expired=1로 이동
async function apiRequest(method, url, body) {
  let response;
  try {
    response = await sendOnce(method, url, body);
    if (response.status === 401 && (await refreshAccessToken())) {
      response = await sendOnce(method, url, body);
    }
  } catch (error) {
    return { ok: false, status: 0, data: { detail: "최신 정보를 불러오지 못했습니다" } };
  }
  if (response.status === 401) {
    clearTokens();
    goToLogin(true);
    return { ok: false, status: 401, data: { detail: "로그인이 만료되었습니다. 다시 로그인해 주세요" } };
  }
  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }
  return { ok: response.ok, status: response.status, data: data };
}

// 오류 응답에서 화면에 보일 문구를 꺼낸다({"detail": "..."} 한 형식, ADR-004).
function errorMessage(result) {
  if (result.data && typeof result.data.detail === "string") {
    return result.data.detail;
  }
  return "최신 정보를 불러오지 못했습니다";
}

// 로그인(API-AUTH-02, OAuth2 form). 성공하면 두 토큰을 저장하고 { ok: true }.
async function loginWithPassword(loginId, password) {
  const form = new URLSearchParams();
  form.append("username", loginId);
  form.append("password", password);
  try {
    const response = await fetch("/api/auth/token", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, data: data };
    }
    saveTokens(data.access_token, data.refresh_token);
    return { ok: true, status: response.status, data: data };
  } catch (error) {
    return { ok: false, status: 0, data: { detail: "최신 정보를 불러오지 못했습니다" } };
  }
}

// 로그아웃(API-AUTH-03): 두 토큰을 차단한 뒤 저장한 토큰을 지우고 로그인 화면으로 간다.
async function logout() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (getAccessToken() && refreshToken) {
    await apiRequest("POST", "/api/auth/logout", { refresh_token: refreshToken });
  }
  clearTokens();
  goToLogin(false);
}

// 안내 영역(partials/notice.html)에 문구를 쓴다. kind: "error" | "success" | 없음(일반 안내)
function showNotice(message, kind) {
  const notice = document.getElementById("notice");
  if (!notice) {
    return;
  }
  notice.textContent = message;
  notice.className = "notice" + (kind ? " " + kind : "");
  notice.hidden = false;
}

function hideNotice() {
  const notice = document.getElementById("notice");
  if (notice) {
    notice.hidden = true;
  }
}

// ISO 시각을 브라우저 시간대의 "MM-DD HH:mm"으로 바꾼다(사용자 확인 ⑤).
function formatTime(isoText) {
  if (!isoText) {
    return "";
  }
  const date = new Date(isoText);
  const pad = (value) => String(value).padStart(2, "0");
  return (
    pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " +
    pad(date.getHours()) + ":" + pad(date.getMinutes())
  );
}

// 페이지 이동 링크를 그린다: [이전] 현재 / 전체 [다음]. makeHref(page)가 링크 주소를 만든다.
function renderPagination(nav, page, size, total, makeHref) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  nav.textContent = "";
  const previous = document.createElement("a");
  previous.textContent = "이전";
  const next = document.createElement("a");
  next.textContent = "다음";
  const current = document.createElement("span");
  current.textContent = page + " / " + totalPages;
  if (page > 1) {
    previous.href = makeHref(page - 1);
  } else {
    previous.setAttribute("aria-disabled", "true");
  }
  if (page < totalPages) {
    next.href = makeHref(page + 1);
  } else {
    next.setAttribute("aria-disabled", "true");
  }
  nav.append(previous, current, next);
  nav.hidden = false;
}

// 머리글: 로그인 상태면 닉네임·[내 기록]·[로그아웃], 아니면 [로그인]·[회원가입] (07-screens.md §2)
async function initHeader() {
  const member = document.getElementById("nav-member");
  const guest = document.getElementById("nav-guest");
  if (!member || !guest) {
    return;
  }
  if (!getAccessToken()) {
    guest.hidden = false;
    return;
  }
  const result = await apiRequest("GET", "/api/auth/me");
  if (result.ok) {
    document.getElementById("nav-nickname").textContent = result.data.nickname;
    member.hidden = false;
  } else {
    guest.hidden = false;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const logoutButton = document.getElementById("nav-logout");
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }
  if (document.body.dataset.requireLogin === "true" && !requireLogin()) {
    return;
  }
  initHeader();
});
