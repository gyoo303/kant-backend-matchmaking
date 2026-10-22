import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

// SCR-04: 없는 책 ID. 화면이 멈추지 않고 문구 + 목록 링크 (AC-03-4, KANT-C14, NFR-05)
export default function ProductNotFound() {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8">
            <div className="max-w-xl">
                <h1 className="font-heading text-3xl font-bold md:text-4xl">상품을 찾을 수 없습니다</h1>
                <p className="text-muted-foreground mt-3 text-lg">주소를 다시 확인하시거나 테마 서가에서 찾아보세요.</p>
                <Link href="/products" className={buttonVariants({ className: 'mt-8 h-11 px-5 text-base' })}>
                    테마 서가로 가기
                </Link>
            </div>
        </main>
    );
}
