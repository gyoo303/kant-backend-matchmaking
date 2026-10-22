'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { DESTRUCTIVE_OUTLINE_BUTTON, OUTLINE_BUTTON } from './button-styles';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type ActionOutcome = { ok: true } | { ok: false; error: { message: string } };
type CancelInput = { kind: 'order' | 'round'; id: string };

export interface KeeperOrderActionSet {
    shipOrder: (input: CancelInput) => Promise<ActionOutcome>;
    refund: (input: CancelInput) => Promise<ActionOutcome>;
    rejectCancel: (input: CancelInput) => Promise<ActionOutcome>;
}

export const CANCEL_REQUEST_HINT = '취소 요청이 있는 주문이에요. 환불하거나 거절해 주세요'; // REJ-22, AC-10-4

// 주문 한 건의 [발송 완료] / [환불]·[취소 거절]. 처리하는 동안 상자의 버튼을 모두 막아 두 번 눌리지 않게 한다 (AC-10-5)
export function KeeperOrderActions({ orderId, cancelRequested, actions }: { orderId: string; cancelRequested: boolean; actions: KeeperOrderActionSet }) {
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);
    const target = { kind: 'order' as const, id: orderId };

    function run(action: (input: CancelInput) => Promise<ActionOutcome>) {
        setMessage(null);
        startTransition(async () => {
            const result = await action(target);
            // 환불 실패면 상태 그대로 "환불하지 못했어요…" (AC-10-3)
            if (!result.ok) setMessage(result.error.message);
        });
    }

    return (
        <div className="mt-4">
            <div className="flex flex-wrap gap-2">
                {cancelRequested && (
                    <>
                        <Button type="button" variant="ghost" onClick={() => run(actions.refund)} disabled={pending} className={DESTRUCTIVE_OUTLINE_BUTTON}>
                            환불
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => run(actions.rejectCancel)} disabled={pending} className={OUTLINE_BUTTON}>
                            취소 거절
                        </Button>
                    </>
                )}
                {/* 취소 요청 주문은 발송을 막는다 (AC-10-4) */}
                <Button
                    type="button"
                    variant={cancelRequested ? 'secondary' : 'default'}
                    onClick={() => run(actions.shipOrder)}
                    disabled={pending || cancelRequested}
                    aria-describedby={cancelRequested ? `ship-hint-${orderId}` : undefined}
                    className="h-11 px-5 text-base"
                >
                    발송 완료
                </Button>
            </div>
            {cancelRequested && (
                <p id={`ship-hint-${orderId}`} className="text-muted-foreground mt-2 text-sm">
                    {CANCEL_REQUEST_HINT}
                </p>
            )}
            <p role="alert" className="text-destructive mt-2 min-h-0 text-sm empty:hidden">
                {message}
            </p>
        </div>
    );
}
