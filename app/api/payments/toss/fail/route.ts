import { NextResponse, type NextRequest } from 'next/server';
import { resultPath } from '@/domains/payments/payment';
import type { PaymentTarget } from '@/domains/payments/types/payment.types';
import { failPayment, findPaymentByPgOrderId } from '@/lib/data/payments';

// API-10: 토스 결제 실패·창 닫기 리다이렉트. 결제만 failed로 두고 주문·회차는 결제 대기 그대로(AC-08-4, AC-11-6)
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const pgOrderId = params.get('orderId');
    const pgCode = (params.get('code') ?? 'UNKNOWN').slice(0, 100);
    let target: PaymentTarget | undefined;

    if (pgOrderId && pgOrderId.length <= 64) {
        try {
            const stored = await findPaymentByPgOrderId(pgOrderId);
            if (stored) {
                target = stored.target;
                await failPayment(pgOrderId, pgCode);
            }
        } catch (error) {
            // 실패 기록을 못 남겨도 결제는 ready로 남고 확정되지 않는다. 화면은 실패 안내로 보낸다
            console.error('[API-10]', { pgOrderId, pgCode, error });
        }
    }
    console.error('[API-10] 결제 실패', pgCode, params.get('message'));
    return NextResponse.redirect(new URL(resultPath({ status: 'fail', code: 'PG_FAILED', target }), request.url), 303);
}
