import type { Theme } from '@/types/product';
import { THEME_TEXT_CLASS } from './BookBadges';

// 대체 표지 (UX-D-10): 표지 이미지가 깨지면 테마 바탕색 + 테마 무늬 + 책 제목으로 그린다.
// 일러스트 파일이라 SVG 안의 색은 토큰 밖 값을 쓴다(design-system §2 예외 2). 색은 시안(mockups/src/build.mjs)과 같다.
const PALETTE: Record<Theme, { bg: string; fg: string }> = {
    nature: { bg: '#dfe6d5', fg: '#2f5038' },
    food: { bg: '#efdcc4', fg: '#6e4521' },
    ecology: { bg: '#d3e3e0', fg: '#1f4f4e' },
    local: { bg: '#dcdfea', fg: '#3b4870' },
};

function Motif({ theme, fg }: { theme: Theme; fg: string }) {
    switch (theme) {
        case 'nature':
            return (
                <>
                    <path d="M60 118c-22-30-6-62 28-70 6 34-6 60-28 70z" fill="none" stroke={fg} strokeWidth="3" />
                    <path d="M60 118c8-24 16-42 28-70" stroke={fg} strokeWidth="2" fill="none" />
                </>
            );
        case 'food':
            return (
                <>
                    <path d="M36 80h88a44 44 0 0 1-88 0z" fill="none" stroke={fg} strokeWidth="3" />
                    <path d="M62 66c0-10 8-10 8-20M82 66c0-10 8-10 8-20" stroke={fg} strokeWidth="2" fill="none" />
                </>
            );
        case 'ecology':
            return (
                <path
                    d="M24 70q14-12 28 0t28 0 28 0 28 0M24 90q14-12 28 0t28 0 28 0 28 0M24 110q14-12 28 0t28 0 28 0 28 0"
                    stroke={fg}
                    strokeWidth="2.5"
                    fill="none"
                />
            );
        case 'local':
            return (
                <>
                    <path d="M28 116V82l22-18 22 18v34M72 116V72l26-20 26 20v44" stroke={fg} strokeWidth="3" fill="none" />
                    <rect x="44" y="96" width="12" height="20" fill="none" stroke={fg} strokeWidth="2" />
                </>
            );
    }
}

interface FallbackCoverProps {
    theme: Theme;
    title: string;
    alt: string;
}

export function FallbackCover({ theme, title, alt }: FallbackCoverProps) {
    const { bg, fg } = PALETTE[theme];
    return (
        <div role="img" aria-label={alt} className="absolute inset-0">
            <svg viewBox="0 0 150 200" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden="true">
                <rect width="150" height="200" fill={bg} />
                <rect width="6" height="200" fill={fg} opacity=".18" />
                <Motif theme={theme} fg={fg} />
            </svg>
            <p
                aria-hidden="true"
                className={`font-heading absolute inset-x-0 bottom-0 line-clamp-3 p-4 text-lg leading-snug font-bold ${THEME_TEXT_CLASS[theme]}`}
            >
                {title}
            </p>
        </div>
    );
}
