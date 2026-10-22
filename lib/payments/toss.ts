import 'server-only';
import { z } from 'zod';
import { AppError } from '@/lib/http/result';

// 토스페이먼츠 서버 API (ADR-004). PG HTTP 호출은 이 파일에서만 한다(AR-API §7).
const TOSS_API = 'https://api.tosspayments.com/v1/payments';

const tossPaymentSchema = z.object({
    paymentKey: z.string(),
    orderId: z.string(),
    status: z.string(),
    totalAmount: z.number().int(),
});

const tossErrorSchema = z.object({ code: z.string(), message: z.string() });

export type TossPayment = z.infer<typeof tossPaymentSchema>;

function authHeader(): string {
    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) throw new AppError('CONFIG_MISSING', 'CONFIG_MISSING: TOSS_SECRET_KEY를 .env.local에 넣어 주세요.');
    return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

async function post(path: string, body: Record<string, unknown>, idempotencyKey: string): Promise<TossPayment> {
    const authorization = authHeader();
    let response: Response;
    try {
        response = await fetch(`${TOSS_API}${path}`, {
            method: 'POST',
            headers: { Authorization: authorization, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
            body: JSON.stringify(body),
            cache: 'no-store',
        });
    } catch (networkError) {
        throw new AppError('PG_FAILED', { network: networkError instanceof Error ? networkError.message : networkError });
    }
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const pgError = tossErrorSchema.safeParse(json);
        throw new AppError('PG_FAILED', {
            status: response.status,
            ...(pgError.success ? pgError.data : { body: json }),
        });
    }
    const payment = tossPaymentSchema.safeParse(json);
    if (!payment.success) throw new AppError('PG_FAILED', { status: response.status, parseError: payment.error.message });
    return payment.data;
}

// SEQ-03 4단계: 결제 승인. 응답의 totalAmount를 승인 금액으로 confirm_payment에 넘긴다
export function confirm(
    params: { paymentKey: string; orderId: string; amount: number },
    idempotencyKey: string,
): Promise<TossPayment> {
    return post('/confirm', params, idempotencyKey);
}

// SEQ-03 6단계 보상 취소, SEQ-08 환불: 전액 취소
export function cancel(paymentKey: string, cancelReason: string, idempotencyKey: string): Promise<TossPayment> {
    return post(`/${encodeURIComponent(paymentKey)}/cancel`, { cancelReason }, idempotencyKey);
}
