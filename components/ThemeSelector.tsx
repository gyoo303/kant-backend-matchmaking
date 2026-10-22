import Link from 'next/link';
import { THEME_INTROS } from '@/domains/products/theme';
import { THEME_LABELS, THEMES, type Theme } from '@/types/product';

function themeHref(theme: Theme | undefined): string {
    return theme ? `/products?theme=${theme}` : '/products';
}

const PILL_CLASS =
    'inline-flex min-h-11 items-center rounded-full border border-input px-4 hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground';

// 목록(SCR-02): 둥근 알약 링크. 선택된 것은 --primary 바탕 (design-system §5). 주소에 테마가 남는다 (AC-02-2)
// themes를 주면 그 테마만 링크로 보인다(빈 서가의 다른 테마). markCurrent=false는 주소를 아직 읽기 전(로딩 중)이다
export function ThemePills({
    selected,
    themes,
    label = '테마 고르기',
    markCurrent = true,
}: {
    selected?: Theme;
    themes?: readonly Theme[];
    label?: string;
    markCurrent?: boolean;
}) {
    const showAll = themes === undefined;
    const options: (Theme | undefined)[] = showAll ? [undefined, ...THEMES] : [...themes];
    return (
        <nav aria-label={label} className="flex flex-wrap gap-2">
            {options.map((theme) => (
                <Link
                    key={theme ?? 'all'}
                    href={themeHref(theme)}
                    aria-current={markCurrent && showAll && theme === selected ? 'true' : undefined}
                    className={PILL_CLASS}
                >
                    {theme ? THEME_LABELS[theme] : '전체'}
                </Link>
            ))}
        </nav>
    );
}

// 책등 그림(장식). 높이·색은 서가 칸마다 같고 테마 색만 바뀐다
const SPINE_HEIGHTS = ['h-15', 'h-12', 'h-17', 'h-13', 'h-16', 'h-11', 'h-14'];
const SPINE_DARK: Record<Theme, string> = {
    nature: 'bg-theme-nature',
    food: 'bg-theme-food',
    ecology: 'bg-theme-ecology',
    local: 'bg-theme-local',
};
const SPINE_LIGHT: Record<Theme, string> = {
    nature: 'border-theme-nature bg-card',
    food: 'border-theme-food bg-card',
    ecology: 'border-theme-ecology bg-card',
    local: 'border-theme-local bg-card',
};

// 메인(SCR-01): 서가 칸 4개. 칸 전체가 링크 (UX-PLAN-FE screens §SCR-01)
export function ThemeShelves() {
    return (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {THEMES.map((theme) => (
                <li key={theme}>
                    <Link
                        href={themeHref(theme)}
                        className="bg-card hover:border-input flex h-full flex-col rounded-lg border px-4 pt-5"
                    >
                        <h3 className="font-heading text-xl font-bold">{THEME_LABELS[theme]}</h3>
                        <p className="text-muted-foreground mt-1 flex-1 text-sm">{THEME_INTROS[theme]}</p>
                        <div aria-hidden="true" className="border-wood mt-3 flex h-18 items-end gap-1 border-b-6 px-1">
                            {SPINE_HEIGHTS.map((height, index) => (
                                <span
                                    key={height}
                                    className={`block w-3.5 rounded-t-xs ${height} ${index % 2 ? SPINE_DARK[theme] : `border ${SPINE_LIGHT[theme]}`}`}
                                />
                            ))}
                        </div>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
