'use client';

import { Minus, Plus } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { CART_MAX_QUANTITY } from '@/domains/cart/cart';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type Failure = { ok: false; error: { message: string } };
type QuantityResult = { ok: true; data: { quantity: number; message?: string } } | Failure;
type RemoveResult = { ok: true } | Failure;

export interface CartActions {
    updateCartQuantity: (input: { productId: string; quantity: number }) => Promise<QuantityResult>;
    removeCartItem: (input: { productId: string }) => Promise<RemoveResult>;
}

const STEP_BUTTON = 'grid size-11 place-items-center rounded-lg hover:bg-muted disabled:opacity-40';

// 수량(−, 숫자, +, 각 44px) · [빼기] (UX-PLAN-FE screens §SCR-09). 액션은 app/cart/actions를 화면이 넘긴다.
// 바꾼 뒤 액션이 refresh()로 화면을 다시 그려 합계가 바로 바뀐다 (AC-07-2)
export function CartLineControls({
    productId,
    productName,
    quantity,
    stock,
    purchasable,
    notice,
    actions,
}: {
    productId: string;
    productName: string;
    quantity: number;
    stock: number;
    purchasable: boolean;
    notice: string | null; // 서버가 알려 준 재고 안내 (담은 수량 > 재고)
    actions: CartActions;
}) {
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ tone: 'status' | 'alert'; text: string } | null>(null);

    function changeQuantity(next: number) {
        setMessage(null);
        startTransition(async () => {
            const result = await actions.updateCartQuantity({ productId, quantity: next });
            if (!result.ok) setMessage({ tone: 'alert', text: result.error.message });
            // 재고보다 많으면 재고까지만 맞추고 "남은 책은 N권이에요" (AC-07-4)
            else if (result.data.message) setMessage({ tone: 'status', text: result.data.message });
        });
    }

    function remove() {
        setMessage(null);
        startTransition(async () => {
            const result = await actions.removeCartItem({ productId });
            if (!result.ok) setMessage({ tone: 'alert', text: result.error.message });
        });
    }

    const shown = message ?? (notice ? { tone: 'status' as const, text: notice } : null);
    const maxQuantity = Math.min(stock, CART_MAX_QUANTITY);

    return (
        <>
            {shown && (
                <p
                    role={shown.tone === 'alert' ? 'alert' : 'status'}
                    className={`mt-3 rounded-lg px-4 py-3 text-sm ${shown.tone === 'alert' ? 'bg-destructive-soft text-destructive-soft-foreground' : 'bg-accent text-accent-foreground'}`}
                >
                    {shown.text}
                </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {purchasable ? (
                    <div className="border-input flex items-center rounded-lg border" aria-busy={pending}>
                        <button
                            type="button"
                            className={STEP_BUTTON}
                            onClick={() => changeQuantity(quantity - 1)}
                            disabled={pending || quantity <= 1}
                            aria-label={`${productName} 한 권 줄이기`}
                        >
                            <Minus aria-hidden="true" className="size-4" />
                        </button>
                        <span className="min-w-8 text-center" aria-label={`수량 ${quantity}권`}>
                            {quantity}
                        </span>
                        <button
                            type="button"
                            className={STEP_BUTTON}
                            onClick={() => changeQuantity(quantity + 1)}
                            disabled={pending || quantity >= maxQuantity}
                            aria-label={`${productName} 한 권 늘리기`}
                        >
                            <Plus aria-hidden="true" className="size-4" />
                        </button>
                    </div>
                ) : (
                    // 담은 뒤 품절된 책: 수량 조절 없음, 주문에서 빠짐 (AC-07-5)
                    <p className="text-muted-foreground text-sm">주문에서 빠져요</p>
                )}
                <Button type="button" variant="link" onClick={remove} disabled={pending} className="h-11 px-2 text-base">
                    빼기<span className="sr-only">: {productName}</span>
                </Button>
            </div>
        </>
    );
}
