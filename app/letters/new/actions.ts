'use server';

import { revalidatePath } from 'next/cache';
import { buildPaymentRequest } from '@/app/checkout/payment-request';
import type { PaymentRequest } from '@/domains/payments/types/payment.types';
import type { ShippingInput } from '@/domains/shipping/shipping.schema';
import { letterInputSchema } from '@/domains/subscriptions/subscription.schema';
import { ROUND_IN_PROGRESS_COPY } from '@/domains/subscriptions/window-copy';
import { requireMember } from '@/lib/auth/guards';
import { createRound } from '@/lib/data/rounds';
import { ok, runAction, validationFail, type ActionResult } from '@/lib/http/result';

// API-15 편지 띄우기(SEQ-04): 편지 + 회차(결제 대기) → 결제 준비(회차 30,000원은 DB 값, D-003).
// 결제 확정은 API-09가 한다. 확정 전에는 책방지기 화면에 나오지 않는다(INV-18)
export async function postLetter(input: { body: string; shipping: ShippingInput }): Promise<ActionResult<PaymentRequest>> {
    return runAction(
        'API-15',
        async () => {
            const member = await requireMember('/letters/new');
            const parsed = letterInputSchema.safeParse(input);
            if (!parsed.success) return validationFail(parsed.error);

            const { roundId } = await createRound(parsed.data.body, parsed.data.shipping);
            const request = await buildPaymentRequest({ kind: 'round', roundId }, member.id);
            revalidatePath('/letters/new');
            revalidatePath('/mypage/window');
            return ok(request);
        },
        { ROUND_IN_PROGRESS: ROUND_IN_PROGRESS_COPY },
    );
}
