'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { OUTLINE_BUTTON } from './button-styles';
import { RetryPaymentButton, type RetryTarget } from './RetryPaymentButton';
import type { TossPaymentRequest } from './toss-payment';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type Failure = { ok: false; error: { message: string } };
type TransitionResult = { ok: true } | Failure;
type CancelInput = { kind: 'order' | 'round'; id: string };

export interface MemberOrderActionSet {
    requestCancel: (input: CancelInput) => Promise<TransitionResult>;
    withdrawCancel: (input: CancelInput) => Promise<TransitionResult>;
    cancelPending: (input: CancelInput) => Promise<TransitionResult>;
    retryPayment: (target: RetryTarget) => Promise<{ ok: true; data: TossPaymentRequest } | Failure>;
}

// mode: 주문 상태에서 할 수 있는 행동. 버튼은 모두 외곽선 (회원 화면 빨간 버튼 없음, UX-D-09)
// 성공하면 액션이 화면 경로를 revalidate해 상태 표시가 바뀐다. 지금 상태에서 안 되면 현재 상태를 안내한다 (AC-09-7)
export function MemberOrderActions({
    orderId,
    mode,
    actions,
}: {
    orderId: string;
    mode: 'pending_payment' | 'paid' | 'cancel_requested';
    actions: MemberOrderActionSet;
}) {
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);
    const target = { kind: 'order' as const, id: orderId };

    function run(action: (input: CancelInput) => Promise<TransitionResult>) {
        setMessage(null);
        startTransition(async () => {
            const result = await action(target);
            if (!result.ok) setMessage(result.error.message);
        });
    }

    return (
        <div className="mt-4">
            <div className="flex flex-wrap items-start gap-2">
                {mode === 'paid' && (
                    <Button type="button" variant="ghost" onClick={() => run(actions.requestCancel)} disabled={pending} className={OUTLINE_BUTTON}>
                        취소 요청
                    </Button>
                )}
                {mode === 'cancel_requested' && (
                    <Button type="button" variant="ghost" onClick={() => run(actions.withdrawCancel)} disabled={pending} className={OUTLINE_BUTTON}>
                        취소 요청 철회
                    </Button>
                )}
                {mode === 'pending_payment' && (
                    <>
                        <RetryPaymentButton target={{ kind: 'order', orderId }} retryPayment={actions.retryPayment} variant="outline" />
                        {/* 결제 대기 주문 취소 (D-037, API-12) */}
                        <Button type="button" variant="link" onClick={() => run(actions.cancelPending)} disabled={pending} className="h-11 px-2 text-base">
                            주문 취소
                        </Button>
                    </>
                )}
            </div>
            {message && (
                <p role="alert" className="text-destructive mt-2 text-sm">
                    {message}
                </p>
            )}
        </div>
    );
}
