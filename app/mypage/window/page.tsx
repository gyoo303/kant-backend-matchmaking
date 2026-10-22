import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { requestCancel, withdrawCancel } from '@/app/mypage/actions';
import { BlindBook } from '@/components/BlindBook';
import { RoundCancelButton } from '@/components/RoundCancelButton';
import { buttonVariants } from '@/components/ui/button';
import { LAMP_BUTTON, NIGHT_OUTLINE_BUTTON, WindowScene } from '@/components/WindowScene';
import { windowCopy, windowNotice } from '@/domains/subscriptions/window-copy';
import { requireMember } from '@/lib/auth/guards';
import { getWindow } from '@/lib/data/rounds';

export const metadata: Metadata = { title: '창가' };

// 창가는 진입할 때마다 지금 상태를 읽는다(ADR-006). 세션을 읽으므로 <Suspense> 안 (CONV-07)
async function WindowContent() {
    await requireMember('/mypage/window');
    const view = await getWindow();
    const copy = windowCopy(view);
    const notice = windowNotice(view);

    return (
        <>
            <div className="mt-6">
                <WindowScene kind={view.kind} copy={copy}>
                    {view.kind === 'empty' && (
                        <Link href="/letters/new" className={`${LAMP_BUTTON} mt-5`}>
                            편지 띄우기
                        </Link>
                    )}
                    {view.kind === 'pending_payment' && (
                        <Link href="/letters/new" className={`${NIGHT_OUTLINE_BUTTON} mt-5`}>
                            편지지로 가기
                        </Link>
                    )}
                    {(view.kind === 'arrived' || view.kind === 'reading') && (
                        <>
                            {/* 취소 요청 중이면 그림은 그대로, 문구 아래에 "취소 요청 중" / 거절이면 안내 (AC-12-7, AC-20-6) */}
                            {notice && <p className="text-night-muted mt-3">{notice}</p>}
                            <RoundCancelButton
                                roundId={view.roundId}
                                requested={view.cancelRequested}
                                action={view.cancelRequested ? withdrawCancel : requestCancel}
                            />
                        </>
                    )}
                </WindowScene>
            </div>

            {/* 발송됨: 실루엣 + 힌트 + 코드 입력. 제목·표지는 없다 (AC-16-1, INV-07). 발송 뒤에는 [취소 요청]이 없다 (AC-20-2) */}
            {view.kind === 'shipped' && (
                <section aria-labelledby="hint-label" className="mt-8 grid items-center gap-8 md:grid-cols-4">
                    <BlindBook className="max-w-50 md:max-w-none" />
                    <div className="md:col-span-3">
                        <p id="hint-label" className="text-muted-foreground text-sm">
                            책방지기의 힌트
                        </p>
                        <p className="font-heading mt-2 max-w-xl text-xl leading-loose">{view.teaser}</p>
                        <p className="mt-3">책이 도착하면 상자 속 카드의 여섯 자리 코드를 입력해 주세요.</p>
                        <Link href={`/mypage/rounds/${view.roundId}`} className={buttonVariants({ className: 'mt-5 h-11 px-5 text-base' })}>
                            코드 입력하기
                        </Link>
                    </div>
                </section>
            )}
        </>
    );
}

// SCR-15 창가 (AC-12-1~7, AC-20-*). 택배사·운송장·배송 단계 숫자는 없다 (AC-12-4)
export default function WindowPage() {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">창가</h1>
            <Suspense fallback={<p className="text-muted-foreground mt-6">창가를 살피는 중이에요.</p>}>
                <WindowContent />
            </Suspense>
            <Link href="/mypage/shelf" className="mt-8 inline-flex min-h-11 items-center rounded-lg underline underline-offset-4">
                지난 회차의 책은 나의 서가에서 볼 수 있어요
            </Link>
        </main>
    );
}
