import { NextResponse, type NextRequest } from 'next/server';
import { decideConfirm, idempotencyKeys, resultPath, tossSuccessQuerySchema } from '@/domains/payments/payment';
import type { PaymentTarget } from '@/domains/payments/types/payment.types';
import { confirmPayment, failPayment, findPaymentByPgOrderId } from '@/lib/data/payments';
import { errorCodeOf } from '@/lib/http/result';
import * as toss from '@/lib/payments/toss';

function redirectTo(request: NextRequest, path: string) {
    return NextResponse.redirect(new URL(path, request.url), 303);
}

// SEQ-03 6단계: 승인은 됐는데 확정하지 못하면 PG 결제를 취소하고 결제를 failed로 둔다
async function compensate(pgOrderId: string, paymentKey: string, code: string): Promise<boolean> {
    try {
        await toss.cancel(paymentKey, code === 'OUT_OF_STOCK' ? '재고 부족' : '결제 확정 실패', idempotencyKeys.compensate(pgOrderId));
    } catch (error) {
        // RISK-03 잔여: 돈이 빠졌는데 취소하지 못함 → 운영자가 PG 관리자 화면에서 직접 취소
        console.error('[API-09] COMPENSATION_FAILED', { pgOrderId, code, error });
        await failPayment(pgOrderId, `${code}:COMPENSATION_FAILED`);
        return false;
    }
    await failPayment(pgOrderId, code);
    return true;
}

// API-09: 토스 결제 성공 리다이렉트. 세션 없이 서버가 금액·상태를 검증한 뒤 확정한다(ADR-004)
export async function GET(request: NextRequest) {
    const query = tossSuccessQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!query.success) {
        console.error('[API-09] 잘못된 쿼리', query.error.message);
        return redirectTo(request, resultPath({ status: 'fail', code: 'PG_FAILED' }));
    }
    const { paymentKey, orderId: pgOrderId, amount } = query.data;
    let target: PaymentTarget | undefined;

    try {
        const stored = await findPaymentByPgOrderId(pgOrderId);
        if (!stored) return redirectTo(request, resultPath({ status: 'fail', code: 'NOT_FOUND' }));
        target = stored.target;

        // 3단계: 저장 금액과 다르면 승인 호출 없이 실패 처리(AC-08-8, AC-11-10, NFR-19)
        const decision = decideConfirm(stored, amount);
        if (decision.action === 'already_paid') return redirectTo(request, resultPath({ status: 'ok', target }));
        if (decision.action === 'reject') {
            await failPayment(pgOrderId, decision.code);
            return redirectTo(request, resultPath({ status: 'fail', code: decision.code, target }));
        }

        // 4단계: PG 승인(멱등키). 실패하면 결제 failed, 주문·회차는 결제 대기 그대로(AC-08-4)
        let approved: toss.TossPayment;
        try {
            approved = await toss.confirm({ paymentKey, orderId: pgOrderId, amount: stored.amount }, idempotencyKeys.confirm(pgOrderId));
        } catch (error) {
            console.error('[API-09] PG confirm', error);
            await failPayment(pgOrderId, 'PG_FAILED');
            return redirectTo(request, resultPath({ status: 'fail', code: 'PG_FAILED', target }));
        }

        // 5단계: DB 확정(재고·상태 원자 반영). 7단계: 이미 paid면 같은 성공 화면(AC-08-6)
        try {
            const confirmed = await confirmPayment(pgOrderId, paymentKey, approved.totalAmount);
            return redirectTo(request, resultPath({ status: 'ok', target: confirmed.target }));
        } catch (error) {
            const code = errorCodeOf(error);
            console.error('[API-09] confirm_payment', code, error);
            const cancelled = await compensate(pgOrderId, paymentKey, code);
            return redirectTo(request, resultPath({ status: 'fail', code, contact: !cancelled, target }));
        }
    } catch (error) {
        console.error('[API-09]', error);
        return redirectTo(request, resultPath({ status: 'fail', code: errorCodeOf(error), target }));
    }
}
