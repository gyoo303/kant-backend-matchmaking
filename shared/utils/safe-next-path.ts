// 로그인 후 돌아갈 주소. '/'로 시작하는 내부 경로만 허용한다(오픈 리다이렉트 방지, SEQ-01).
// '//evil.com', '/\evil.com'처럼 브라우저가 외부 주소로 해석하는 값과 제어 문자가 섞인 값은 fallback으로 바꾼다.
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
    if (!next || !next.startsWith('/')) return fallback;
    if (next.startsWith('//') || next.startsWith('/\\')) return fallback;
    for (const char of next) {
        if (char.charCodeAt(0) < 0x20) return fallback;
    }
    return next;
}
