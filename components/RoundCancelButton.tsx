'use client';

import { useState, useTransition } from 'react';
import { NIGHT_OUTLINE_BUTTON } from './WindowScene';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type TransitionResult = { ok: true } | { ok: false; error: { message: string } };
type RoundTransition = (input: { kind: 'round'; id: string }) => Promise<TransitionResult>;

// 창가의 [취소 요청] / [취소 요청 철회] (US-20). 밤 패널 외곽선 버튼, 빨간색 아님 (UX-D-09).
// 성공하면 액션이 창가를 다시 그린다. 지금 상태에서 안 되면 현재 상태를 안내한다 (AC-20-7)
export function RoundCancelButton({ roundId, requested, action }: { roundId: string; requested: boolean; action: RoundTransition }) {
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);

    function handleClick() {
        setMessage(null);
        startTransition(async () => {
            const result = await action({ kind: 'round', id: roundId });
            if (!result.ok) setMessage(result.error.message);
        });
    }

    return (
        <div className="mt-5">
            <button type="button" onClick={handleClick} disabled={pending} className={NIGHT_OUTLINE_BUTTON}>
                {requested ? '취소 요청 철회' : '취소 요청'}
            </button>
            {message && (
                <p role="alert" className="text-night-foreground mt-2 text-sm">
                    {message}
                </p>
            )}
        </div>
    );
}
