// 우분투북스 화면별 디자인 시안 HTML 생성기.
// 실행: node build.mjs  → ../html/*.html 생성. 이미지는 shoot.mjs로 찍는다.
// 시안의 책 제목·저자·가격·주문 번호·편지 내용은 모두 예시 데이터다. PM이 정한 고정 문구만 그대로 쓴다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'html');
mkdirSync(outDir, { recursive: true });

// ---------- 예시 데이터 ----------
const THEMES = {
    nature: { name: '자연', bg: '#dfe6d5', fg: '#2f5038', line: '숲과 풀, 계절을 따라 읽는 책' },
    food: { name: '식문화', bg: '#efdcc4', fg: '#6e4521', line: '제철 밥상과 부엌에서 읽는 책' },
    ecology: { name: '생태', bg: '#d3e3e0', fg: '#1f4f4e', line: '함께 사는 생명을 들여다보는 책' },
    local: { name: '로컬', bg: '#dcdfea', fg: '#3b4870', line: '동네와 골목의 이야기를 담은 책' },
};
const BOOKS = [
    { id: 1, t: ['숲의 시간을', '걷다'], theme: 'nature', price: '16,800원', author: '예시 저자' },
    { id: 2, t: ['제철 부엌', '일기'], theme: 'food', price: '18,000원', author: '예시 저자' },
    { id: 3, t: ['작은 습지의', '사계'], theme: 'ecology', price: '22,000원', author: '예시 저자' },
    { id: 4, t: ['골목을', '산책하는 법'], theme: 'local', price: '15,000원', author: '예시 저자' },
    { id: 5, t: ['흙을 만지는', '손'], theme: 'nature', price: '17,500원', author: '예시 저자', soldout: true },
    { id: 6, t: ['씨앗', '도서관'], theme: 'ecology', price: '19,000원', author: '예시 저자' },
    { id: 7, t: ['발효의', '온도'], theme: 'food', price: '16,000원', author: '예시 저자' },
    { id: 8, t: ['우리 동네', '텃밭 지도'], theme: 'local', price: '14,000원', author: '예시 저자' },
];
const title = (b) => b.t.join(' ');

// ---------- 그림 ----------
function motif(theme, fg) {
    switch (theme) {
        case 'nature':
            return `<path d="M60 118c-22-30-6-62 28-70 6 34-6 60-28 70z" fill="none" stroke="${fg}" stroke-width="3"/><path d="M60 118c8-24 16-42 28-70" stroke="${fg}" stroke-width="2" fill="none"/>`;
        case 'food':
            return `<path d="M36 80h88a44 44 0 0 1-88 0z" fill="none" stroke="${fg}" stroke-width="3"/><path d="M62 66c0-10 8-10 8-20M82 66c0-10 8-10 8-20" stroke="${fg}" stroke-width="2" fill="none"/>`;
        case 'ecology':
            return `<path d="M24 70q14-12 28 0t28 0 28 0 28 0M24 90q14-12 28 0t28 0 28 0 28 0M24 110q14-12 28 0t28 0 28 0 28 0" stroke="${fg}" stroke-width="2.5" fill="none"/>`;
        default:
            return `<path d="M28 116V82l22-18 22 18v34M72 116V72l26-20 26 20v44" stroke="${fg}" stroke-width="3" fill="none"/><rect x="44" y="96" width="12" height="20" fill="none" stroke="${fg}" stroke-width="2"/>`;
    }
}
function coverSvg(b, alt = true) {
    const th = THEMES[b.theme];
    const label = alt ? `role="img" aria-label="${title(b)} 표지"` : 'aria-hidden="true"';
    return `<svg viewBox="0 0 150 200" ${label} preserveAspectRatio="xMidYMid slice">
  <rect width="150" height="200" fill="${th.bg}"/>
  <rect x="0" y="0" width="6" height="200" fill="${th.fg}" opacity=".18"/>
  ${motif(b.theme, th.fg)}
  <text x="20" y="160" font-family="Gowun Batang, serif" font-weight="700" font-size="15" fill="${th.fg}">${b.t[0]}</text>
  <text x="20" y="180" font-family="Gowun Batang, serif" font-weight="700" font-size="15" fill="${th.fg}">${b.t[1]}</text>
</svg>`;
}
const cover = (b) => `<div class="cover">${coverSvg(b)}</div>`;

// 창가 그림. state: arrived | reading | shipped | empty | hero
function windowScene(state, alt) {
    const lit = state === 'reading' || state === 'hero';
    const glass = lit ? 'url(#warm)' : '#10162c';
    const flame = lit
        ? `<ellipse cx="112" cy="168" rx="9" ry="16" fill="#e9a83a" opacity=".35"/><ellipse cx="112" cy="171" rx="5" ry="10" fill="#f6c768"/>`
        : '';
    const candle = state === 'empty' || state === 'arrived' ? '' : `<rect x="105" y="182" width="14" height="30" rx="2" fill="#efe6d2"/>${flame}`;
    const smoke = state === 'shipped' ? `<path d="M112 178c-6-8 6-12 0-20s6-12 0-18" stroke="#8b93ad" stroke-width="2" fill="none" opacity=".7"/>` : '';
    const letter =
        state === 'arrived'
            ? `<g><rect x="146" y="188" width="46" height="26" rx="2" fill="#efe6d2"/><path d="M146 189l23 14 23-14" stroke="#b9a988" stroke-width="2" fill="none"/></g>`
            : '';
    const books =
        state === 'hero' || state === 'reading'
            ? `<rect x="150" y="190" width="56" height="9" fill="#3e6a48"/><rect x="154" y="181" width="50" height="9" fill="#8a5a2b"/><rect x="148" y="199" width="60" height="13" fill="#4a5a82"/>`
            : '';
    const postbox =
        state === 'shipped' || state === 'hero'
            ? `<g><circle cx="300" cy="96" r="${state === 'shipped' ? 34 : 0}" fill="url(#post)"/><rect x="296" y="104" width="8" height="22" fill="#5b4430"/>
         <circle cx="300" cy="98" r="7" fill="${state === 'shipped' ? '#f6c768' : '#5b6380'}"/>
         <rect x="276" y="128" width="48" height="74" rx="22" fill="#b0402f"/><rect x="276" y="150" width="48" height="5" fill="#8a2f22"/>
         <rect x="288" y="140" width="24" height="4" rx="2" fill="#2a120d"/><rect x="296" y="202" width="8" height="46" fill="#5b4430"/></g>`
            : '';
    return `<svg viewBox="0 0 360 260" role="img" aria-label="${alt}">
  <defs>
    <radialGradient id="warm" cx="0.42" cy="0.78" r="0.75"><stop offset="0" stop-color="#f3c46a"/><stop offset=".45" stop-color="#a8692a"/><stop offset="1" stop-color="#2a2236"/></radialGradient>
    <radialGradient id="post"><stop offset="0" stop-color="#f6c768" stop-opacity=".55"/><stop offset="1" stop-color="#f6c768" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="0" y="0" width="360" height="260" fill="#1d2440"/>
  <circle cx="300" cy="34" r="2" fill="#c8cde0"/><circle cx="252" cy="58" r="1.5" fill="#c8cde0"/><circle cx="330" cy="70" r="1.2" fill="#c8cde0"/>
  <rect x="28" y="18" width="208" height="206" rx="3" fill="#5b4430"/>
  <rect x="40" y="30" width="184" height="180" fill="${glass}"/>
  <rect x="129" y="30" width="6" height="180" fill="#5b4430"/><rect x="40" y="117" width="184" height="6" fill="#5b4430"/>
  ${books}${candle}${smoke}${letter}
  <rect x="18" y="210" width="228" height="12" rx="2" fill="#7a5c3e"/>
  ${postbox}
  <rect x="0" y="246" width="360" height="14" fill="#151a31"/>
</svg>`;
}
function blindSvg(size = 160) {
    return `<svg viewBox="0 0 150 200" width="${size}" role="img" aria-label="아직 열리지 않은 책">
  <defs><filter id="soft"><feGaussianBlur stdDeviation="3"/></filter></defs>
  <rect x="14" y="10" width="122" height="180" rx="4" fill="#2b3330" opacity=".88" filter="url(#soft)"/>
  <rect x="22" y="18" width="8" height="164" fill="#3d4743" opacity=".8"/>
  <path d="M60 92c0-12 30-12 30 0 0 10-15 10-15 22" stroke="#9aa59e" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="75" cy="128" r="3.5" fill="#9aa59e"/>
</svg>`;
}
function postboxSvg() {
    return `<svg viewBox="0 0 220 220" role="img" aria-label="편지 봉투와 우체통">
  <rect x="120" y="40" width="72" height="120" rx="34" fill="#b0402f"/><rect x="120" y="76" width="72" height="6" fill="#8a2f22"/>
  <rect x="138" y="58" width="36" height="6" rx="3" fill="#2a120d"/><rect x="150" y="160" width="12" height="52" fill="#5b4430"/>
  <g transform="rotate(-8 60 120)"><rect x="18" y="98" width="86" height="54" rx="3" fill="#fafaf6" stroke="#b9a988" stroke-width="2"/><path d="M18 100l43 30 43-30" stroke="#b9a988" stroke-width="2" fill="none"/></g>
</svg>`;
}

// ---------- 공통 틀 ----------
function header(kind, current) {
    const cur = (k) => (k === current ? ' aria-current="page"' : '');
    const right =
        kind === 'guest'
            ? `<a href="#"${cur('cart')}>장바구니</a><a href="#"${cur('login')}>로그인</a>`
            : `<a href="#"${cur('cart')}>장바구니<span class="count" aria-label="담은 책 2권">2</span></a><a href="#"${cur('mypage')}>마이페이지</a>`;
    return `<header class="site-header"><div class="wrap">
  <a class="logo" href="#">우분투북스<small>대전 어은동</small></a>
  <nav class="nav nav-main" aria-label="주 메뉴"><a href="#"${cur('shelf')}>테마 서가</a><a href="#"${cur('letter')}>편지 띄우기</a></nav>
  <nav class="nav" aria-label="내 메뉴">${right}</nav>
</div></header>`;
}
const footer = `<footer class="site-footer"><div class="wrap">
  <div><strong>우분투북스</strong><div>대전 어은동 골목 안쪽의 작은 책방</div></div>
  <nav aria-label="사이트 링크"><a class="link" href="#">테마 서가</a><a class="link" href="#">편지 띄우기</a></nav>
</div></footer>`;
function adminHeader(current) {
    const cur = (k) => (k === current ? ' aria-current="page"' : '');
    return `<header class="admin-bar"><div class="wrap">
  <a class="logo" href="#">우분투북스<small>책방지기 서재</small></a>
  <nav aria-label="관리자 메뉴"><a href="#"${cur('products')}>책 관리</a><a href="#"${cur('orders')}>주문 처리</a><a href="#"${cur('desk')}>서재 작업</a></nav>
</div></header>`;
}
function page(file, scr, name, body, opts = {}) {
    const top = opts.admin ? adminHeader(opts.current) : header(opts.kind ?? 'guest', opts.current);
    const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${scr} ${name} 시안</title><link rel="stylesheet" href="../src/mockup.css"></head>
<body>${top}
<main><div class="wrap${opts.narrow ? ' wrap-narrow' : ''}">${body}</div></main>
${opts.admin ? '' : footer}
<div class="mock-tag">${scr} 시안 / 예시 데이터</div>
</body></html>`;
    writeFileSync(join(outDir, `${file}.html`), html);
    pages.push({ file, scr, name, admin: !!opts.admin });
}
const pages = [];

const badge = (theme) => `<span class="badge theme-${theme}">${THEMES[theme].name}</span>`;
function card(b) {
    return `<a class="card${b.soldout ? ' soldout' : ''}" href="#">${cover(b)}
  <div class="meta"><div class="title">${title(b)}</div><div class="author">${b.author}</div>
  <div class="row"><span class="price">${b.price}</span>${b.soldout ? '<span class="badge badge-soldout">품절</span>' : badge(b.theme)}</div></div></a>`;
}
function shelfCard(key) {
    const th = THEMES[key];
    const widths = [62, 48, 70, 54, 66, 44, 58];
    const spines = widths.map((h, i) => `<i style="height:${h}px;background:${i % 2 ? th.fg : th.bg};${i % 2 ? '' : `border:1px solid ${th.fg}55;`}"></i>`).join('');
    return `<a class="shelf" href="#"><h3>${th.name}</h3><p>${th.line}</p><div class="spines" aria-hidden="true">${spines}</div></a>`;
}

// ---------- SCR-01 메인 ----------
page(
    'SCR-01-main',
    'SCR-01',
    '메인',
    `<section class="hero">
  <div>
    <h1>천천히 읽고,<br>천천히 답장하는 책방</h1>
    <p class="lead">대전 어은동 골목 안쪽에서 자연과 생태, 건강한 식문화를 다루는 작은 책방입니다. 빠르게 보내드리기보다 손편지를 주고받으며 천천히 알아가고 싶어요.</p>
  </div>
  <div class="hero-art">${windowScene('hero', '불이 켜진 책방 창가와 우체통 그림')}</div>
</section>
<div class="invite"><p>요즘 마음 날씨를 편지로 보내 주시면, 책방지기가 어울리는 책을 골라 답장과 함께 보내드려요.</p><a class="btn btn-primary" href="#">편지 띄우기</a></div>
<section class="section" style="margin-top:56px"><div class="section-head"><h2>테마 서가</h2><a class="link" href="#">전체 보기</a></div>
  <div class="shelves">${Object.keys(THEMES).map(shelfCard).join('')}</div></section>
<section class="section"><div class="section-head"><h2>새로 들어온 책</h2></div>
  <div class="grid">${BOOKS.filter((b) => !b.soldout).slice(0, 4).map(card).join('')}</div></section>`,
    { current: '' },
);

// ---------- SCR-02 상품 목록 ----------
const tabs = (sel) =>
    `<nav class="theme-tabs" aria-label="테마 고르기">${[['all', '전체'], ...Object.entries(THEMES).map(([k, v]) => [k, v.name])]
        .map(([k, n]) => `<a href="#" aria-pressed="${k === sel}">${n}</a>`)
        .join('')}</nav>`;
page(
    'SCR-02-products',
    'SCR-02',
    '테마 서가',
    `<h1>테마 서가</h1><div style="margin-top:20px">${tabs('all')}</div>
<p class="lead" style="margin:16px 0 32px">네 개의 서가에 꽂힌 책을 모두 보여드려요.</p>
<div class="grid">${BOOKS.map(card).join('')}</div>`,
    { current: 'shelf' },
);
page(
    'SCR-02-products-empty',
    'SCR-02',
    '테마 서가 (빈 테마)',
    `<h1>테마 서가</h1><div style="margin-top:20px">${tabs('local')}</div>
<p class="lead" style="margin:16px 0 32px">${THEMES.local.line}</p>
<div class="notice" style="padding:32px 24px"><h2 style="font-size:1.25rem">이 서가는 아직 비어 있어요</h2>
<p class="muted" style="margin-top:8px">다른 서가를 둘러보세요.</p>
<div class="theme-tabs" style="margin-top:16px"><a href="#">자연</a><a href="#">식문화</a><a href="#">생태</a></div></div>`,
    { current: 'shelf' },
);

// ---------- SCR-03 상세 ----------
const b1 = BOOKS[0];
page(
    'SCR-03-product',
    'SCR-03',
    '상품 상세',
    `<section class="keeper-note" aria-labelledby="note-label"><div class="label" id="note-label">책방지기 노트</div>
  <blockquote>새벽 산책길에서 이 책을 처음 펼쳤어요. 서두르지 않는 문장들이 발걸음을 늦추게 해요. 계절이 바뀌는 길목에 있는 분께 건네고 싶은 책입니다.</blockquote>
  <div class="sign">ㅡ 책방지기</div></section>
<div class="split" style="--cols: 280px 1fr; margin-top:40px">
  <div class="detail-cover">${cover(b1)}</div>
  <div><h1>${title(b1)}</h1><p class="muted" style="margin-top:6px">${b1.author}</p>
    <div style="display:flex;gap:12px;align-items:center;margin-top:16px">${badge(b1.theme)}<span style="font-size:1.25rem">${b1.price}</span></div>
    <p style="margin-top:20px;max-width:34em">숲길을 걸으며 기록한 계절의 짧은 글 모음. (예시 설명)</p>
    <button class="btn btn-primary btn-lg" style="margin-top:24px;min-width:220px">장바구니 담기</button>
    <details style="margin-top:32px;border-top:1px solid var(--border);padding-top:16px"><summary style="cursor:pointer;min-height:44px;display:flex;align-items:center">출판사 소개</summary></details>
    <p style="margin-top:24px"><a class="link" href="#">테마 서가로 돌아가기</a></p></div>
</div>`,
    { current: 'shelf' },
);

// ---------- SCR-04 상품 없음 ----------
page(
    'SCR-04-not-found',
    'SCR-04',
    '상품 없음',
    `<div style="padding:64px 0;max-width:34em"><h1>상품을 찾을 수 없습니다</h1>
<p class="lead" style="margin-top:12px">주소를 다시 확인하시거나 테마 서가에서 찾아보세요.</p>
<a class="btn btn-primary" style="margin-top:28px" href="#">테마 서가로 가기</a></div>`,
);

// ---------- SCR-05 로그인 ----------
page(
    'SCR-05-login',
    'SCR-05',
    '로그인',
    `<div style="max-width:400px;margin:24px auto 0"><h1>반가워요</h1>
<p class="lead" style="margin-top:10px">아이디나 비밀번호를 만들지 않아도 돼요. 쓰던 계정으로 바로 들어오세요.</p>
<div class="stack" style="margin-top:32px">
  <button class="btn btn-block btn-lg kakao"><span class="mark" aria-hidden="true">●</span>카카오로 시작하기</button>
  <button class="btn btn-block btn-lg naver"><span class="mark" aria-hidden="true">N</span>네이버로 시작하기</button>
</div>
<div class="notice notice-error" style="margin-top:24px" role="alert">로그인을 마치지 못했어요. 다시 시도해 주세요</div>
<p class="sr-note" style="margin-top:12px">위 안내는 로그인 취소·실패로 돌아왔을 때만 보임 (AC-05-5)</p></div>`,
    { current: 'login', narrow: true },
);

// ---------- SCR-06 마이페이지 ----------
page(
    'SCR-06-mypage',
    'SCR-06',
    '마이페이지',
    `<h1>마이페이지</h1>
<div class="window-panel" style="margin-top:24px"><div style="max-width:300px">${windowScene('reading', '책방지기가 당신의 편지를 읽고 있어요')}</div>
  <div><p class="status">책방지기가 당신의 편지를 읽고 있어요</p><a class="btn btn-outline" style="margin-top:20px" href="#">창가로 가기</a></div></div>
<nav class="menu-list" style="margin-top:32px" aria-label="마이페이지 메뉴">
  <a href="#">주문 현황<span class="muted small">2건</span></a><a href="#">창가</a><a href="#">나의 서가</a><a href="#">기본 배송지</a><a href="#">구독 마무리하기</a>
  <a href="#">로그아웃</a><a href="#" class="muted">탈퇴</a></nav>`,
    { kind: 'member', current: 'mypage', narrow: true },
);

// ---------- SCR-07 기본 배송지 ----------
page(
    'SCR-07-address',
    'SCR-07',
    '기본 배송지',
    `<h1>기본 배송지</h1><p class="lead" style="margin-top:8px">주문과 편지 띄우기에 이 주소를 먼저 채워 드려요. 이미 한 주문의 주소는 바뀌지 않아요.</p>
<form class="stack" style="margin-top:28px">
  <label class="field"><span>받는 사람</span><input class="input" value="김예시"></label>
  <label class="field field-error"><span>연락처</span><input class="input" value="" aria-invalid="true"><div class="error-text">연락처를 적어 주세요</div></label>
  <label class="field"><span>주소</span><input class="input" value="대전 유성구 예시로 00"></label>
  <button class="btn btn-primary" type="button">저장</button></form>`,
    { kind: 'member', current: 'mypage', narrow: true },
);

// ---------- SCR-08 책 관리 ----------
page(
    'SCR-08-admin-products',
    'SCR-08',
    '관리자 책 관리',
    `<div class="section-head"><h1>책 관리</h1><a class="btn btn-primary" href="#">새 책 등록</a></div>
<table class="list"><thead><tr><th>제목</th><th>테마</th><th>가격</th><th>재고</th><th></th></tr></thead><tbody>
${BOOKS.slice(0, 6)
    .map((b, i) => `<tr><td>${title(b)}</td><td>${badge(b.theme)}</td><td>${b.price}</td><td>${b.soldout ? '<span class="badge badge-soldout">품절</span> 0' : [3, 5, 2, 7, 0, 1][i]}</td><td><a class="link" href="#">고치기</a></td></tr>`)
    .join('')}
</tbody></table><p class="hint" style="margin-top:12px">책을 지우는 기능은 없어요. 팔지 않을 책은 재고를 0으로 두세요.</p>`,
    { admin: true, current: 'products', narrow: true },
);
page(
    'SCR-08-admin-product-form',
    'SCR-08',
    '관리자 책 등록·수정',
    `<p><a class="link" href="#">책 목록으로</a></p><h1 style="margin-top:12px">새 책 등록</h1>
<form class="stack" style="margin-top:24px">
  <label class="field"><span>제목</span><input class="input" value="숲의 시간을 걷다"></label>
  <label class="field"><span>저자</span><input class="input" value="예시 저자"></label>
  <label class="field field-error"><span>가격 (원)</span><input class="input" value="-1000" aria-invalid="true"><div class="error-text">가격은 0원 이상의 숫자로 적어 주세요</div></label>
  <fieldset><legend style="margin-bottom:6px">테마</legend><div class="theme-tabs"><a aria-pressed="true">자연</a><a>식문화</a><a>생태</a><a>로컬</a></div></fieldset>
  <label class="field"><span>표지 이미지</span><input class="input" value="cover.jpg"><div class="hint">세로 3:4 비율 사진이 가장 잘 보여요</div></label>
  <label class="field"><span>짧은 설명 (목록 카드에 보여요)</span><input class="input"></label>
  <label class="field"><span>책방지기 노트 (상세 맨 위에 크게 보여요)</span><textarea class="textarea" style="min-height:160px"></textarea></label>
  <label class="field"><span>출판사 소개 (없으면 비워 두세요)</span><textarea class="textarea"></textarea></label>
  <label class="field"><span>재고</span><input class="input" value="3"></label>
  <button class="btn btn-primary btn-lg" type="button">저장</button></form>`,
    { admin: true, current: 'products', narrow: true },
);

// ---------- SCR-09 장바구니 ----------
function lineItem(b, qty, extra = '') {
    return `<div class="line-item${b.soldout ? ' soldout' : ''}">${cover(b)}<div>
  <div style="display:flex;justify-content:space-between;gap:12px"><div><div class="serif" style="font-weight:700">${title(b)}</div><div class="muted small">${b.author}</div></div><span>${b.price}</span></div>
  ${extra}
  <div class="controls">${b.soldout ? '<span class="badge badge-soldout">품절</span><span class="muted small">주문에서 빠져요</span>' : `<div class="qty"><button aria-label="한 권 줄이기">−</button><span>${qty}</span><button aria-label="한 권 늘리기">+</button></div>`}<button class="btn btn-ghost">빼기</button></div></div></div>`;
}
page(
    'SCR-09-cart',
    'SCR-09',
    '장바구니',
    `<h1>장바구니</h1><div class="split" style="--cols: 1fr 320px; margin-top:28px">
<div class="row-list">${lineItem(BOOKS[1], 2)}${lineItem(BOOKS[2], 2, '<p class="notice notice-warm small" style="margin-top:10px">남은 책은 2권이에요</p>')}${lineItem(BOOKS[4], 1)}</div>
<aside class="summary"><dl><dt>책 4권</dt><dd>80,000원</dd><dt>합계</dt><dd class="total">80,000원</dd></dl>
<button class="btn btn-primary btn-block btn-lg" style="margin-top:20px">주문하기</button></aside></div>`,
    { kind: 'member', current: 'cart' },
);

// ---------- SCR-10 주문서 ----------
page(
    'SCR-10-checkout',
    'SCR-10',
    '주문서·결제',
    `<h1>주문서</h1><div class="split" style="--cols: 1fr 320px; margin-top:28px"><div>
<h2 style="font-size:1.25rem">주문할 책</h2><div class="row-list" style="margin-top:12px">
<div style="display:flex;justify-content:space-between"><span>${title(BOOKS[1])} × 2</span><span>36,000원</span></div>
<div style="display:flex;justify-content:space-between"><span>${title(BOOKS[2])} × 2</span><span>44,000원</span></div></div>
<h2 style="font-size:1.25rem;margin-top:36px">받는 곳</h2><p class="hint">기본 배송지를 채워 두었어요</p>
<div class="stack" style="margin-top:12px"><label class="field"><span>받는 사람</span><input class="input" value="김예시"></label>
<label class="field"><span>연락처</span><input class="input" value="010-0000-0000"></label>
<label class="field"><span>주소</span><input class="input" value="대전 유성구 예시로 00"></label></div></div>
<aside class="summary"><dl><dt>합계</dt><dd class="total">80,000원</dd></dl><p class="hint">카드·간편결제 (테스트 결제)</p>
<button class="btn btn-primary btn-block btn-lg" style="margin-top:20px">결제하기</button></aside></div>`,
    { kind: 'member', current: 'cart' },
);

// ---------- SCR-11 결과 ----------
page(
    'SCR-11-result-success',
    'SCR-11',
    '주문 완료',
    `<div style="padding:40px 0;max-width:36em"><h1>주문을 받았어요</h1>
<p class="lead" style="margin-top:12px">책방지기가 곧 포장해 보내드려요.</p>
<dl class="summary" style="margin-top:28px;display:grid;grid-template-columns:auto 1fr;gap:8px 20px"><dt class="muted">주문 번호</dt><dd>20261021-0007</dd><dt class="muted">결제 금액</dt><dd>80,000원</dd></dl>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:28px"><a class="btn btn-primary" href="#">주문 현황 보기</a><a class="btn btn-outline" href="#">테마 서가 둘러보기</a></div></div>`,
    { kind: 'member' },
);
page(
    'SCR-11-result-fail',
    'SCR-11',
    '결제 미완료',
    `<div style="padding:40px 0;max-width:36em"><h1>결제가 완료되지 않았어요</h1>
<p class="lead" style="margin-top:12px">장바구니는 그대로 있어요. 준비되면 다시 결제해 주세요.</p>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:28px"><button class="btn btn-primary btn-lg">다시 결제하기</button><a class="btn btn-outline" href="#">장바구니로 가기</a></div></div>`,
    { kind: 'member' },
);

// ---------- SCR-12 주문 현황 ----------
const steps = (n) =>
    `<div class="steps2" aria-label="주문 접수, 발송됨 중 ${n === 1 ? '주문 접수' : '발송됨'} 단계"><span class="dot on"></span><span class="t">주문 접수</span><span class="bar${n > 1 ? ' on' : ''}"></span><span class="dot${n > 1 ? ' on' : ''}"></span><span class="t">발송됨</span></div>`;
page(
    'SCR-12-orders',
    'SCR-12',
    '주문 현황',
    `<h1>주문 현황</h1><div style="margin-top:24px">
<div class="order"><div class="order-head"><strong>${title(BOOKS[1])} 외 1권</strong><span class="muted small">2026-10-21 주문</span></div>${steps(1)}
<button class="btn btn-outline" style="margin-top:16px">취소 요청</button></div>
<div class="order"><div class="order-head"><strong>${title(BOOKS[3])}</strong><span class="muted small">2026-10-18 주문</span></div>${steps(1)}
<p class="notice notice-warm" style="margin-top:14px">취소 요청을 책방지기에게 전했어요</p><button class="btn btn-outline" style="margin-top:12px">취소 요청 철회</button></div>
<div class="order"><div class="order-head"><strong>${title(BOOKS[6])}</strong><span class="muted small">2026-10-12 주문</span></div>${steps(1)}
<p class="notice" style="margin-top:14px">책방지기가 취소 요청을 받지 않았어요. 책은 그대로 보내드려요</p></div>
<div class="order"><div class="order-head"><strong>${title(BOOKS[0])}</strong><span class="muted small">2026-10-02 주문</span></div>${steps(2)}</div></div>`,
    { kind: 'member', current: 'mypage', narrow: true },
);

// ---------- SCR-13 관리자 주문 처리 ----------
page(
    'SCR-13-admin-orders',
    'SCR-13',
    '관리자 주문 처리',
    `<div class="section-head"><h1>주문 처리</h1><button class="btn btn-outline">주소록 내려받기</button></div>
<p class="muted">오래된 주문부터 보여요.</p><div style="margin-top:20px">
<div class="order"><div class="order-head"><strong>${title(BOOKS[0])} × 1</strong><span class="badge badge-plain">주문 접수</span></div>
<p class="small muted" style="margin-top:8px">김예시 / 010-0000-0000 / 대전 유성구 예시로 00</p><button class="btn btn-primary" style="margin-top:14px">발송 완료</button></div>
<div class="order" style="border-color:var(--destructive)"><div class="order-head"><strong>${title(BOOKS[3])} × 1</strong><span class="badge badge-plain" style="background:var(--destructive-soft);color:var(--destructive-soft-foreground)">취소 요청</span></div>
<p class="small muted" style="margin-top:8px">이예시 / 010-0000-0001 / 대전 유성구 예시로 01</p>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-destructive">환불</button><button class="btn btn-outline">취소 거절</button><button class="btn" disabled>발송 완료</button></div>
<p class="hint">취소 요청이 있는 주문이에요. 환불하거나 거절해 주세요</p></div></div>`,
    { admin: true, current: 'orders', narrow: true },
);

// ---------- SCR-14 편지지 ----------
page(
    'SCR-14-letter',
    'SCR-14',
    '편지 띄우기',
    `<div class="split" style="--cols: 1fr 260px"><div><h1>편지 띄우기</h1>
<p class="lead" style="margin-top:10px">설문 대신 편지 한 장이면 돼요. 요즘 마음 날씨와 읽고 싶은 책의 결을 들려주세요.</p>
<div class="paper" style="margin-top:24px"><p class="letter">책방지기님께,<br>요즘은 퇴근길이 조금 길게 느껴져요. 창밖 나무가 물드는 걸 보면서도 마음이 바빠서 제대로 보지 못했어요. 조용히 오래 머물 수 있는 책이면 좋겠습니다. (예시 편지)</p></div>
<p class="hint" style="text-align:right">142 / 2,000자</p>
<div class="summary" style="margin-top:20px"><dl><dt>이번 편지 회차</dt><dd class="total">30,000원</dd></dl><p class="hint">책값과 배송비가 모두 들어 있어요. 책방지기가 책을 골라 답장과 함께 보내드려요.</p>
<div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><div class="muted small">받는 곳</div>김예시 / 대전 유성구 예시로 00</div><a class="link" href="#">바꾸기</a></div></div>
<button class="btn btn-primary btn-block btn-lg" style="margin-top:24px">우체통에 편지 넣기</button></div>
<div class="hero-art hide-mobile" style="background:var(--card);border:1px solid var(--border)">${postboxSvg()}</div></div>`,
    { kind: 'member', current: 'letter' },
);
page(
    'SCR-14-letter-pending',
    'SCR-14',
    '편지 띄우기 (결제 미완료)',
    `<h1>편지 띄우기</h1>
<div class="notice notice-warm" style="margin-top:20px" role="status">아직 결제가 끝나지 않았어요</div>
<div class="paper" style="margin-top:20px"><p class="letter">책방지기님께,<br>요즘은 퇴근길이 조금 길게 느껴져요. 창밖 나무가 물드는 걸 보면서도 마음이 바빠서 제대로 보지 못했어요. (예시 편지)</p></div>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:24px"><button class="btn btn-primary btn-lg">다시 결제하기</button><button class="btn btn-outline btn-lg">편지 거두기</button></div>`,
    { kind: 'member', current: 'letter', narrow: true },
);

// ---------- SCR-15 창가 ----------
const WINDOW_TEXT = {
    arrived: '편지가 서점에 도착했어요',
    reading: '책방지기가 당신의 편지를 읽고 있어요',
    shipped: '책이 서점 문을 나섰습니다',
    empty: '지금 진행 중인 편지가 없어요',
};
function windowPage(state) {
    const actions = {
        arrived: `<button class="btn btn-outline" style="margin-top:20px">취소 요청</button>`,
        reading: `<button class="btn btn-outline" style="margin-top:20px">취소 요청</button>`,
        shipped: '',
        empty: `<a class="btn btn-primary" style="margin-top:20px" href="#">편지 띄우기</a>`,
    }[state];
    const below =
        state === 'shipped'
            ? `<section class="split" style="--cols: 200px 1fr; margin-top:32px; align-items:center"><div class="blind">${blindSvg(150)}</div>
  <div><div class="muted small">책방지기의 힌트</div><p class="hint-quote" style="margin-top:6px">비 오는 날 부엌 창가에서 천천히 읽기 좋은 책이에요. (예시 힌트)</p>
  <p style="margin-top:12px">책이 도착하면 상자 속 카드의 여섯 자리 코드를 입력해 주세요.</p><a class="btn btn-primary" style="margin-top:16px" href="#">코드 입력하기</a></div></section>`
            : '';
    page(
        `SCR-15-window-${state}`,
        'SCR-15',
        `창가 (${WINDOW_TEXT[state]})`,
        `<h1>창가</h1>
<div class="window-panel" style="margin-top:24px"><div>${windowScene(state, WINDOW_TEXT[state])}</div>
  <div><p class="status" role="status">${WINDOW_TEXT[state]}</p>${actions}</div></div>
${below}
<p style="margin-top:32px"><a class="link" href="#">지난 회차의 책은 나의 서가에서 볼 수 있어요</a></p>`,
        { kind: 'member', current: 'mypage' },
    );
}
['arrived', 'reading', 'shipped', 'empty'].forEach(windowPage);

// ---------- SCR-16 언박싱 ----------
page(
    'SCR-16-unboxing',
    'SCR-16',
    '언박싱 (코드 입력 전)',
    `<div style="text-align:center"><h1>상자를 열어 볼까요</h1>
<div class="blind" style="margin:28px auto 0;max-width:320px">${blindSvg(170)}</div>
<p class="hint-quote" style="margin:24px auto 0;max-width:24em">비 오는 날 부엌 창가에서 천천히 읽기 좋은 책이에요. (예시 힌트)</p>
<form style="margin-top:32px"><label class="field" for="code"><span>상자 속 카드의 여섯 자리 코드</span></label>
<input id="code" class="input code-input" inputmode="numeric" maxlength="6" value="4829">
<div style="margin-top:16px"><button class="btn btn-primary btn-lg" disabled type="button" style="min-width:200px">열기</button></div>
<p class="hint">숫자 여섯 자리를 모두 넣으면 열 수 있어요</p></form></div>`,
    { kind: 'member', current: 'mypage', narrow: true },
);
page(
    'SCR-16-unboxing-opened',
    'SCR-16',
    '언박싱 (열린 뒤)',
    `<div class="split" style="--cols: 240px 1fr"><div>${cover(BOOKS[6])}<h1 style="font-size:1.5rem;margin-top:16px">${title(BOOKS[6])}</h1><p class="muted">${BOOKS[6].author}</p></div>
<div><div class="muted small">책방지기의 답장</div><div class="paper" style="margin-top:8px"><p class="letter">보내 주신 편지 잘 읽었어요. 바쁜 계절에도 창밖 나무를 알아보는 마음이 좋았습니다. 천천히 익어 가는 것들에 관한 책을 골랐어요. (예시 답장)</p></div>
<div style="margin-top:20px;aspect-ratio:3/2;max-width:360px;background:var(--secondary);border-radius:var(--radius);display:grid;place-items:center" role="img" aria-label="책방지기 손글씨 엽서 사진"><span class="muted small">손글씨 엽서 사진</span></div>
<a class="btn btn-outline" style="margin-top:24px" href="#">나의 서가에 한 줄 남기기</a></div></div>`,
    { kind: 'member', current: 'mypage' },
);

// ---------- SCR-17 나의 서가 ----------
page(
    'SCR-17-shelf',
    'SCR-17',
    '나의 서가',
    `<h1>나의 서가</h1><p class="lead" style="margin-top:8px">언박싱한 책이 여기에 꽂혀요. 메모는 나만 볼 수 있어요.</p>
<div class="grid" style="margin-top:28px">
<div>${cover(BOOKS[6])}<div class="card"><div class="meta"><div class="title">${title(BOOKS[6])}</div></div></div>
  <div class="memo">첫 장부터 부엌 냄새가 났다. 천천히 아껴 읽는 중. <span class="date">2026-10-20</span></div><div style="display:flex;gap:4px"><button class="btn btn-ghost">수정</button><button class="btn btn-ghost">삭제</button></div></div>
<div>${cover(BOOKS[2])}<div class="card"><div class="meta"><div class="title">${title(BOOKS[2])}</div></div></div>
  <label class="field" style="margin-top:10px"><span class="small">한 줄 메모</span><input class="input" value="습지에 가 보고 싶어졌다"></label><div class="hint" style="display:flex;justify-content:space-between"><span>12 / 100자</span><button class="btn btn-primary" style="min-height:36px;padding:0 14px">저장</button></div></div>
<div>${cover(BOOKS[0])}<div class="card"><div class="meta"><div class="title">${title(BOOKS[0])}</div></div></div>
  <button class="btn btn-ghost" style="padding:0">한 줄 메모 남기기</button></div>
</div>`,
    { kind: 'member', current: 'mypage' },
);

// ---------- SCR-18 구독 마무리 ----------
page(
    'SCR-18-farewell',
    'SCR-18',
    '구독 마무리',
    `<h1>구독 마무리하기</h1>
<div class="paper" style="margin-top:24px"><p class="farewell">우분투북스와 함께 숨을 고르셨던 시간들이<br>좋은 쉼이 되었기를 바랍니다.<br>계절이 바뀌어 책 한 줄의 온기가 필요해지면,<br>언제든 다시 찾아와 주세요.<span class="sig">ㅡ어은동에서, 우분투북스 책방지기 드림</span></p></div>
<p class="notice" style="margin-top:20px">책방지기가 준비하고 있는 책은 마무리한 뒤에도 끝까지 보내드려요.</p>
<label class="field" style="margin-top:28px"><span>책방지기에게 남기는 작별 안부 (비워 두어도 괜찮아요)</span><textarea class="textarea" style="min-height:160px"></textarea></label>
<p class="hint" style="text-align:right">0 / 1,000자</p>
<button class="btn btn-primary btn-lg" style="margin-top:16px">구독을 마무리합니다</button>`,
    { kind: 'member', current: 'mypage', narrow: true },
);

// ---------- SCR-19 서재 작업 ----------
page(
    'SCR-19-admin-desk',
    'SCR-19',
    '관리자 서재 작업',
    `<h1>서재 작업</h1><p class="muted">도착한 순서대로 위에서부터 처리해요.</p>
<section class="step"><div class="step-head"><span class="step-no">1</span><h2 style="font-size:1.25rem">편지 읽기</h2></div>
<div class="row-list"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>김예시 님의 편지</strong><span class="badge badge-plain">읽는 중</span></div>
<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>이예시 님의 편지 <span class="badge badge-plain" style="background:var(--destructive-soft);color:var(--destructive-soft-foreground)">취소 요청</span></span><span style="display:flex;gap:8px"><button class="btn btn-destructive">환불</button><button class="btn btn-outline">취소 거절</button></span></div>
<div style="display:flex;justify-content:space-between"><span>박예시 님의 편지</span><span class="badge badge-plain">편지 도착</span></div></div>
<div class="paper" style="margin-top:16px"><p class="letter">책방지기님께,<br>요즘은 퇴근길이 조금 길게 느껴져요. 창밖 나무가 물드는 걸 보면서도 마음이 바빠서 제대로 보지 못했어요. 조용히 오래 머물 수 있는 책이면 좋겠습니다. (예시 편지)</p></div></section>
<section class="step"><div class="step-head"><span class="step-no">2</span><h2 style="font-size:1.25rem">책 고르기와 답장</h2></div>
<label class="field"><span>제목이나 저자로 찾기</span><input class="input" value="발효"></label>
<div class="row-list" style="margin-top:8px"><label style="display:flex;gap:12px;align-items:center"><input type="radio" checked> ${title(BOOKS[6])} <span class="muted small">재고 4</span></label>
<label style="display:flex;gap:12px;align-items:center;color:var(--muted-foreground)"><input type="radio" disabled> 흙을 만지는 손 <span class="badge badge-soldout">품절</span></label></div>
<label class="field" style="margin-top:20px"><span>답장 편지</span><textarea class="textarea" style="min-height:160px">보내 주신 편지 잘 읽었어요. (예시 답장)</textarea></label>
<label class="field" style="margin-top:16px"><span>손글씨 엽서 사진 (선택, 10MB 이하 이미지)</span><input class="input" value="postcard.jpg"></label></section>
<section class="step"><div class="step-head"><span class="step-no">3</span><h2 style="font-size:1.25rem">힌트 쓰고 발송</h2></div>
<label class="field"><span>힌트 문장 (손님에게 책 대신 보여요)</span><input class="input" value=""><div class="hint">0 / 100자</div></label>
<p class="notice notice-warm small" style="margin-top:16px">아직 빠진 것: 힌트 문장</p>
<button class="btn btn-lg" disabled style="margin-top:16px;min-width:200px">발송</button></section>
<section class="step"><div class="step-head"><h2 style="font-size:1.25rem">작별 안부</h2></div>
<div class="row-list"><div><strong>최예시 님</strong><p class="muted small">그동안 고마웠어요. 겨울에 다시 편지할게요. (예시)</p></div></div></section>`,
    { admin: true, current: 'desk', narrow: true },
);
page(
    'SCR-19-admin-desk-sent',
    'SCR-19',
    '관리자 서재 작업 (발송 완료)',
    `<h1>서재 작업</h1>
<section class="step"><div class="step-head"><span class="step-no">3</span><h2 style="font-size:1.25rem">힌트 쓰고 발송</h2></div>
<div class="summary" style="text-align:center;padding:36px 24px"><p>발송했어요. 손글씨 카드에 이 코드를 적어 주세요.</p>
<p class="code-big" style="margin-top:12px" aria-label="언박싱 코드 4 8 2 9 1 3">482913</p>
<p class="hint">이 코드는 발송한 회차에서 다시 볼 수 있어요</p></div></section>`,
    { admin: true, current: 'desk', narrow: true },
);

// ---------- SCR-20 관리자 홈 ----------
page(
    'SCR-20-admin-home',
    'SCR-20',
    '관리자 홈',
    `<h1>오늘 할 일</h1><div class="tiles" style="margin-top:24px">
<a class="tile" href="#"><div class="muted">도착한 편지</div><div class="count-big" style="margin-top:8px">2</div><div class="link small" style="margin-top:12px">서재 작업</div></a>
<a class="tile" href="#"><div class="muted">발송 대기 주문</div><div class="count-big" style="margin-top:8px">3</div><div class="link small" style="margin-top:12px">주문 처리</div></a>
<a class="tile" href="#"><div class="muted">취소 요청</div><div class="count-big" style="margin-top:8px">1</div><div class="link small" style="margin-top:12px">주문 처리</div></a></div>
<nav class="menu-list" style="margin-top:36px" aria-label="관리자 메뉴"><a href="#">책 관리</a><a href="#">주문 처리</a><a href="#">서재 작업</a></nav>`,
    { admin: true },
);

writeFileSync(join(outDir, 'pages.json'), JSON.stringify(pages, null, 2));
console.log(`시안 ${pages.length}개 생성: ${outDir}`);
