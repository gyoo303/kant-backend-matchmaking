// 편지 봉투와 우체통 그림 (SCR-14 장식, SCR-11 회차 결제 뒤 우체통 들어감 D-041).
// 일러스트 파일이라 SVG 안의 색은 토큰 밖 값을 쓴다(design-system §2 예외 2). 모양·색은 시안(mockups/src/build.mjs)과 같다.
// stage: open(편지지) / closed(봉투 닫힘) / posted(우체통 들어감). 움직임은 motion-safe에서만 (NFR-10, CONV-11)
export type LetterArtStage = 'open' | 'closed' | 'posted';

export function LetterArt({ stage, label }: { stage: LetterArtStage; label: string }) {
    const envelopeClass = stage === 'posted' ? 'motion-safe:animate-mailbox-drop motion-reduce:opacity-0' : '';
    return (
        <svg viewBox="0 0 220 220" role="img" aria-label={label} className="block h-auto w-full">
            <rect x="120" y="40" width="72" height="120" rx="34" fill="#b0402f" />
            <rect x="120" y="76" width="72" height="6" fill="#8a2f22" />
            <rect x="138" y="58" width="36" height="6" rx="3" fill="#2a120d" />
            <rect x="150" y="160" width="12" height="52" fill="#5b4430" />
            <g className={envelopeClass}>
                <g transform="rotate(-8 60 120)">
                    <rect x="18" y="98" width="86" height="54" rx="3" fill="#fafaf6" stroke="#b9a988" strokeWidth="2" />
                    {stage === 'open' ? (
                        // 열린 덮개: 위로 젖혀진 삼각형
                        <path d="M18 100l43-30 43 30" stroke="#b9a988" strokeWidth="2" fill="#fafaf6" />
                    ) : (
                        <path
                            d="M18 100l43 30 43-30"
                            stroke="#b9a988"
                            strokeWidth="2"
                            fill="#f1ead9"
                            className={stage === 'closed' ? 'motion-safe:animate-envelope-close svg-origin-top' : ''}
                        />
                    )}
                </g>
            </g>
        </svg>
    );
}
