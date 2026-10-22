'use server';

import { revalidatePath } from 'next/cache';
import { randomInt } from '@/lib/crypto';
import { checkPostcardFile, roundContentsInputSchema, roundRefSchema, shipRoundInputSchema } from '@/domains/subscriptions/subscription.schema';
import { CODE_COLLISION_RETRIES, generateUnboxingCode } from '@/domains/subscriptions/unboxing-code';
import { authorizeKeeper } from '@/lib/auth/guards';
import { getProductStock, openRound as openRoundRpc, saveRoundContents as saveRoundContentsRow, shipRound as shipRoundRpc, uploadPostcard } from '@/lib/data/rounds';
import { AppError, fail, fieldErrorsOf, ok, runAction, type ActionResult } from '@/lib/http/result';

const NOT_FOUND_MESSAGE = '편지를 찾을 수 없어요.';
const OUT_OF_STOCK_PICK_OTHER = '고른 책이 품절이에요. 다른 책을 골라 주세요.'; // AC-14-2, AC-15-5

function revalidateDesk(): void {
    revalidatePath('/admin');
    revalidatePath('/admin/desk');
}

function textField(formData: FormData, name: string): string | undefined {
    const value = formData.get(name);
    return typeof value === 'string' ? value : undefined;
}

// API-17 편지 열람(SEQ-05): 화면 진입 때 서버에서 부른다. arrived → reading, 그 밖에는 변화 없음(AC-13-2·3)
export async function openRound(roundId: string): Promise<ActionResult<null>> {
    return runAction('API-17', async () => {
        const keeper = await authorizeKeeper();
        if (!keeper.ok) return keeper;
        const parsed = roundRefSchema.safeParse({ roundId });
        if (!parsed.success) return fail('NOT_FOUND', NOT_FOUND_MESSAGE);
        await openRoundRpc(parsed.data.roundId);
        return ok(null);
    });
}

// API-18 매칭·답장·엽서 저장(AC-14-1). 폼 필드: roundId, productId, replyLetter, postcard(파일, 선택)
export async function saveRoundContents(formData: FormData): Promise<ActionResult<null>> {
    return runAction(
        'API-18',
        async () => {
            const keeper = await authorizeKeeper();
            if (!keeper.ok) return keeper;

            const parsed = roundContentsInputSchema.safeParse({
                roundId: textField(formData, 'roundId'),
                productId: textField(formData, 'productId'),
                replyLetter: textField(formData, 'replyLetter'),
            });
            const postcard = checkPostcardFile(formData.get('postcard'));
            if (!parsed.success || !postcard.ok) {
                return fail('VALIDATION', undefined, {
                    ...(parsed.success ? {} : fieldErrorsOf(parsed.error)),
                    ...(postcard.ok ? {} : { postcard: postcard.message }),
                });
            }

            // 품절 책은 고를 수 없다(AC-14-2). 서버에서 재고를 다시 본다
            const stock = await getProductStock(parsed.data.productId);
            if (stock === null) return fail('VALIDATION', undefined, { productId: '책을 찾을 수 없어요.' });
            if (stock <= 0) return fail('OUT_OF_STOCK', OUT_OF_STOCK_PICK_OTHER);

            const postcardPath = postcard.file ? await uploadPostcard(parsed.data.roundId, postcard.file) : null;
            await saveRoundContentsRow(parsed.data.roundId, {
                productId: parsed.data.productId,
                replyLetter: parsed.data.replyLetter,
                postcardPath,
            });
            revalidateDesk();
            return ok(null);
        },
        { INVALID_STATE: '발송했거나 취소된 편지는 고칠 수 없어요.' },
    );
}

// API-19 발송·코드 발급(SEQ-06). 두 번 눌러도 코드 1개·재고 1회(AC-15-4). 겹치는 코드는 새 코드로 최대 3회 다시 시도
export async function shipRound(input: { roundId: string; teaser: string }): Promise<ActionResult<{ code: string }>> {
    return runAction(
        'API-19',
        async () => {
            const keeper = await authorizeKeeper();
            if (!keeper.ok) return keeper;
            const parsed = shipRoundInputSchema.safeParse(input);
            if (!parsed.success) return fail('MISSING_SHIPMENT_FIELDS', undefined, fieldErrorsOf(parsed.error));

            for (let attempt = 0; attempt < CODE_COLLISION_RETRIES; attempt += 1) {
                const result = await shipRoundRpc(parsed.data.roundId, generateUnboxingCode(randomInt), parsed.data.teaser);
                if (result !== 'collision') {
                    revalidateDesk();
                    revalidatePath('/mypage/window');
                    return ok(result);
                }
            }
            throw new AppError('UNKNOWN', `[API-19] CODE_COLLISION ${CODE_COLLISION_RETRIES}회`);
        },
        {
            NOT_FOUND: NOT_FOUND_MESSAGE,
            OUT_OF_STOCK: OUT_OF_STOCK_PICK_OTHER,
            CANCEL_REQUESTED: '취소 요청이 있는 편지예요. 환불하거나 거절해 주세요.',
            INVALID_STATE: '지금은 발송할 수 없는 편지예요.',
        },
    );
}
