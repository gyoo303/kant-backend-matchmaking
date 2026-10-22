'use server';

import { revalidatePath } from 'next/cache';
import { memoInputSchema, roundRefSchema } from '@/domains/subscriptions/subscription.schema';
import { requireMember } from '@/lib/auth/guards';
import { deleteMemo as deleteMemoRow, upsertMemo } from '@/lib/data/rounds';
import { fail, ok, runAction, validationFail, type ActionResult } from '@/lib/http/result';

const FORBIDDEN_MESSAGE = '언박싱한 내 책에만 메모를 남길 수 있어요.'; // AC-17-5·6

// API-21 메모 저장·수정: 1권 1개, 100자까지(AC-17-1·2·4). 날짜는 마지막 저장일(updated_at)
export async function saveMemo(input: { roundId: string; body: string }): Promise<ActionResult<null>> {
    return runAction(
        'API-21',
        async () => {
            const member = await requireMember('/mypage/shelf');
            const parsed = memoInputSchema.safeParse(input);
            if (!parsed.success) return validationFail(parsed.error);
            await upsertMemo(member.id, parsed.data.roundId, parsed.data.body);
            revalidatePath('/mypage/shelf');
            return ok(null);
        },
        { FORBIDDEN: FORBIDDEN_MESSAGE },
    );
}

// API-21 메모 삭제(없어도 성공, 남의 메모는 RLS로 0행)
export async function deleteMemo(input: { roundId: string }): Promise<ActionResult<null>> {
    return runAction('API-21', async () => {
        await requireMember('/mypage/shelf');
        const parsed = roundRefSchema.safeParse(input);
        if (!parsed.success) return fail('FORBIDDEN', FORBIDDEN_MESSAGE);
        await deleteMemoRow(parsed.data.roundId);
        revalidatePath('/mypage/shelf');
        return ok(null);
    });
}
