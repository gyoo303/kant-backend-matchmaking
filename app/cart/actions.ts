'use server';

import { refresh, revalidatePath } from 'next/cache';
import { cartItemInputSchema, cartQuantityInputSchema, clampToStock, remainingStockMessage } from '@/domains/cart/cart';
import { requireMember } from '@/lib/auth/guards';
import { deleteCartItem, getStockAndCartQuantity, setCartQuantity } from '@/lib/data/cart';
import { fail, ok, runAction, validationFail, type ActionResult } from '@/lib/http/result';
import { isUuid } from '@/shared/utils/uuid';

export type CartQuantityResult = { quantity: number; adjusted?: true; message?: string };

const OUT_OF_STOCK_MESSAGE = '품절된 책이라 담을 수 없어요.';

// 비회원은 로그인 후 보던 책 상세로 돌아온다(AC-03-3)
function loginReturnPath(input: { productId?: unknown }): string {
    return isUuid(input.productId) ? `/products/${input.productId}` : '/cart';
}

async function applyQuantity(
    memberId: string,
    productId: string,
    requested: (inCart: number) => number,
): Promise<ActionResult<CartQuantityResult>> {
    const current = await getStockAndCartQuantity(productId);
    if (!current) return fail('NOT_FOUND', '책을 찾을 수 없어요.');

    const checked = clampToStock(requested(current.inCart), current.stock);
    if (!checked.ok) return fail('OUT_OF_STOCK', OUT_OF_STOCK_MESSAGE);

    await setCartQuantity(memberId, productId, checked.quantity);
    revalidatePath('/cart');
    refresh();
    return ok(
        checked.adjusted
            ? { quantity: checked.quantity, adjusted: true, message: remainingStockMessage(current.stock) }
            : { quantity: checked.quantity },
    );
}

// API-05 담기: 이미 담은 책이면 수량을 더한다(AC-07-1·3), 재고를 넘으면 재고까지만(AC-07-4)
export async function addToCart(input: { productId: string; quantity: number }): Promise<ActionResult<CartQuantityResult>> {
    return runAction('API-05', async () => {
        const member = await requireMember(loginReturnPath(input));
        const parsed = cartQuantityInputSchema.safeParse(input);
        if (!parsed.success) return validationFail(parsed.error);
        const { productId, quantity } = parsed.data;
        return applyQuantity(member.id, productId, (inCart) => inCart + quantity);
    });
}

// API-05 수량 바꾸기(AC-07-2·4)
export async function updateCartQuantity(input: {
    productId: string;
    quantity: number;
}): Promise<ActionResult<CartQuantityResult>> {
    return runAction('API-05', async () => {
        const member = await requireMember('/cart');
        const parsed = cartQuantityInputSchema.safeParse(input);
        if (!parsed.success) return validationFail(parsed.error);
        const { productId, quantity } = parsed.data;
        return applyQuantity(member.id, productId, () => quantity);
    });
}

// API-05 빼기. 이미 없는 줄이어도 성공(멱등)
export async function removeCartItem(input: { productId: string }): Promise<ActionResult<null>> {
    return runAction('API-05', async () => {
        await requireMember('/cart');
        const parsed = cartItemInputSchema.safeParse(input);
        if (!parsed.success) return validationFail(parsed.error);
        await deleteCartItem(parsed.data.productId);
        revalidatePath('/cart');
        refresh();
        return ok(null);
    });
}
