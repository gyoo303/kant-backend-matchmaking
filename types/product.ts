export const THEMES = ['nature', 'food', 'ecology', 'local'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_LABELS: Record<Theme, string> = { nature: '자연', food: '식문화', ecology: '생태', local: '로컬' };

export interface Product {
    id: string; // KANT 필수
    name: string; // KANT 필수
    price: number; // KANT 필수, 원 단위 정수
    imageUrl: string; // KANT 필수
    description: string; // KANT 필수
    theme: Theme;
    author: string;
    keeperNote: string;
    publisherDescription: string | null;
    stock: number;
    createdAt: string; // ISO, "새로 들어온 책" 정렬
}
