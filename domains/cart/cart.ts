import { z } from 'zod';
import { isUuid } from '@/shared/utils/uuid';
import type { CartLine } from './types/cart.types';

// API-05 입력. 수량은 1 이상 정수(줄을 빼려면 removeCartItem)
export const CART_MAX_QUANTITY = 99;

const productIdSchema = z.string().refine(isUuid, '책을 찾을 수 없어요.');

export const cartQuantityInputSchema = z.object({
    productId: productIdSchema,
    quantity: z.coerce
        .number({ error: '수량은 숫자로 입력해 주세요.' })
        .int('수량은 정수로 입력해 주세요.')
        .min(1, '수량은 1권 이상이에요.')
        .max(CART_MAX_QUANTITY, `수량은 ${CART_MAX_QUANTITY}권까지예요.`),
});

export const cartItemInputSchema = z.object({ productId: productIdSchema });

export type QuantityCheck = { ok: true; quantity: number; adjusted: boolean } | { ok: false; reason: 'OUT_OF_STOCK' };

// 재고보다 많이 담으면 재고 수까지만 담는다(AC-07-4, REJ-12). 재고 0이면 담을 수 없다(REJ-05)
export function clampToStock(requested: number, stock: number): QuantityCheck {
    if (stock <= 0) return { ok: false, reason: 'OUT_OF_STOCK' };
    if (requested > stock) return { ok: true, quantity: stock, adjusted: true };
    return { ok: true, quantity: requested, adjusted: false };
}

// "남은 책은 N권이에요" (AC-07-4)
export function remainingStockMessage(stock: number): string {
    return `남은 책은 ${stock}권이에요`;
}

export function isPurchasable(stock: number): boolean {
    return stock > 0;
}

// 주문 대상 합계: 품절 줄은 뺀다(AC-07-5). create_order RPC와 같은 계산(수량 × 가격, 재고>0 줄)
export function cartTotal(lines: readonly CartLine[]): number {
    return lines.filter((line) => line.purchasable).reduce((sum, line) => sum + line.product.price * line.quantity, 0);
}
