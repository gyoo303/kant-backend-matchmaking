// 날짜 표시: 한국 시각 기준 "2026-10-21" (UX-PLAN-FE 시안 SCR-12). 서버·브라우저 어디서 그려도 같은 날짜가 나오게 시간대를 고정한다
const DATE_PARTS = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

export function formatDate(iso: string): string {
    const parts = Object.fromEntries(DATE_PARTS.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
