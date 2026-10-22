'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { LetterArt } from './LetterArt';

const MAILBOX_DROP_MS = 2000; // NFR-10 우체통 들어감 1.5~3s (globals.css --animate-mailbox-drop)

// 회차 결제 확정 뒤에만: 봉투가 우체통에 들어가는 전환 → 창가로 이동 (AC-11-2, D-041).
// 동작 줄이기면 전환 없이 봉투가 들어간 우체통 그림만 보이고, 회원이 [창가로 가기]를 누른다 (AC-11-7)
export function PostedLetter({ copy }: { copy: string }) {
    const router = useRouter();

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const timer = setTimeout(() => router.push('/mypage/window'), MAILBOX_DROP_MS + 600);
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <>
            <div className="bg-card mt-8 max-w-xs rounded-lg border p-6">
                <LetterArt stage="posted" label="편지가 우체통에 들어갔어요" />
            </div>
            <p role="status" className="text-muted-foreground mt-6 text-lg">
                {copy}
            </p>
            <Link href="/mypage/window" className={buttonVariants({ className: 'mt-6 h-11 px-5 text-base' })}>
                창가로 가기
            </Link>
        </>
    );
}
