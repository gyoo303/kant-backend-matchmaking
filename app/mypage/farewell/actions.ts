'use server';

import { revalidatePath } from 'next/cache';
import { farewellInputSchema } from '@/domains/subscriptions/subscription.schema';
import { requireMember } from '@/lib/auth/guards';
import { endSubscription as endSubscriptionRpc } from '@/lib/data/rounds';
import { ok, runAction, validationFail, type ActionResult } from '@/lib/http/result';

// API-22 구독 마무리(SEQ-09): 확인 팝업 없이 바로(INV-13). 결제 대기 회차는 취소, 도착·읽는 중·발송 회차는 그대로(INV-14)
export async function endSubscription(input: { note?: string }): Promise<ActionResult<null>> {
    return runAction(
        'API-22',
        async () => {
            await requireMember('/mypage/farewell');
            const parsed = farewellInputSchema.safeParse(input);
            if (!parsed.success) return validationFail(parsed.error);
            await endSubscriptionRpc(parsed.data.note);
            for (const path of ['/mypage', '/mypage/farewell', '/mypage/window', '/letters/new', '/admin/desk']) revalidatePath(path);
            return ok(null);
        },
        { INVALID_STATE: '진행 중인 구독이 없어요.' },
    );
}
