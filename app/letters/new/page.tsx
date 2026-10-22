import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { retryPayment } from '@/app/checkout/actions';
import { postLetter } from '@/app/letters/new/actions';
import { cancelPending } from '@/app/mypage/actions';
import { LetterForm } from '@/components/LetterForm';
import { LetterPaper } from '@/components/LetterPaper';
import { PendingRoundActions } from '@/components/PendingRoundActions';
import { buttonVariants } from '@/components/ui/button';
import { ROUND_IN_PROGRESS_COPY, WINDOW_COPY } from '@/domains/subscriptions/window-copy';
import { requireMember } from '@/lib/auth/guards';
import { getShippingAddress } from '@/lib/data/cart';
import { getLetterPageState } from '@/lib/data/rounds';

export const metadata: Metadata = { title: '편지 띄우기' };

// 회차 금액 (D-003). 화면 표시용이고, 결제 금액은 DB(create_payment)가 정한다 (NFR-19)
const ROUND_PRICE = 30000;

// 세션을 읽으므로 <Suspense> 안 (CONV-07). 비회원은 로그인 후 돌아온다 (AC-05-6)
async function LetterContent() {
    await requireMember('/letters/new');
    const [state, address] = await Promise.all([getLetterPageState(), getShippingAddress()]);

    // 결제 확정된 진행 중 회차: 편지지 대신 안내 + 창가 링크 (AC-11-4, INV-12)
    if (state.kind === 'in_progress') {
        return (
            <div className="bg-card mt-8 rounded-lg border p-6">
                <p className="font-heading text-xl">{ROUND_IN_PROGRESS_COPY}</p>
                <Link href="/mypage/window" className={buttonVariants({ className: 'mt-5 h-11 px-5 text-base' })}>
                    창가로 가기
                </Link>
            </div>
        );
    }

    // 결제 대기 회차: 편지 내용 보존 + 다시 결제·거두기 (AC-11-6·8). 봉투는 다시 열린 편지지 모양
    if (state.kind === 'pending_payment') {
        return (
            <div className="mt-8 max-w-3xl">
                <LetterPaper>{state.body}</LetterPaper>
                <p role="status" className="bg-accent text-accent-foreground mt-6 rounded-lg px-4 py-3">
                    {WINDOW_COPY.pending_payment}
                </p>
                <PendingRoundActions roundId={state.roundId} retryPayment={retryPayment} cancelPending={cancelPending} />
            </div>
        );
    }

    return <LetterForm defaults={address} roundPrice={ROUND_PRICE} postLetter={postLetter} />;
}

// SCR-14 편지지 (AC-11-1~10)
export default function LetterPage() {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">편지 띄우기</h1>
            <p className="text-muted-foreground mt-3 text-lg leading-relaxed">
                설문 대신 편지 한 장이면 돼요. 요즘 마음 날씨와 읽고 싶은 책의 결을 들려주세요.
            </p>
            <Suspense fallback={<p className="text-muted-foreground mt-8">편지지를 펼치는 중이에요.</p>}>
                <LetterContent />
            </Suspense>
        </main>
    );
}
