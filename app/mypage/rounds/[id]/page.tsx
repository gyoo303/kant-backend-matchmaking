import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { unbox } from '@/app/mypage/rounds/[id]/actions';
import { UnboxedView } from '@/components/UnboxedView';
import { UnboxForm } from '@/components/UnboxForm';
import { buttonVariants } from '@/components/ui/button';
import { requireMember } from '@/lib/auth/guards';
import { getMemberRound, getUnboxedRound } from '@/lib/data/rounds';
import { isUuid } from '@/shared/utils/uuid';

export const metadata: Metadata = { title: '언박싱' };

// 언박싱 전에는 상태·힌트만 읽는다. 책 제목·표지·답장·엽서 주소는 이 화면 데이터에 없다 (AC-16-6, NFR-08)
async function RoundContent({ params }: { params: PageProps<'/mypage/rounds/[id]'>['params'] }) {
    const { id } = await params;
    await requireMember(`/mypage/rounds/${id}`);
    if (!isUuid(id)) notFound();

    const round = await getMemberRound(id);
    if (!round) notFound(); // 남의 회차도 없는 회차와 같다

    if (round.status === 'unboxed') {
        const opened = await getUnboxedRound(id);
        if (!opened) notFound();
        return <UnboxedView round={opened} />;
    }
    if (round.status === 'shipped') {
        return <UnboxForm roundId={round.id} teaser={round.teaser ?? ''} unbox={unbox} />;
    }
    return (
        <div className="bg-card max-w-xl rounded-lg border p-6">
            <p className="font-heading text-xl">아직 책이 서점 문을 나서지 않았어요</p>
            <Link href="/mypage/window" className={buttonVariants({ className: 'mt-5 h-11 px-5 text-base' })}>
                창가로 가기
            </Link>
        </div>
    );
}

// SCR-16 언박싱 (AC-16-1~7)
export default function RoundPage({ params }: PageProps<'/mypage/rounds/[id]'>) {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
            <Suspense fallback={<p className="text-muted-foreground">상자를 살피는 중이에요.</p>}>
                <RoundContent params={params} />
            </Suspense>
        </main>
    );
}
