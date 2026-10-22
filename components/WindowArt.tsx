// 창가 일러스트 (UX-D-03·04). 메인 첫 화면(hero)과 창가 상태 4개(WindowScene, TKT-FE-M4-01)가 같은 그림을 쓴다.
// 일러스트 파일이라 SVG 안의 색은 토큰 밖 값을 쓴다(design-system §2 예외 2). 모양·색은 시안(mockups/src/build.mjs)과 같다.
// 촛불 흔들림(UX-17)은 창가 화면 티켓(TKT-FE-M4-01)에서 키프레임 토큰과 함께 넣는다. 지금은 정지 그림이다.
export type WindowArtState = 'hero' | 'arrived' | 'reading' | 'shipped' | 'empty';

interface WindowArtProps {
    state: WindowArtState;
    label: string; // 그림의 대체 텍스트. 창가 상태에서는 상태 문구와 같다 (NFR-11)
}

export function WindowArt({ state, label }: WindowArtProps) {
    const lit = state === 'reading' || state === 'hero';
    const warmId = `window-warm-${state}`;
    const postId = `window-post-${state}`;
    const hasCandle = state === 'hero' || state === 'reading' || state === 'shipped';
    const hasBooks = state === 'hero' || state === 'reading';
    const hasPostbox = state === 'hero' || state === 'shipped';

    return (
        <svg viewBox="0 0 360 260" role="img" aria-label={label} className="block h-auto w-full">
            <defs>
                <radialGradient id={warmId} cx="0.42" cy="0.78" r="0.75">
                    <stop offset="0" stopColor="#f3c46a" />
                    <stop offset=".45" stopColor="#a8692a" />
                    <stop offset="1" stopColor="#2a2236" />
                </radialGradient>
                <radialGradient id={postId}>
                    <stop offset="0" stopColor="#f6c768" stopOpacity=".55" />
                    <stop offset="1" stopColor="#f6c768" stopOpacity="0" />
                </radialGradient>
            </defs>
            <rect width="360" height="260" fill="#1d2440" />
            <circle cx="300" cy="34" r="2" fill="#c8cde0" />
            <circle cx="252" cy="58" r="1.5" fill="#c8cde0" />
            <circle cx="330" cy="70" r="1.2" fill="#c8cde0" />
            <rect x="28" y="18" width="208" height="206" rx="3" fill="#5b4430" />
            <rect x="40" y="30" width="184" height="180" fill={lit ? `url(#${warmId})` : '#10162c'} />
            <rect x="129" y="30" width="6" height="180" fill="#5b4430" />
            <rect x="40" y="117" width="184" height="6" fill="#5b4430" />
            {hasBooks && (
                <>
                    <rect x="150" y="190" width="56" height="9" fill="#3e6a48" />
                    <rect x="154" y="181" width="50" height="9" fill="#8a5a2b" />
                    <rect x="148" y="199" width="60" height="13" fill="#4a5a82" />
                </>
            )}
            {hasCandle && <rect x="105" y="182" width="14" height="30" rx="2" fill="#efe6d2" />}
            {lit && (
                <g>
                    <ellipse cx="112" cy="168" rx="9" ry="16" fill="#e9a83a" opacity=".35" />
                    <ellipse cx="112" cy="171" rx="5" ry="10" fill="#f6c768" />
                </g>
            )}
            {state === 'shipped' && (
                <path d="M112 178c-6-8 6-12 0-20s6-12 0-18" stroke="#8b93ad" strokeWidth="2" fill="none" opacity=".7" />
            )}
            {state === 'arrived' && (
                <g>
                    <rect x="146" y="188" width="46" height="26" rx="2" fill="#efe6d2" />
                    <path d="M146 189l23 14 23-14" stroke="#b9a988" strokeWidth="2" fill="none" />
                </g>
            )}
            <rect x="18" y="210" width="228" height="12" rx="2" fill="#7a5c3e" />
            {hasPostbox && (
                <g>
                    {state === 'shipped' && <circle cx="300" cy="96" r="34" fill={`url(#${postId})`} />}
                    <rect x="296" y="104" width="8" height="22" fill="#5b4430" />
                    <circle cx="300" cy="98" r="7" fill={state === 'shipped' ? '#f6c768' : '#5b6380'} />
                    <rect x="276" y="128" width="48" height="74" rx="22" fill="#b0402f" />
                    <rect x="276" y="150" width="48" height="5" fill="#8a2f22" />
                    <rect x="288" y="140" width="24" height="4" rx="2" fill="#2a120d" />
                    <rect x="296" y="202" width="8" height="46" fill="#5b4430" />
                </g>
            )}
            <rect y="246" width="360" height="14" fill="#151a31" />
        </svg>
    );
}
