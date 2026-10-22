import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

// 없는 회차·남의 회차: 같은 안내 (AC-16-4 취지, REJ-38)
export default function RoundNotFound() {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8">
            <div className="max-w-xl">
                <h1 className="font-heading text-3xl font-bold md:text-4xl">편지를 찾을 수 없어요</h1>
                <p className="text-muted-foreground mt-3 text-lg">창가에서 지금 편지를 확인해 주세요.</p>
                <Link href="/mypage/window" className={buttonVariants({ className: 'mt-8 h-11 px-5 text-base' })}>
                    창가로 가기
                </Link>
            </div>
        </main>
    );
}
