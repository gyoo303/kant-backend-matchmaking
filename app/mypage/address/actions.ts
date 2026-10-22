'use server';

import { revalidatePath } from 'next/cache';
import { shippingInputSchema, type ShippingInput } from '@/domains/shipping/shipping.schema';
import { requireMember } from '@/lib/auth/guards';
import { upsertShippingAddress } from '@/lib/data/cart';
import { ok, runAction, validationFail, type ActionResult } from '@/lib/http/result';

// API-06: 기본 배송지 저장(같은 값으로 다시 저장해도 결과 같음)
export async function saveShippingAddress(input: ShippingInput): Promise<ActionResult<null>> {
    return runAction('API-06', async () => {
        const member = await requireMember('/mypage/address');
        const parsed = shippingInputSchema.safeParse(input);
        if (!parsed.success) return validationFail(parsed.error);
        await upsertShippingAddress(member.id, parsed.data);
        revalidatePath('/mypage/address');
        revalidatePath('/checkout');
        return ok(null);
    });
}
