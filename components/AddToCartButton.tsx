'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';

const ADDED_MESSAGE = '장바구니에 담았어요'; // AC-07-1

// ActionResult(lib/http/result)와 같은 모양 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type AddToCartResult = { ok: true; data: { message?: string } } | { ok: false; error: { message: string } };
type AddToCart = (input: { productId: string; quantity: number }) => Promise<AddToCartResult>;

type Feedback = { tone: 'status' | 'alert'; text: string } | null;

// [장바구니 담기] (SCR-03의 기본 버튼 1개, UX-11). 품절이면 비활성 (AC-03-5)
// 비회원이면 액션이 로그인 화면으로 보내고, 로그인 후 이 상세로 돌아온다 (AC-03-3)
// 담기 액션(app/cart/actions의 addToCart)은 화면이 넘긴다. components가 app을 import하지 않게 하려는 것이다 (AR-CONV §2)
export function AddToCartButton({ productId, soldOut, addToCart }: { productId: string; soldOut: boolean; addToCart: AddToCart }) {
    const [pending, startTransition] = useTransition();
    const [feedback, setFeedback] = useState<Feedback>(null);

    function handleClick() {
        setFeedback(null);
        startTransition(async () => {
            const result = await addToCart({ productId, quantity: 1 });
            if (result.ok) {
                // 재고보다 많이 담으려 했으면 "남은 책은 N권이에요" (AC-07-4)
                setFeedback({ tone: 'status', text: result.data.message ?? ADDED_MESSAGE });
            } else {
                setFeedback({ tone: 'alert', text: result.error.message });
            }
        });
    }

    return (
        <div className="mt-6">
            <Button
                type="button"
                onClick={handleClick}
                disabled={soldOut || pending}
                aria-disabled={soldOut || pending}
                className="h-13 w-full px-6 text-base md:w-auto md:min-w-56"
            >
                {pending ? '담는 중이에요' : '장바구니 담기'}
            </Button>
            <p
                role={feedback?.tone === 'alert' ? 'alert' : 'status'}
                className={`mt-2 min-h-6 text-sm ${feedback?.tone === 'alert' ? 'text-destructive' : ''}`}
            >
                {feedback?.text}
            </p>
        </div>
    );
}
