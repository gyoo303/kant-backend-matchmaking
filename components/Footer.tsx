import Link from 'next/link';

// 책방 이름 + 사이트 링크만. 사업자 정보·환불 규정·개인정보 처리방침은 넣지 않는다 (AC-01-3, D-021)
export function Footer() {
    return (
        <footer className="text-muted-foreground mt-16 border-t text-sm">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-4 px-4 pt-8 pb-10 md:px-8">
                <div>
                    <p className="font-heading text-foreground text-base font-bold">우분투북스</p>
                    <p>대전 어은동 골목 안쪽의 작은 책방</p>
                </div>
                <nav aria-label="사이트 링크" className="flex items-center gap-4">
                    <Link href="/products" className="inline-flex min-h-11 items-center rounded-lg underline underline-offset-4">
                        테마 서가
                    </Link>
                    <Link href="/letters/new" className="inline-flex min-h-11 items-center rounded-lg underline underline-offset-4">
                        편지 띄우기
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
