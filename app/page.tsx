import Link from 'next/link';
import { ProductGrid } from '@/components/ProductGrid';
import { ThemeShelves } from '@/components/ThemeSelector';
import { buttonVariants } from '@/components/ui/button';
import { WindowArt } from '@/components/WindowArt';
import { PRODUCTS_LOAD_FAILED } from '@/domains/products/theme';
import { getNewArrivals } from '@/lib/data/products';
import type { Product } from '@/types/product';

// API-03 실패(설정 누락 포함)는 이 영역에서만 안내한다. 소개·테마는 그대로 보인다 (AC-01-4)
async function loadNewArrivals(): Promise<Product[] | null> {
    try {
        return await getNewArrivals();
    } catch (error) {
        console.error('[SCR-01] 새로 들어온 책을 불러오지 못함', error);
        return null;
    }
}

// SCR-01 메인: 소개(+ 창가 그림) → 편지 띄우기 안내 → 테마 서가 → 새로 들어온 책 (PM-SCR §3, UX-D-04)
export default async function HomePage() {
    const newArrivals = await loadNewArrivals();

    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
            <section className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
                <div>
                    <h1 className="font-heading text-3xl leading-snug font-bold md:text-4xl md:leading-snug">
                        천천히 읽고,
                        <br />
                        천천히 답장하는 책방
                    </h1>
                    <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
                        대전 어은동 골목 안쪽에서 자연과 생태, 건강한 식문화를 다루는 작은 책방입니다. 빠르게 보내드리기보다
                        손편지를 주고받으며 천천히 알아가고 싶어요.
                    </p>
                </div>
                <div className="bg-night rounded-lg p-5">
                    <WindowArt state="hero" label="불이 켜진 책방 창가와 우체통 그림" />
                </div>
            </section>

            <section
                aria-label="편지 띄우기 안내"
                className="bg-accent text-accent-foreground mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg p-5"
            >
                <p className="max-w-2xl leading-relaxed">
                    요즘 마음 날씨를 편지로 보내 주시면, 책방지기가 어울리는 책을 골라 답장과 함께 보내드려요.
                </p>
                <Link href="/letters/new" className={buttonVariants({ className: 'h-11 px-5 text-base' })}>
                    편지 띄우기
                </Link>
            </section>

            <section aria-labelledby="shelves-title" className="mt-16">
                <div className="flex items-baseline justify-between gap-4">
                    <h2 id="shelves-title" className="font-heading text-2xl font-bold">
                        테마 서가
                    </h2>
                    <Link href="/products" className="inline-flex min-h-11 items-center rounded-lg underline underline-offset-4">
                        전체 보기
                    </Link>
                </div>
                <div className="mt-6">
                    <ThemeShelves />
                </div>
            </section>

            <section aria-labelledby="new-title" className="mt-16">
                <h2 id="new-title" className="font-heading text-2xl font-bold">
                    새로 들어온 책
                </h2>
                {newArrivals === null ? (
                    <div role="status" className="bg-card mt-6 rounded-lg border p-6">
                        <p>{PRODUCTS_LOAD_FAILED}</p>
                        <Link
                            href="/products"
                            className="mt-2 inline-flex min-h-11 items-center rounded-lg underline underline-offset-4"
                        >
                            테마 서가 둘러보기
                        </Link>
                    </div>
                ) : (
                    <ProductGrid products={newArrivals} className="mt-6" />
                )}
            </section>
        </main>
    );
}
