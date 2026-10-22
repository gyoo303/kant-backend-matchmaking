'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { OUTLINE_BUTTON } from './button-styles';
import { openTossPayment, type TossPaymentRequest } from './toss-payment';

// domains/payments/types/payment.types.ts의 PaymentTarget과 같은 모양
export type RetryTarget = { kind: 'order'; orderId: string } | { kind: 'round'; roundId: string };
// ActionResult(lib/http/result) 중 화면이 쓰는 부분
type RetryResult = { ok: true; data: TossPaymentRequest } | { ok: false; error: { message: string } };

// [다시 결제하기] (AC-08-4, AC-11-8): 결제 대기 주문·회차에 새 결제를 만들고 결제창을 연다.
// 액션(app/checkout/actions의 retryPayment)은 화면이 넘긴다
export function RetryPaymentButton({
    target,
    retryPayment,
    variant = 'default',
    className = '',
}: {
    target: RetryTarget;
    retryPayment: (target: RetryTarget) => Promise<RetryResult>;
    variant?: 'default' | 'outline';
    className?: string;
}) {
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);

    function handleClick() {
        setMessage(null);
        startTransition(async () => {
            const result = await retryPayment(target);
            if (!result.ok) {
                setMessage(result.error.message);
                return;
            }
            const problem = await openTossPayment(result.data);
            if (problem) setMessage(problem);
        });
    }

    return (
        <div className={className}>
            <Button
                type="button"
                variant={variant === 'outline' ? 'ghost' : 'default'}
                onClick={handleClick}
                disabled={pending}
                className={variant === 'outline' ? OUTLINE_BUTTON : 'h-11 px-5 text-base'}
            >
                {pending ? '결제창을 여는 중이에요' : '다시 결제하기'}
            </Button>
            {message && (
                <p role="alert" className="text-destructive mt-2 text-sm">
                    {message}
                </p>
            )}
        </div>
    );
}
