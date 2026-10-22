// 블라인드 북 (design-system §5): --secondary 바탕 위 흐린 책 실루엣 + 물음표. 제목·표지는 언박싱 전 어디에도 없다 (INV-07, NFR-08)
// 일러스트 파일이라 SVG 안의 색은 토큰 밖 값을 쓴다(design-system §2 예외 2). 모양·색은 시안(mockups/src/build.mjs)과 같다
export function BlindBook({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-secondary grid place-items-center rounded-lg p-8 ${className}`}>
            <svg viewBox="0 0 150 200" role="img" aria-label="아직 열리지 않은 책" className="h-auto w-full max-w-36">
                <defs>
                    <filter id="blind-book-soft">
                        <feGaussianBlur stdDeviation="3" />
                    </filter>
                </defs>
                <rect x="14" y="10" width="122" height="180" rx="4" fill="#2b3330" opacity=".88" filter="url(#blind-book-soft)" />
                <rect x="22" y="18" width="8" height="164" fill="#3d4743" opacity=".8" />
                <path d="M60 92c0-12 30-12 30 0 0 10-15 10-15 22" stroke="#9aa59e" strokeWidth="5" fill="none" strokeLinecap="round" />
                <circle cx="75" cy="128" r="3.5" fill="#9aa59e" />
            </svg>
        </div>
    );
}
