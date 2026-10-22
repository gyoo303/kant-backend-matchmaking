import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ProductGrid } from '@/components/ProductGrid';
import { ThemePills } from '@/components/ThemeSelector';
import { ALL_THEMES_INTRO, EMPTY_SHELF, parseTheme, PRODUCTS_LOAD_FAILED, THEME_INTROS } from '@/domains/products/theme';
import { getProducts } from '@/lib/data/products';
import { THEME_LABELS, THEMES, type Product, type Theme } from '@/types/product';

export const metadata: Metadata = { title: '테마 서가' };

async function loadProducts(theme: Theme | undefined): Promise<Product[] | null> {
    try {
        return await getProducts(theme);
    } catch (error) {
        console.error('[SCR-02] 책 목록을 불러오지 못함', error);
        return null;
    }
}

function ProductList({ theme, products }: { theme: Theme | undefined; products: Product[] | null }) {
    if (products === null) {
        return (
            <div role="status" className="bg-card rounded-lg border p-6">
                <p>{PRODUCTS_LOAD_FAILED}</p>
                <Link href="/" className="mt-2 inline-flex min-h-11 items-center rounded-lg underline underline-offset-4">
                    메인으로 가기
                </Link>
            </div>
        );
    }
    // 빈 테마: 안내 + 다른 테마 링크 (AC-02-4)
    if (products.length === 0) {
        return (
            <div className="bg-card rounded-lg border px-6 py-8">
                <h2 className="font-heading text-xl font-bold">{EMPTY_SHELF}</h2>
                <p className="text-muted-foreground mt-2">다른 서가를 둘러보세요.</p>
                <div className="mt-4">
                    <ThemePills themes={THEMES.filter((t) => t !== theme)} label="다른 테마" />
                </div>
            </div>
        );
    }
    return (
        <>
            <h2 className="sr-only">{theme ? `${THEME_LABELS[theme]} 서가의 책` : '모든 서가의 책'}</h2>
            {/* 테마가 바뀌면 카드 묶음 전체가 한 번에 나타난다 (NFR-10 ≤300ms, 동작 줄이기면 바로) */}
            <ProductGrid
                key={theme ?? 'all'}
                products={products}
                className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
            />
        </>
    );
}

// 주소의 테마(searchParams)는 요청마다 다르므로 이 부분만 <Suspense> 안에서 읽는다 (CONV-07)
async function ThemeShelf({ searchParams }: { searchParams: PageProps<'/products'>['searchParams'] }) {
    const theme = parseTheme((await searchParams).theme);
    const products = await loadProducts(theme);

    return (
        <>
            <div className="mt-6">
                <ThemePills selected={theme} />
            </div>
            <p className="text-muted-foreground mt-4 mb-8 text-lg">{theme ? THEME_INTROS[theme] : ALL_THEMES_INTRO}</p>
            <ProductList theme={theme} products={products} />
        </>
    );
}

function ThemeShelfPending() {
    return (
        <div aria-busy="true" className="mt-6">
            <ThemePills markCurrent={false} />
            <p className="text-muted-foreground mt-4 mb-8 text-lg">책을 꺼내 오는 중이에요.</p>
        </div>
    );
}

// SCR-02 테마 서가 (KANT-R5·C11): ?theme= → parseTheme → getProducts → .map(ProductCard)
export default function ProductsPage({ searchParams }: PageProps<'/products'>) {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">테마 서가</h1>
            <Suspense fallback={<ThemeShelfPending />}>
                <ThemeShelf searchParams={searchParams} />
            </Suspense>
        </main>
    );
}
