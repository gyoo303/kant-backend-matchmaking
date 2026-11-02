// 토큰을 보관할 localStorage 키를 정의
const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

// 저장된 access 토큰을 읽는다
function getAccessToken(){
    return localStorage.getItem(ACCESS_KEY);
}

// 새로 받은 토큰을 저장
function saveTokens(accessToken, refreshToken) {
    localStorage.setItem(ACCESS_KEY, accessToken);

    // refresh 토큰을 전달받은 경우에만 교체
    if (refreshToken) {
        localStorage.setItem(REFRESH_KEY, refreshToken);
    }
}

// 저장된 인증 토큰 두 개를 삭제
function clearTokens() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
}

// 로그인 화면으로 이동
function goToLogin(expired) {
    location.href = expired ? '/login?expired=1' : '/login';
}

// access 토큰이 없으면 로그인 화면으로 이동
function requireLogin() {
    if (!getAccessToken()) {
        goToLogin(false);
        return false;
    }

    return true;
}

// refresh 토큰으로 access 토큰을 재발급
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem(REFRESH_KEY);

    // refresh 토큰이 없으면 재발급을 요청하지 않음
    if (!refreshToken) {
        return false;
    }

    try {
        // 저장된 refresh 토큰을 JSON 본문으로 보냄
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        // 서버가 재발급을 거부하면 실패를 반환
        if (!response.ok) {
            return false;
        }

        // 응답에 저장 가능한 access 토큰이 있는지 확인
        const data = await response.json();
        if (typeof data.access_token !== 'string' || !data.access_token) {
            return false;
        }

        // 기존 refresh 토큰을 유지하고 access 토큰만 교체
        saveTokens(data.access_token, null);
        return true;
    } catch (error) {
        // 통신 또는 응답 해석에 실패하면 실패를 반환
        return false;
    }
}

// access 토큰을 붙여 API 요청을 한 번 보냄
async function sendOnce(method, url, body) {
    // 요청에 사용할 헤더를 준비
    const headers = {};
    const token = getAccessToken();

    // access 토큰이 있으면 인증 헤더를 추가
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    // 요청 메서드와 헤더를 설정
    const options = { method: method, headers: headers};

    // 본문을 전달받으면 JSON으로 변환
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    return fetch(url, options)
}

// api 요청 결과를 공통 형식으로 변환
async function apiRequest(method, url, body) {
    let response;

    try{
        // 현재 access 토큰으로 요청
        response = await sendOnce(method, url, body);

        // 401이면 재발급 성공 후 원래 요청을 한번 더 보냄
        if (response.status === 401 && (await refreshAccessToken())) {
            response = await sendOnce(method, url, body);
        }
    } catch (error) {
        // 통신 실패를 화면에서 구분 할 수 있는 결과로 바꿈
        return {
            ok: false,
            status: 0,
            data: { detail: '최신 정보를 불러오지 못했습니다' },
        };
    }
    // 인증을 복구하지 못하면 토큰을 삭제하고 로그인 화면으로 이동
    if (response.status === 401) {
        clearTokens();
        goToLogin(true);
        return {
            ok: false,
            status: 401,
            data: { detail: '로그인이 만료되었습니다. 다시 로그인해 주세요' },
        };
    }
    // 응답 본문을 JSON으로 읽음
    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        // JSON으로 읽을 수 없는 본문은 null로 둠
        data = null;
    }

    return {
        ok: response.ok,
        status: response.status,
        data: data,
    };
}

// 요청 결과에서 화면에 표시할 오류 문구를 꺼냄
function errorMessage(result) {
    // 응답에 문자열 detail이 있으면 그대로 반환
    if (result.data && typeof result.data.detail === 'string') {
        return result.data.detail;
    }

    // 서버 문구가 없으면 공통 안내를 반환
    return '최신 정보를 불러오지 못했습니다';
}

// 아이디와 비밀번호로 로그인하고 발급받은 토큰을 저장
async function loginWithPassword(loginId, password) {
    // 서버가 받는 이름으로 로그인 폼을 구성
    const form = new URLSearchParams();
    form.append('username', loginId);
    form.append('password', password);

    try {
        // 로그인 요청은 재발급 처리 없이 직접 보냄
        const response = await fetch('/api/auth/token', {
            method: "POST",
            body: form,
        });

        // 로그인 응답 본문을 읽음
        const data = await response.json();

        // 로그인 실패는 서버의 상태와 오류 문구를 반환
        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                data: data,
            };
        }

        // 로그인에 성공하면 access.refresh 토큰을 저장
        saveTokens(data.access_token, data.refresh_token);

        return {
            ok: true,
            status: response.status,
            data: data,
        };
    } catch (error) {
        // 통신 또는 응답 해석 실패를 공통 오류 결과로 반환
        return {
            ok: false,
            status: 0,
            data: { detail: '최신 정보를 불러오지 못했습니다' },
        };
    }
}

// 로그아웃을 요청한 뒤 브라우저 인증 정보를 정리
async function logout() {
    const refreshToken = localStorage.getItem(REFRESH_KEY);

    // 두 토큰이 있으면 서버에 토큰 차단을 요청
    if (getAccessToken() && refreshToken) {
        await apiRequest("POST", "/api/auth/logout", {
            refresh_token: refreshToken,
        });
    }

    // 브라우저에 저장된 두 토큰을 삭제
    clearTokens();

    // 일반 로그인 화면으로 이동
    goToLogin(false);
}

// 안내 영역에 문구와 종류를 설정하고 표시
function showNotice(message, kind) {
    const notice = document.getElementById("notice");

    // 안내 영역이 없는 화면에서는 처리를 끝냄
    if (!notice) {
        return;
    }

    // 문구를 HTML이 아닌 텍스트로 넣음
    notice.textContent = message;

    // 안내 종류에 맞는 CSS 클래스를 설정
    notice.className = 'notice' + (kind ? " " + kind : "");

    // 안내 영역의 숨김 상태를 해제
    notice.hidden = false;
}

// 안내 영역을 숨김
function hideNotice() {
    const notice = document.getElementById("notice");

    // 안내 영역이 있을 때만 숨김 상태를 설정
    if (notice) {
        notice.hidden = true;
    }
}

// ISO 시각을 브라우저 시간대의 MM-DD HH:mm 형식으로 변환
function formatTime(isoText) {
    // 시각이 없으면 빈 문자열을 반환
    if (!isoText) {
        return "";
    }

    // 시각 문자열을 Date 객체로 변환
    const date = new Date(isoText);

    // 한 자리 숫자 앞에 0을 붙임
    const pad = (value) => String(value).padStart(2, '0');

    // 할·일·시·분을 표시 형식으로 조합
    return (
        pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' +
        pad(date.getHours()) + ':' + pad(date.getMinutes())
    );
}

// 이전·다음 링크와 현재 페이지 정보를 표시
function renderPagination(nav, page, size, total, makeHref) {
    // 항목이 없어도 전체 페이지 수를 최소 1로 정함
    const totalPages = Math.max(1, Math.ceil(total / size));

    // 이전에 표시한 페이지 이동 내용을 비움
    nav.textContent = '';

    // 이전·다음 페이지의 링크 요소를 만듦
    const previous = document.createElement('a');
    previous.textContent = '이전';

    const next = document.createElement('a');
    next.textContent = '다음';

    // 현재 페이지와 전체 페이지 수를 표시할 요소를 만듦
    const current = document.createElement('span');
    current.textContent = page + ' / ' + totalPages;

    // 첫 페이지가 아니면 이전 페이지 주소를 설정
    if (page > 1 ) {
        previous.href = makeHref(page - 1);
    } else {
        previous.setAttribute('aria-disabled', 'true');
    }

    // 마지막 페이지가 아니면 다음 페이지 주소를 설정
    if (page < totalPages) {
        next.href = makeHref(page + 1);
    } else {
        next.setAttribute('aria-disabled', 'true');
    }

    // 만든 요소를 페이지 이동 영역에 순서대로 넣음
    nav.append(previous, current, next);

    // 페이지 이동 영역의 숨김 상태를 해제
    nav.hidden = false;
}

// 회원 정보 조회 결과에 맞는 머리글을 표시
async function initHeader() {
    const member = document.getElementById('nav-member');
    const guest = document.getElementById('nav-guest');

    // 머리글 영역이 없는 화면에서 처리를 끝냄
    if (!member || !guest) {
        return;
    }

    // access 토큰이 없으면 비회원용 메뉴를 표시
    if (!getAccessToken()) {
        guest.hidden = false;
        return;
    }

    // 서버에서 현재 회원 정보를 조회
    const result = await apiRequest('GET', '/api/auth/me');

    // 조회에 성공하면 닉네임과 회원용 메뉴를 표시
    if (result.ok) {
        document.getElementById('nav-nickname').textContent =
        result.data.nickname;
        member.hidden = false;
    } else {
        // 조회에 실패하면 비회원용 메뉴를 표시
        guest.hidden = false;
    }
}

// HTML 구조가 준비되면 공통 화면 동작을 연결
document.addEventListener('DOMContentLoaded', function () {
    const logoutButton = document.getElementById('nav-logout');

    // 로그아웃 버튼에 클릭 동작을 연결
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    // 로그인 필요 화면에서 토큰이 없으면 초기화를 중단
    if (document.body.dataset.requireLogin === 'true' && !requireLogin()) {
        return;
    }

    // 로그인 상태에 맞는 머리글을 초기화
    initHeader();
});