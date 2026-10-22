import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { endSubscription } from '@/app/mypage/farewell/actions';
import { FarewellForm } from '@/components/FarewellForm';
import { LetterPaper } from '@/components/LetterPaper';
import { buttonVariants } from '@/components/ui/button';
import { requireMember } from '@/lib/auth/guards';
import { getSubscriptionState } from '@/lib/data/rounds';

export const metadata: Metadata = { title: '구독 마무리하기' };

// 마지막 인사 편지 (US-18 문구 그대로, AC-18-1). 줄바꿈 위치는 UX-D-06, 서명 줄은 오른쪽 정렬 (UX-13)
const FAREWELL_LINES = [
    '우분투북스와 함께 숨을 고르셨던 시간들이',
    '좋은 쉼이 되었기를 바랍니다.',
    '계절이 바뀌어 책 한 줄의 온기가 필요해지면,',
    '언제든 다시 찾아와 주세요.',
];
const FAREWELL_SIGNATURE = 'ㅡ어은동에서, 우분투북스 책방지기 드림';

// 세션을 읽으므로 <Suspense> 안 (CONV-07)
async function FarewellContent() {
    await requireMember('/mypage/farewell');
    const subscription = await getSubscriptionState();

    // 구독이 없거나 이미 마무리됨: 마이페이지에도 메뉴가 없다 (AC-18-7)
    if (!subscription.active) {
        return (
            <div className="bg-card mt-8 rounded-lg border p-6">
                <p className="font-heading text-xl">진행 중인 구독이 없어요</p>
                <Link href="/mypage" className={buttonVariants({ className: 'mt-5 h-11 px-5 text-base' })}>
                    마이페이지로 가기
                </Link>
            </div>
        );
    }

    return (
        <>
            <LetterPaper className="mt-8">
                {FAREWELL_LINES.map((line) => (
                    <span key={line} className="block">
                        {line}
                    </span>
                ))}
                <span className="mt-4 block text-right">{FAREWELL_SIGNATURE}</span>
            </LetterPaper>
            {/* 결제 확정된 진행 중 회차는 끝까지 발송·언박싱 (US-18 정상 흐름 4, AC-18-3) */}
            {subscription.roundInProgress && (
                <p className="bg-secondary mt-6 rounded-lg px-4 py-3">책방지기가 준비하고 있는 책은 마무리한 뒤에도 끝까지 보내드려요.</p>
            )}
            <FarewellForm endSubscription={endSubscription} />
        </>
    );
}

// SCR-18 구독 마무리 (AC-18-1~8)
export default function FarewellPage() {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-10">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">구독 마무리하기</h1>
            <Suspense fallback={<p className="text-muted-foreground mt-8">편지를 꺼내 오는 중이에요.</p>}>
                <FarewellContent />
            </Suspense>
        </main>
    );
}
