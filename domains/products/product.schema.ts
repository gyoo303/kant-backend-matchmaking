import { z } from 'zod';
import { THEMES } from '@/types/product';

// API-04 책 저장 입력 (ADR-008). 화면 폼과 서버 액션이 같이 쓴다. 한도는 products 테이블 check와 같다(AR-DB §3).
export const COVER_MAX_BYTES = 5 * 1024 * 1024; // book-covers 버킷 5MB
export const COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// 폼 값(문자열)과 숫자를 모두 받는다. 빈칸은 "입력해 주세요", 음수·소수는 이유를 칸에 보여 준다(AC-06-4)
function wholeNumber(label: string) {
    return z.preprocess(
        (value) => (typeof value === 'string' ? (value.trim() === '' ? undefined : Number(value.trim())) : value),
        z
            .number({ error: (issue) => (issue.input === undefined ? `${label}을 입력해 주세요.` : '숫자로 입력해 주세요.') })
            .int('소수는 넣을 수 없어요. 정수로 입력해 주세요.')
            .min(0, '0 이상으로 입력해 주세요.'),
    );
}

function requiredText(label: string, max?: number) {
    const base = z.string({ error: `${label}을 입력해 주세요.` }).trim().min(1, `${label}을 입력해 주세요.`);
    return max ? base.max(max, `${label}은 ${max}자까지 쓸 수 있어요.`) : base;
}

export const productInputSchema = z.object({
    name: requiredText('제목', 200),
    author: requiredText('저자', 100),
    price: wholeNumber('가격'),
    theme: z.enum(THEMES, { error: '테마를 골라 주세요.' }),
    description: requiredText('짧은 설명', 300),
    keeperNote: requiredText('책방지기 노트'),
    publisherDescription: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value ? value : null)),
    stock: wholeNumber('재고'),
});

export type ProductInput = z.infer<typeof productInputSchema>;

// 표지 파일 검사. 새 책은 필수, 수정은 선택(없으면 기존 표지 유지)
export type CoverCheck = { ok: true; file: File | null } | { ok: false; message: string };

export function checkCoverFile(value: unknown, required: boolean): CoverCheck {
    const file = value instanceof File && value.size > 0 ? value : null;
    if (!file) return required ? { ok: false, message: '표지 이미지를 넣어 주세요.' } : { ok: true, file: null };
    if (!(COVER_MIME_TYPES as readonly string[]).includes(file.type)) {
        return { ok: false, message: 'JPG·PNG·WEBP 이미지만 올릴 수 있어요.' };
    }
    if (file.size > COVER_MAX_BYTES) return { ok: false, message: '표지 이미지는 5MB까지 올릴 수 있어요.' };
    return { ok: true, file };
}

// 이미지 MIME → 저장 확장자 (AR-DB §6 경로 규칙)
export function imageExtension(mimeType: string): 'jpg' | 'png' | 'webp' {
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    return 'jpg';
}
