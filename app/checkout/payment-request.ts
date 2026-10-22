import 'server-only';
import { paymentOrderName } from '@/domains/payments/payment';
import type { PaymentRequest, PaymentTarget } from '@/domains/payments/types/payment.types';
import { getOrderItemNames } from '@/lib/data/orders';
import { createPayment } from '@/lib/data/payments';

// SEQ-03 1단계 공용(API-07·08·15): ready 결제를 만들고 결제창 요청값을 돌려준다. 금액은 서버(DB) 값만 쓴다(NFR-19)
export async function buildPaymentRequest(target: PaymentTarget, memberId: string): Promise<PaymentRequest> {
    const { pgOrderId, amount } = await createPayment(target);
    const itemNames = target.kind === 'order' ? await getOrderItemNames(target.orderId) : [];
    return { pgOrderId, amount, orderName: paymentOrderName(target.kind, itemNames), customerKey: memberId };
}
