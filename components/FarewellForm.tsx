'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FAREWELL_MAX } from '@/domains/subscriptions/subscription.schema';
import { TEXTAREA_CLASS } from './FormField';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type EndResult = { ok: true } | { ok: false; error: { message: string; fieldErrors?: Record<string, string> } };

const THANKS = '그동안 고마웠어요'; // US-18 정상 흐름 3

// 작별 안부(0~1,000자, 비워도 됨) + [구독을 마무리합니다] (SCR-18). 누르면 바로 마무리 — 확인 팝업·혜택 경고 없음 (AC-18-2, INV-13).
// 기본 버튼 색, 빨간색·경고 아이콘 없음 (UX-13, UX-D-09). 액션(app/mypage/farewell/actions의 endSubscription)은 화면이 넘긴다
export function FarewellForm({ endSubscription }: { endSubscription: (input: { note?: string }) => Promise<EndResult> }) {
    const [note, setNote] = useState('');
    const [done, setDone] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const length = note.trim().length;
    const tooLong = length > FAREWELL_MAX; // AC-18-5

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (tooLong) return;
        setMessage(null);
        startTransition(async () => {
            const result = await endSubscription({ note });
            if (result.ok) setDone(true);
            else setMessage(result.error.fieldErrors?.note ?? result.error.message);
        });
    }

    if (done) {
        return (
            <p role="status" className="font-heading mt-8 text-2xl">
                {THANKS}
            </p>
        );
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="mt-8">
            <label htmlFor="farewell-note">책방지기에게 남기는 작별 안부 (비워 두어도 괜찮아요)</label>
            <textarea
                id="farewell-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={FAREWELL_MAX + 200}
                aria-describedby="farewell-count"
                aria-invalid={tooLong ? true : undefined}
                className={`${TEXTAREA_CLASS} mt-1.5 min-h-40`}
            />
            <p id="farewell-count" className={`mt-1 text-right text-sm ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}>
                {length.toLocaleString('ko-KR')} / {FAREWELL_MAX.toLocaleString('ko-KR')}자
            </p>
            <Button type="submit" disabled={tooLong || pending} className="mt-4 h-13 px-6 text-base">
                구독을 마무리합니다
            </Button>
            <p role="alert" className="text-destructive mt-3 min-h-6 text-sm">
                {message}
            </p>
        </form>
    );
}
