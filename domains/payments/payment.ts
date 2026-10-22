import { z } from 'zod';
import { isUuid } from '@/shared/utils/uuid';
import type { PaymentTarget } from './types/payment.types';

// 결제 대상 입력(API-08). 화면에서 온 값이므로 형태를 검사한다
export const paymentTargetSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('order'), orderId: z.string().refine(isUuid) }),
    z.object({ kind: z.literal('round'), roundId: z.string().refine(isUuid) }),
]);

export const ROUND_ORDER_NAME = '우분투북스 편지 구독';

// 결제창에 보이는 상품명: "첫 책 외 N권" (토스 orderName 100자 제한)
export function paymentOrderName(target: PaymentTarget['kind'], itemNames: readonly string[]): string {
    if (target === 'round') return ROUND_ORDER_NAME;
    const [first, ...rest] = itemNames;
    if (!first) return '우분투북스 주문';
    const name = rest.length > 0 ? `${first} 외 ${rest.length}권` : first;
    return name.length > 100 ? `${name.slice(0, 99)}…` : name;
}

// PG 멱등키 (SEQ-03·08). 같은 결제에는 항상 같은 키를 쓴다
export const idempotencyKeys = {
    confirm: (pgOrderId: string) => `confirm-${pgOrderId}`,
    compensate: (pgOrderId: string) => `compensate-${pgOrderId}`,
    refund: (paymentId: string) => `refund-${paymentId}`,
};

// API-09 쿼리(paymentKey, orderId, amount). amount는 정수 문자열만 받는다
export const tossSuccessQuerySchema = z.object({
    paymentKey: z.string().min(1).max(200),
    orderId: z.string().min(6).max(64),
    amount: z.string().regex(/^\d{1,9}$/).transform(Number),
});

export type ConfirmDecision =
    | { action: 'already_paid' }
    | { action: 'reject'; code: 'AMOUNT_MISMATCH' | 'INVALID_STATE' }
    | { action: 'confirm' };

// SEQ-03 3단계: 승인 호출 전에 막을지 정한다. 저장 금액과 1원이라도 다르면 승인하지 않는다(NFR-19)
export function decideConfirm(stored: { status: string; amount: number }, queryAmount: number): ConfirmDecision {
    if (stored.status === 'paid') return { action: 'already_paid' };
    if (stored.status !== 'ready') return { action: 'reject', code: 'INVALID_STATE' };
    if (stored.amount !== queryAmount) return { action: 'reject', code: 'AMOUNT_MISMATCH' };
    return { action: 'confirm' };
}

// 결과 화면 주소 (AR-API §2: Route Handler는 리다이렉트로 결과를 전달)
export function resultPath(
    outcome: { status: 'ok'; target: PaymentTarget } | { status: 'fail'; code: string; contact?: boolean; target?: PaymentTarget },
): string {
    const params = new URLSearchParams({ status: outcome.status });
    if (outcome.status === 'fail') {
        params.set('code', outcome.code);
        if (outcome.contact) params.set('contact', '1');
    }
    if (outcome.target) {
        params.set('target', outcome.target.kind);
        params.set('id', outcome.target.kind === 'order' ? outcome.target.orderId : outcome.target.roundId);
    }
    return `/checkout/result?${params.toString()}`;
}
