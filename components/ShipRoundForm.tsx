'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TEASER_MAX } from '@/domains/subscriptions/subscription.schema';
import { FormField, INPUT_CLASS } from './FormField';
import { UnboxingCode } from './UnboxingCode';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type ShipResult = { ok: true; data: { code: string } } | { ok: false; error: { message: string; fieldErrors?: Record<string, string> } };

// 서재 작업 ③ 힌트 쓰고 발송 (SCR-19, AC-15-1~5). 빠진 항목이 있으면 [발송]이 비활성이고 무엇이 빠졌는지 보인다 (AC-15-3).
// 취소 요청 중이면 막힌다 (AC-20-3). 발송 액션(app/admin/desk/actions의 shipRound)은 화면이 넘긴다
export function ShipRoundForm({
    roundId,
    hasBook,
    hasReply,
    cancelRequested,
    shipRound,
}: {
    roundId: string;
    hasBook: boolean;
    hasReply: boolean;
    cancelRequested: boolean;
    shipRound: (input: { roundId: string; teaser: string }) => Promise<ShipResult>;
}) {
    const [teaser, setTeaser] = useState('');
    const [code, setCode] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const teaserLength = teaser.trim().length;
    const missing = [!hasBook && '책', !hasReply && '답장', teaserLength === 0 && '힌트 문장'].filter(Boolean);
    const blocked = missing.length > 0 || teaserLength > TEASER_MAX || cancelRequested;

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (blocked) return;
        setMessage(null);
        startTransition(async () => {
            // 두 번 눌러도 코드 1개·재고 1회 (AC-15-4, 서버 멱등). 처리 중에는 버튼을 막는다
            const result = await shipRound({ roundId, teaser });
            if (result.ok) setCode(result.data.code);
            else setMessage(result.error.fieldErrors?.teaser ?? result.error.message);
        });
    }

    if (code) return <UnboxingCode code={code} />;

    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <FormField id="desk-teaser" label="힌트 문장 (손님에게 책 대신 보여요)">
                <Input
                    id="desk-teaser"
                    value={teaser}
                    onChange={(event) => setTeaser(event.target.value)}
                    maxLength={TEASER_MAX + 20}
                    aria-describedby="desk-teaser-count"
                    className={`${INPUT_CLASS} font-heading`}
                />
                <p id="desk-teaser-count" className={`text-sm ${teaserLength > TEASER_MAX ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {teaserLength} / {TEASER_MAX}자
                </p>
            </FormField>
            {cancelRequested ? (
                <p className="bg-destructive-soft text-destructive-soft-foreground rounded-lg px-4 py-3">취소 요청이 있는 편지예요. 환불하거나 거절해 주세요.</p>
            ) : (
                missing.length > 0 && <p className="bg-accent text-accent-foreground rounded-lg px-4 py-3">아직 빠진 것: {missing.join(', ')}</p>
            )}
            <div>
                <Button type="submit" disabled={blocked || pending} className="h-13 px-12 text-base">
                    {pending ? '발송하는 중이에요' : '발송'}
                </Button>
                <p role="alert" className="text-destructive mt-2 min-h-6 text-sm">
                    {message}
                </p>
            </div>
        </form>
    );
}
