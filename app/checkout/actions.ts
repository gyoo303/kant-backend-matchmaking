'use server';

import { revalidatePath } from 'next/cache';
import { buildPaymentRequest } from '@/app/checkout/payment-request';
import { paymentTargetSchema } from '@/domains/payments/payment';
import type { PaymentRequest, PaymentTarget } from '@/domains/payments/types/payment.types';
import { shippingInputSchema, type ShippingInput } from '@/domains/shipping/shipping.schema';
import { requireMember } from '@/lib/auth/guards';
import { createOrder } from '@/lib/data/orders';
import { fail, ok, runAction, validationFail, type ActionResult } from '@/lib/http/result';

// API-07: 주문 만들기 → 결제 준비. 배송지 빈칸이면 결제창을 열지 않는다(AC-08-7)
export async function startOrderPayment(input: ShippingInput): Promise<ActionResult<PaymentRequest>> {
    return runAction(
        'API-07',
        async () => {
            const member = await requireMember('/checkout');
            const parsed = shippingInputSchema.safeParse(input);
            if (!parsed.success) return validationFail(parsed.error);

            const { orderId } = await createOrder(parsed.data);
            const request = await buildPaymentRequest({ kind: 'order', orderId }, member.id);
            revalidatePath('/mypage/orders');
            return ok(request);
        },
        { OUT_OF_STOCK: '주문할 수 있는 책이 없어요. 품절된 책은 주문에서 빠져요.' },
    );
}

// API-08: 결제 대기 주문·회차를 다시 결제한다(AC-08-4, AC-11-8). 새 ready 결제를 만든다
export async function retryPayment(input: PaymentTarget): Promise<ActionResult<PaymentRequest>> {
    return runAction(
        'API-08',
        async () => {
            const member = await requireMember('/mypage');
            const parsed = paymentTargetSchema.safeParse(input);
            if (!parsed.success) return fail('NOT_FOUND');
            return ok(await buildPaymentRequest(parsed.data, member.id));
        },
        {
            NOT_FOUND: '결제할 주문을 찾을 수 없어요.',
            INVALID_STATE: '이미 결제가 끝났거나 취소된 주문이에요.',
        },
    );
}
