// 토스 결제창 열기 (SEQ-03 2단계). 결제 요청값(PaymentRequest)은 서버 액션이 만든다: 금액은 서버 값만 쓴다(NFR-19).
// 성공·실패는 토스가 successUrl/failUrl(API-09·10)로 보낸다. 브라우저에서만 부른다.

// domains/payments/types/payment.types.ts의 PaymentRequest와 같은 모양
export interface TossPaymentRequest {
    pgOrderId: string;
    amount: number;
    orderName: string;
    customerKey: string;
}

export const PAYMENT_CONFIG_MISSING = '결제 설정 값이 비어 있어 결제창을 열 수 없어요. NEXT_PUBLIC_TOSS_CLIENT_KEY를 확인해 주세요';

function siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
}

// 결제창을 닫거나 창이 열리지 않으면 Promise가 실패한다. 이때도 실패 Route Handler(API-10)로 보내
// 결제를 failed로 기록하고 결과 화면의 [다시 결제하기]로 이어지게 한다 (AC-08-4). 외부 결제 흐름이라 window 이동(CONV-04 예외)
function goToFailRoute(pgOrderId: string, code: string): void {
    const failRoute = new URL('/api/payments/toss/fail', siteUrl());
    failRoute.search = new URLSearchParams({ orderId: pgOrderId, code }).toString();
    window.location.assign(failRoute);
}

// 반환값: 결제창을 열지 못한 이유(화면에 보일 문구). 결제창으로 넘어가면 반환되지 않는다
export async function openTossPayment(request: TossPaymentRequest): Promise<string | null> {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) return PAYMENT_CONFIG_MISSING;

    // 결제할 때만 SDK를 받는다 (다른 화면의 번들을 키우지 않게)
    const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
    try {
        const tossPayments = await loadTossPayments(clientKey);
        const payment = tossPayments.payment({ customerKey: request.customerKey });
        await payment.requestPayment({
            method: 'CARD',
            amount: { currency: 'KRW', value: request.amount },
            orderId: request.pgOrderId,
            orderName: request.orderName,
            successUrl: `${siteUrl()}/api/payments/toss/success`,
            failUrl: `${siteUrl()}/api/payments/toss/fail`,
        });
        return null;
    } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'UNKNOWN';
        console.error('[SEQ-03] requestPayment', code, error);
        goToFailRoute(request.pgOrderId, code);
        return null;
    }
}
