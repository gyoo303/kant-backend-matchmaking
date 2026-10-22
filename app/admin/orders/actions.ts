'use server';

import { invalidStateMessage, revalidateCancelScreens, runTransition } from '@/app/mypage/cancel-flow';
import { cancelTargetSchema, REFUND_FAILED_MESSAGE, type CancelTarget } from '@/domains/orders/order';
import type { OrderStatus } from '@/domains/orders/types/order.types';
import { idempotencyKeys } from '@/domains/payments/payment';
import { authorizeKeeper } from '@/lib/auth/guards';
import { shipOrder as shipOrderRpc } from '@/lib/data/orders';
import { beginRefund, completeRefund, failRefund } from '@/lib/data/payments';
import { AppError, fail, ok, runAction, type ActionResult } from '@/lib/http/result';
import * as toss from '@/lib/payments/toss';

const NOT_FOUND_MESSAGE = '주문이나 편지를 찾을 수 없어요.';

// API-13 발송 완료: paid → shipped. 취소 요청 중이면 막는다(AC-10-1·4)
export async function shipOrder(input: CancelTarget): Promise<ActionResult<OrderStatus>> {
    return runAction(
        'API-13',
        async () => {
            const keeper = await authorizeKeeper();
            if (!keeper.ok) return keeper;
            const parsed = cancelTargetSchema.safeParse(input);
            if (!parsed.success || parsed.data.kind !== 'order') return fail('NOT_FOUND', NOT_FOUND_MESSAGE);
            try {
                const status = await shipOrderRpc(parsed.data.id);
                revalidateCancelScreens();
                return ok(status);
            } catch (error) {
                if (error instanceof AppError && error.code === 'INVALID_STATE') return fail('INVALID_STATE', await invalidStateMessage(parsed.data));
                throw error;
            }
        },
        { NOT_FOUND: NOT_FOUND_MESSAGE },
    );
}

// API-13 취소 거절: 주문 cancel_requested → paid / 회차 표시 해제 + 거절 기록(AC-10-6, AC-20-6)
export async function rejectCancel(input: CancelTarget): Promise<ActionResult<OrderStatus | null>> {
    return runAction(
        'API-13',
        async () => {
            const keeper = await authorizeKeeper();
            if (!keeper.ok) return keeper;
            const parsed = cancelTargetSchema.safeParse(input);
            if (!parsed.success) return fail('NOT_FOUND', NOT_FOUND_MESSAGE);
            return runTransition('reject_cancel', parsed.data);
        },
        { NOT_FOUND: NOT_FOUND_MESSAGE },
    );
}

// API-13 환불(SEQ-08): begin_refund(paid→refunding, 잠금) → PG 전액 취소 → complete_refund / fail_refund.
// 두 번 눌러도 begin_refund가 한 번만 통과시킨다(AC-10-5, AC-20-4)
export async function refund(input: CancelTarget): Promise<ActionResult<null>> {
    return runAction(
        'API-13',
        async () => {
            const keeper = await authorizeKeeper();
            if (!keeper.ok) return keeper;
            const parsed = cancelTargetSchema.safeParse(input);
            if (!parsed.success) return fail('NOT_FOUND', NOT_FOUND_MESSAGE);
            const target = parsed.data.kind === 'order' ? { kind: 'order' as const, orderId: parsed.data.id } : { kind: 'round' as const, roundId: parsed.data.id };

            let started: { paymentId: string; paymentKey: string };
            try {
                started = await beginRefund(target);
            } catch (error) {
                if (error instanceof AppError && error.code === 'INVALID_STATE') return fail('INVALID_STATE', await invalidStateMessage(parsed.data));
                throw error;
            }

            try {
                await toss.cancel(started.paymentKey, '고객 취소 요청', idempotencyKeys.refund(started.paymentId));
            } catch (error) {
                // PG 환불 실패: 결제를 paid로 되돌리고 주문·회차 상태는 그대로(AC-10-3)
                console.error('[API-13] PG refund', error);
                await failRefund(started.paymentId);
                revalidateCancelScreens();
                return fail('PG_FAILED', REFUND_FAILED_MESSAGE);
            }

            try {
                await completeRefund(started.paymentId);
            } catch (error) {
                // PG는 환불됐는데 DB 반영 실패: 결제가 refunding으로 남는다. 운영자 확인 필요(브리핑 "남은 위험")
                console.error('[API-13] REFUND_DB_FAILED', { paymentId: started.paymentId, error });
                throw error;
            }
            revalidateCancelScreens();
            return ok(null);
        },
        { NOT_FOUND: NOT_FOUND_MESSAGE, ALREADY_PROCESSING: '이미 환불을 처리하고 있어요.' },
    );
}
