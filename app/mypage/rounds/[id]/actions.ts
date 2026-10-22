'use server';

import { revalidatePath } from 'next/cache';
import { unboxInputSchema } from '@/domains/subscriptions/subscription.schema';
import type { UnboxedRound } from '@/domains/subscriptions/types/round.types';
import { requireMember } from '@/lib/auth/guards';
import { getUnboxedRound, unboxRound } from '@/lib/data/rounds';
import { AppError, fail, ok, runAction, type ActionResult } from '@/lib/http/result';

// API-20 언박싱(SEQ-07). 틀린 코드·남의 회차·발송 전 회차는 모두 같은 WRONG_CODE 안내(AC-16-3·4). 횟수 제한 없음(NFR-18)
export async function unbox(input: { roundId: string; code: string }): Promise<ActionResult<UnboxedRound>> {
    return runAction('API-20', async () => {
        await requireMember(typeof input.roundId === 'string' ? `/mypage/rounds/${input.roundId}` : '/mypage');
        const parsed = unboxInputSchema.safeParse(input);
        if (!parsed.success) return fail('WRONG_CODE');

        const opened = await unboxRound(parsed.data.roundId, parsed.data.code);
        if (!opened) return fail('WRONG_CODE');

        // 공개는 언박싱 성공 뒤에만: RLS가 이제서야 round_contents를 돌려준다(NFR-08)
        const round = await getUnboxedRound(parsed.data.roundId);
        if (!round) throw new AppError('UNKNOWN', `[API-20] ${parsed.data.roundId}: 언박싱 후 내용 없음`);
        revalidatePath(`/mypage/rounds/${parsed.data.roundId}`);
        revalidatePath('/mypage/window');
        revalidatePath('/mypage/shelf');
        return ok(round);
    });
}
