'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { UnboxedRound } from '@/domains/subscriptions/types/round.types';
import { BlindBook } from './BlindBook';
import { UnboxedView } from './UnboxedView';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type UnboxResult = { ok: true; data: UnboxedRound } | { ok: false; error: { message: string } };

const CODE_PATTERN = /^\d{6}$/; // AC-16-5
const HIDE_MS = 800; // 실루엣이 흐려지는 시간 (globals.css --animate-unbox-hide), 공개까지 합쳐 ≤ 2s (NFR-10)

// 언박싱 (SCR-16): 실루엣 + 힌트 + 코드 입력 한 칸(UX-12, UX-D-07) + [열기]. 맞으면 공개 전환 뒤 책·답장·엽서 (AC-16-2).
// 틀리면 같은 안내만, 횟수 제한 없음 (AC-16-3·4). 동작 줄이기면 바로 공개 (AC-16-7). 액션은 화면이 넘긴다
export function UnboxForm({ roundId, teaser, unbox }: { roundId: string; teaser: string; unbox: (input: { roundId: string; code: string }) => Promise<UnboxResult> }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [hiding, setHiding] = useState(false);
    const [opened, setOpened] = useState<UnboxedRound | null>(null);
    const [pending, startTransition] = useTransition();

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!CODE_PATTERN.test(code)) return;
        setError(null);
        startTransition(async () => {
            const result = await unbox({ roundId, code });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                setHiding(true);
                await new Promise((resolve) => setTimeout(resolve, HIDE_MS));
            }
            setOpened(result.data);
        });
    }

    if (opened) {
        return (
            <div role="status" aria-label="상자가 열렸어요">
                <UnboxedView round={opened} reveal />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-md text-center">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">상자를 열어 볼까요</h1>
            <div className={hiding ? 'motion-safe:animate-unbox-hide' : ''}>
                <BlindBook className="mt-6" />
            </div>
            <p className="font-heading mt-6 text-xl leading-loose">{teaser}</p>
            <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col items-center gap-3">
                <label htmlFor="unbox-code" className="text-sm">
                    상자 속 카드의 여섯 자리 코드
                </label>
                <input
                    id="unbox-code"
                    name="code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.trim())}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'unbox-error unbox-help' : 'unbox-help'}
                    className="bg-card border-input aria-invalid:border-destructive font-heading h-16 w-full max-w-72 rounded-lg border text-center text-3xl tracking-widest"
                />
                {error && (
                    <p id="unbox-error" role="alert" className="text-destructive text-sm">
                        {error}
                    </p>
                )}
                <Button type="submit" disabled={!CODE_PATTERN.test(code) || pending} className="h-13 w-full max-w-52 text-base">
                    {pending ? '여는 중이에요' : '열기'}
                </Button>
                <p id="unbox-help" className="text-muted-foreground text-sm">
                    숫자 여섯 자리를 모두 넣으면 열 수 있어요
                </p>
            </form>
        </div>
    );
}
