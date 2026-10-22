import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { deleteMemo, saveMemo } from '@/app/mypage/shelf/actions';
import { BookCover } from '@/components/BookCover';
import { ShelfMemo } from '@/components/ShelfMemo';
import { buttonVariants } from '@/components/ui/button';
import { requireMember } from '@/lib/auth/guards';
import { getShelf } from '@/lib/data/rounds';

export const metadata: Metadata = { title: '나의 서가' };

const MEMO_ACTIONS = { saveMemo, deleteMemo };

// 세션을 읽으므로 <Suspense> 안 (CONV-07). 언박싱한 책만 온다 — 언박싱 전 회차에는 메모 칸이 없다 (AC-17-6)
async function Shelf() {
    await requireMember('/mypage/shelf');
    const rounds = await getShelf();

    if (rounds.length === 0) {
        return (
            <div className="bg-card mt-8 rounded-lg border p-6">
                <p className="font-heading text-xl font-bold">아직 서가에 꽂힌 책이 없어요</p>
                <Link href="/letters/new" className={buttonVariants({ className: 'mt-4 h-11 px-5 text-base' })}>
                    편지 띄우기
                </Link>
            </div>
        );
    }

    // 상품 목록과 같은 열 수 (NFR-02, UX-PLAN-FE screens §SCR-17)
    return (
        <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
            {rounds.map((round) => (
                <li key={round.roundId}>
                    <BookCover key={round.product.imageUrl} src={round.product.imageUrl} title={round.product.name} sizes="(min-width: 1280px) 270px, (min-width: 768px) 33vw, 50vw" />
                    <h2 className="font-heading mt-3 text-lg leading-snug font-bold">{round.product.name}</h2>
                    <ShelfMemo key={round.memo?.updatedAt ?? 'none'} roundId={round.roundId} bookName={round.product.name} memo={round.memo} actions={MEMO_ACTIONS} />
                </li>
            ))}
        </ul>
    );
}

// SCR-17 나의 서가 (AC-17-1~6)
export default function ShelfPage() {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">나의 서가</h1>
            <p className="text-muted-foreground mt-3 text-lg">언박싱한 책이 여기에 꽂혀요. 메모는 나만 볼 수 있어요.</p>
            <Suspense fallback={<p className="text-muted-foreground mt-8">서가를 살피는 중이에요.</p>}>
                <Shelf />
            </Suspense>
        </main>
    );
}
