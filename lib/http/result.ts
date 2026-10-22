import { unstable_rethrow } from 'next/navigation';
import type { z } from 'zod';

// AR-API §2 에러 모델. Server Action은 모두 ActionResult를 돌려준다.
export type ErrorCode =
    | 'UNAUTHENTICATED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VALIDATION'
    | 'OUT_OF_STOCK'
    | 'AMOUNT_MISMATCH'
    | 'INVALID_STATE'
    | 'ALREADY_PROCESSING'
    | 'ROUND_IN_PROGRESS'
    | 'CANCEL_REQUESTED'
    | 'MISSING_SHIPMENT_FIELDS'
    | 'WRONG_CODE'
    | 'WITHDRAW_BLOCKED'
    | 'PG_FAILED'
    | 'CONFIG_MISSING'
    | 'UNKNOWN';

export type ActionError = { code: ErrorCode; message: string; fieldErrors?: Record<string, string> };

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ERROR_CODES: readonly ErrorCode[] = [
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'NOT_FOUND',
    'VALIDATION',
    'OUT_OF_STOCK',
    'AMOUNT_MISMATCH',
    'INVALID_STATE',
    'ALREADY_PROCESSING',
    'ROUND_IN_PROGRESS',
    'CANCEL_REQUESTED',
    'MISSING_SHIPMENT_FIELDS',
    'WRONG_CODE',
    'WITHDRAW_BLOCKED',
    'PG_FAILED',
    'CONFIG_MISSING',
    'UNKNOWN',
];

export function isErrorCode(value: string): value is ErrorCode {
    return (ERROR_CODES as readonly string[]).includes(value);
}

// 화면에 그대로 보여 줄 기본 문장(PM-AC·PM-US 문구). 액션마다 더 구체적인 문장이 있으면 fail()의 message로 덮어쓴다.
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
    UNAUTHENTICATED: '로그인이 필요해요.',
    FORBIDDEN: '이 작업을 할 수 있는 권한이 없어요.',
    NOT_FOUND: '찾을 수 없어요.',
    VALIDATION: '입력한 내용을 다시 확인해 주세요.',
    OUT_OF_STOCK: '품절된 책이 있어요.',
    AMOUNT_MISMATCH: '결제 금액이 맞지 않아 결제를 취소했어요.',
    INVALID_STATE: '지금 상태에서는 할 수 없는 요청이에요.',
    ALREADY_PROCESSING: '이미 처리 중이에요.',
    ROUND_IN_PROGRESS: '지금 책방지기가 편지를 준비하고 있어요.',
    CANCEL_REQUESTED: '취소 요청이 있는 주문이에요. 환불하거나 거절해 주세요.',
    MISSING_SHIPMENT_FIELDS: '책·답장·힌트를 모두 넣어 주세요.',
    WRONG_CODE: '코드가 맞지 않아요. 상자 속 카드를 다시 확인해 주세요.',
    WITHDRAW_BLOCKED: '발송 전인 주문이나 책방지기가 준비 중인 편지가 있어 지금은 탈퇴할 수 없어요.',
    PG_FAILED: '결제를 마치지 못했어요. 잠시 후 다시 시도해 주세요.',
    CONFIG_MISSING: '서버 설정이 끝나지 않았어요. 환경 변수를 확인해 주세요.',
    UNKNOWN: '잠시 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
};

// lib/data·lib/payments가 던지는 오류. code는 ErrorCode, detail은 서버 로그용(응답에 넣지 않는다)
export class AppError extends Error {
    readonly code: ErrorCode;
    readonly detail: unknown;

    constructor(code: ErrorCode, detail?: unknown) {
        super(code);
        this.name = 'AppError';
        this.code = code;
        this.detail = detail;
    }
}

export function ok<T>(data: T): ActionResult<T> {
    return { ok: true, data };
}

export function fail<T = never>(
    code: ErrorCode,
    message: string = ERROR_MESSAGES[code],
    fieldErrors?: Record<string, string>,
): ActionResult<T> {
    return { ok: false, error: fieldErrors ? { code, message, fieldErrors } : { code, message } };
}

// zod safeParse 실패 → VALIDATION + 칸별 첫 번째 이유 (ADR-008)
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
        const key = issue.path.map(String).join('.') || '_';
        if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return fieldErrors;
}

export function validationFail<T = never>(error: z.ZodError, message?: string): ActionResult<T> {
    return fail('VALIDATION', message, fieldErrorsOf(error));
}

// 던져진 오류 → ErrorCode. CONFIG_MISSING은 lib/supabase/env.ts 메시지 접두로 판별한다.
export function errorCodeOf(error: unknown): ErrorCode {
    if (error instanceof AppError) return error.code;
    if (error instanceof Error && error.message.startsWith('CONFIG_MISSING')) return 'CONFIG_MISSING';
    return 'UNKNOWN';
}

// Server Action 공통 래퍼: redirect()·notFound()는 다시 던지고, 나머지는 로그를 남긴 뒤 ActionResult로 바꾼다.
// messages: 이 액션에서 화면 문구를 바꿀 코드만 적는다.
export async function runAction<T>(
    apiId: string,
    body: () => Promise<ActionResult<T>>,
    messages: Partial<Record<ErrorCode, string>> = {},
): Promise<ActionResult<T>> {
    try {
        return await body();
    } catch (error) {
        unstable_rethrow(error);
        const code = errorCodeOf(error);
        if (code === 'UNKNOWN' || code === 'CONFIG_MISSING') {
            console.error(`[${apiId}]`, error instanceof AppError ? error.detail : error);
        }
        return fail(code, messages[code] ?? ERROR_MESSAGES[code]);
    }
}
