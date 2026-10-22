import { z } from 'zod';
import { shippingInputSchema } from '@/domains/shipping/shipping.schema';
import { isUuid } from '@/shared/utils/uuid';

// 편지 구독 입력 한도(D-025)와 검증 스키마. 한도는 AR-DB §3 check·RPC 검사와 같다
export const LETTER_MIN = 10;
export const LETTER_MAX = 2000;
export const REPLY_MAX = 3000;
export const TEASER_MAX = 100;
export const MEMO_MAX = 100;
export const FAREWELL_MAX = 1000;
export const POSTCARD_MAX_BYTES = 10 * 1024 * 1024;
export const POSTCARD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const roundIdSchema = z.string().refine(isUuid, '편지를 찾을 수 없어요.');

// API-15 편지 띄우기 (AC-11-5: 10~2,000자)
export const letterInputSchema = z.object({
    body: z
        .string({ error: '편지를 써 주세요.' })
        .trim()
        .min(LETTER_MIN, `편지는 ${LETTER_MIN}자 이상 써 주세요.`)
        .max(LETTER_MAX, `편지는 ${LETTER_MAX.toLocaleString('ko-KR')}자까지 쓸 수 있어요.`),
    shipping: shippingInputSchema,
});
export type LetterInput = z.infer<typeof letterInputSchema>;

// API-18 서재 작업 저장(책 매칭·답장). 엽서 파일은 checkPostcardFile로 따로 본다
export const roundContentsInputSchema = z.object({
    roundId: roundIdSchema,
    productId: z.string().refine(isUuid, '책을 골라 주세요.'),
    replyLetter: z
        .string({ error: '답장을 써 주세요.' })
        .trim()
        .min(1, '답장을 써 주세요.')
        .max(REPLY_MAX, `답장은 ${REPLY_MAX.toLocaleString('ko-KR')}자까지 쓸 수 있어요.`),
});

// API-19 발송 (AC-15-3: 힌트 1~100자)
export const shipRoundInputSchema = z.object({
    roundId: roundIdSchema,
    teaser: z
        .string({ error: '힌트 문장을 써 주세요.' })
        .trim()
        .min(1, '힌트 문장을 써 주세요.')
        .max(TEASER_MAX, `힌트 문장은 ${TEASER_MAX}자까지 쓸 수 있어요.`),
});

// API-20 언박싱 (AC-16-5: 6자리 숫자만)
export const unboxInputSchema = z.object({
    roundId: roundIdSchema,
    code: z.string().regex(/^\d{6}$/, '6자리 숫자를 넣어 주세요.'),
});

// API-21 서가 메모 (AC-17-4: 100자 초과 거부)
export const memoInputSchema = z.object({
    roundId: roundIdSchema,
    body: z
        .string({ error: '메모를 써 주세요.' })
        .trim()
        .min(1, '메모를 써 주세요.')
        .max(MEMO_MAX, `메모는 ${MEMO_MAX}자까지 쓸 수 있어요.`),
});

export const roundRefSchema = z.object({ roundId: roundIdSchema });

// API-22 구독 마무리 (AC-18-5: 작별 안부 0~1,000자, 비워도 된다)
export const farewellInputSchema = z.object({
    note: z
        .string()
        .trim()
        .max(FAREWELL_MAX, `작별 안부는 ${FAREWELL_MAX.toLocaleString('ko-KR')}자까지 쓸 수 있어요.`)
        .default(''),
});

// 엽서 사진: 이미지 1장 10MB 이하(AC-14-3). 없으면 기존 엽서 유지
export type PostcardCheck = { ok: true; file: File | null } | { ok: false; message: string };

export function checkPostcardFile(value: unknown): PostcardCheck {
    const file = value instanceof File && value.size > 0 ? value : null;
    if (!file) return { ok: true, file: null };
    if (!(POSTCARD_MIME_TYPES as readonly string[]).includes(file.type)) {
        return { ok: false, message: 'JPG·PNG·WEBP 이미지만 올릴 수 있어요.' };
    }
    if (file.size > POSTCARD_MAX_BYTES) return { ok: false, message: '엽서 사진은 10MB까지 올릴 수 있어요.' };
    return { ok: true, file };
}
