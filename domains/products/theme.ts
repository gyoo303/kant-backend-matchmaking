import { THEMES, type Theme } from '@/types/product';

// 주소의 ?theme= 값 → Theme. 잘못된 값·빈 값은 undefined(전체 목록)로 본다 (AC-02-5, REJ-03)
// 같은 키가 여러 번 오면(?theme=a&theme=b) 첫 값만 본다.
export function parseTheme(value: string | string[] | undefined): Theme | undefined {
    const first = Array.isArray(value) ? value[0] : value;
    return THEMES.find((theme) => theme === first);
}

// 테마 서가 한 줄 소개 (UX-PLAN-FE 시안 [제안] 문구, PM-SCR §3 "선택 테마 한 줄 소개")
export const THEME_INTROS: Record<Theme, string> = {
    nature: '숲과 풀, 계절을 따라 읽는 책',
    food: '제철 밥상과 부엌에서 읽는 책',
    ecology: '함께 사는 생명을 들여다보는 책',
    local: '동네와 골목의 이야기를 담은 책',
};
export const ALL_THEMES_INTRO = '네 개의 서가에 꽂힌 책을 모두 보여드려요.';

// 화면 상태 문구 (PM-AC 고정)
export const PRODUCTS_LOAD_FAILED = '책을 불러오지 못했어요'; // AC-01-4
export const EMPTY_SHELF = '이 서가는 아직 비어 있어요'; // AC-02-4
