'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { OUTLINE_BUTTON } from './button-styles';
import { RetryPaymentButton, type RetryTarget } from './RetryPaymentButton';
import type { TossPaymentRequest } from './toss-payment';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type Failure = { ok: false; error: { message: string } };

// 결제 대기 편지: [다시 결제하기]·[편지 거두기] (AC-11-6·8). 거두면 액션이 화면을 다시 그려 새 편지지가 된다
export function PendingRoundActions({
    roundId,
    retryPayment,
    cancelPending,
}: {
    roundId: string;
    retryPayment: (target: RetryTarget) => Promise<{ ok: true; data: TossPaymentRequest } | Failure>;
    cancelPending: (input: { kind: 'round'; id: string }) => Promise<{ ok: true } | Failure>;
}) {
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);

    function withdrawLetter() {
        setMessage(null);
        startTransition(async () => {
            const result = await cancelPending({ kind: 'round', id: roundId });
            if (!result.ok) setMessage(result.error.message);
        });
    }

    return (
        <div className="mt-6">
            <div className="flex flex-wrap items-start gap-3">
                <RetryPaymentButton target={{ kind: 'round', roundId }} retryPayment={retryPayment} />
                <Button type="button" variant="ghost" onClick={withdrawLetter} disabled={pending} className={OUTLINE_BUTTON}>
                    편지 거두기
                </Button>
            </div>
            {message && (
                <p role="alert" className="text-destructive mt-2 text-sm">
                    {message}
                </p>
            )}
        </div>
    );
}
