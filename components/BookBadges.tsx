import { Badge } from '@/components/ui/badge';
import { THEME_LABELS, type Theme } from '@/types/product';

// 테마 글자색 토큰 (design-system §2). Tailwind가 찾을 수 있게 클래스 이름을 문자열 그대로 둔다.
export const THEME_TEXT_CLASS: Record<Theme, string> = {
    nature: 'text-theme-nature',
    food: 'text-theme-food',
    ecology: 'text-theme-ecology',
    local: 'text-theme-local',
};

const BADGE_CLASS = 'h-auto gap-1.5 px-2 py-1 text-sm font-normal';

// 테마 배지: 점 + 테마 이름, 바탕 --secondary, 글자 --theme-* (design-system §5)
export function ThemeBadge({ theme }: { theme: Theme }) {
    return (
        <Badge variant="secondary" className={`${BADGE_CLASS} ${THEME_TEXT_CLASS[theme]}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {THEME_LABELS[theme]}
        </Badge>
    );
}

// 품절 배지: --foreground 바탕 / --background 글자 (AC-02-3, AC-03-5)
export function SoldOutBadge() {
    return <Badge className={`${BADGE_CLASS} bg-foreground text-background`}>품절</Badge>;
}
