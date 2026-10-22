'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MEMO_MAX } from '@/domains/subscriptions/subscription.schema';
import { formatDate } from './format-date';
import { INPUT_CLASS } from './FormField';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type MemoResult = { ok: true } | { ok: false; error: { message: string; fieldErrors?: Record<string, string> } };

export interface ShelfMemoActions {
    saveMemo: (input: { roundId: string; body: string }) => Promise<MemoResult>;
    deleteMemo: (input: { roundId: string }) => Promise<MemoResult>;
}

// 책 아래 한 줄 메모 (SCR-17, AC-17-1·2·4): 저장된 메모 + 날짜 + [수정]·[삭제] / 쓰는 중(N / 100자 + [저장]) / 메모 없음.
// 별점·공개·공유 없음 (AC-17-3). 저장·삭제 뒤 액션이 서가를 다시 그린다
export function ShelfMemo({
    roundId,
    bookName,
    memo,
    actions,
}: {
    roundId: string;
    bookName: string;
    memo: { body: string; updatedAt: string } | null;
    actions: ShelfMemoActions;
}) {
    const [editing, setEditing] = useState(false);
    const [body, setBody] = useState(memo?.body ?? '');
    const [message, setMessage] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const length = body.trim().length;
    const inputId = `memo-${roundId}`;

    function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (length === 0 || length > MEMO_MAX) return;
        setMessage(null);
        startTransition(async () => {
            const result = await actions.saveMemo({ roundId, body });
            if (result.ok) setEditing(false);
            else setMessage(result.error.fieldErrors?.body ?? result.error.message);
        });
    }

    function remove() {
        setMessage(null);
        startTransition(async () => {
            const result = await actions.deleteMemo({ roundId });
            if (result.ok) setBody('');
            else setMessage(result.error.message);
        });
    }

    if (editing) {
        return (
            <form onSubmit={save} noValidate className="mt-2">
                <label htmlFor={inputId} className="text-muted-foreground text-sm">
                    한 줄 메모
                </label>
                <Input
                    id={inputId}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={MEMO_MAX + 20}
                    aria-describedby={`${inputId}-count`}
                    aria-invalid={length > MEMO_MAX ? true : undefined}
                    className={`${INPUT_CLASS} mt-1`}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                    <span id={`${inputId}-count`} className={`text-sm ${length > MEMO_MAX ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {length} / {MEMO_MAX}자
                    </span>
                    <Button type="submit" size="sm" disabled={pending || length === 0 || length > MEMO_MAX} className="h-11 px-4 text-base">
                        저장
                    </Button>
                </div>
                {message && (
                    <p role="alert" className="text-destructive mt-1 text-sm">
                        {message}
                    </p>
                )}
            </form>
        );
    }

    if (!memo) {
        return (
            <Button type="button" variant="link" onClick={() => setEditing(true)} className="mt-1 h-11 px-0 text-base">
                한 줄 메모 남기기<span className="sr-only">: {bookName}</span>
            </Button>
        );
    }

    return (
        <div className="mt-2">
            <div className="bg-card rounded-lg border p-3">
                <p className="leading-relaxed">{memo.body}</p>
                <p className="text-muted-foreground mt-1 text-sm">{formatDate(memo.updatedAt)}</p>
            </div>
            <div className="mt-1 flex gap-2">
                <Button type="button" variant="link" onClick={() => setEditing(true)} disabled={pending} className="h-11 px-2 text-base">
                    수정<span className="sr-only">: {bookName} 메모</span>
                </Button>
                <Button type="button" variant="link" onClick={remove} disabled={pending} className="h-11 px-2 text-base">
                    삭제<span className="sr-only">: {bookName} 메모</span>
                </Button>
            </div>
            {message && (
                <p role="alert" className="text-destructive text-sm">
                    {message}
                </p>
            )}
        </div>
    );
}
