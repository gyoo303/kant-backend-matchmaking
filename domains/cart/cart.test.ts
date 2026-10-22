import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { products } from '@/data/products';
import { cartQuantityInputSchema, cartTotal, clampToStock, isPurchasable, remainingStockMessage } from './cart';
import type { CartLine } from './types/cart.types';

const inStock = products.find((p) => p.stock >= 2);
const soldOut = products.find((p) => p.stock === 0);

describe('clampToStock (domains/cart)', () => {
    it('AC-07-4: 재고 2권에 3권을 넣으면 2로 맞춰지고 안내 문구가 나온다', () => {
        assert.deepEqual(clampToStock(3, 2), { ok: true, quantity: 2, adjusted: true });
        assert.equal(remainingStockMessage(2), '남은 책은 2권이에요');
    });

    it('AC-07-3: 재고 안의 수량은 그대로', () => {
        assert.deepEqual(clampToStock(2, 5), { ok: true, quantity: 2, adjusted: false });
    });

    it('AC-03-5: 재고 0이면 담을 수 없다', () => {
        assert.deepEqual(clampToStock(1, 0), { ok: false, reason: 'OUT_OF_STOCK' });
    });
});

describe('cartTotal', () => {
    it('AC-07-5: 품절 줄은 합계·주문 대상에서 빠진다', () => {
        assert.ok(inStock && soldOut, 'Mock에 재고 있는 책과 품절 책이 있어야 한다');
        const lines: CartLine[] = [
            { product: inStock, quantity: 2, purchasable: isPurchasable(inStock.stock) },
            { product: soldOut, quantity: 1, purchasable: isPurchasable(soldOut.stock) },
        ];
        assert.equal(lines[1].purchasable, false);
        assert.equal(cartTotal(lines), inStock.price * 2);
    });

    it('AC-07-2: 수량을 2에서 3으로 바꾸면 합계가 바뀐다', () => {
        assert.ok(inStock);
        const line = (quantity: number): CartLine[] => [{ product: inStock, quantity, purchasable: true }];
        assert.equal(cartTotal(line(3)) - cartTotal(line(2)), inStock.price);
    });
});

describe('cartQuantityInputSchema (API-05)', () => {
    it('수량 0·소수·uuid 아닌 id는 거부', () => {
        assert.equal(cartQuantityInputSchema.safeParse({ productId: products[0].id, quantity: 0 }).success, false);
        assert.equal(cartQuantityInputSchema.safeParse({ productId: products[0].id, quantity: 1.5 }).success, false);
        assert.equal(cartQuantityInputSchema.safeParse({ productId: 'abc', quantity: 1 }).success, false);
    });

    it('폼 문자열 수량은 숫자로 바뀐다', () => {
        const result = cartQuantityInputSchema.safeParse({ productId: products[0].id, quantity: '3' });
        assert.equal(result.success && result.data.quantity, 3);
    });
});
