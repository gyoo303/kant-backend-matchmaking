import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { addToCart } from '@/app/cart/actions';
import { AddToCartButton } from '@/components/AddToCartButton';
import { SoldOutBadge, ThemeBadge } from '@/components/BookBadges';
import { BookCover } from '@/components/BookCover';
import { KeeperNote } from '@/components/KeeperNote';
import { getProduct } from '@/lib/data/products';
import { formatPrice } from '@/shared/utils/formatPrice';

// 주소의 id는 요청마다 다르므로 <Suspense> 안에서 읽는다 (CONV-07). 없는 id면 not-found.tsx (KANT-R9·C14)
async function ProductDetail({ params }: { params: PageProps<'/products/[id]'>['params'] }) {
    const { id } = await params;
    const product = await getProduct(id);
    if (!product) notFound();

    const soldOut = product.stock <= 0;

    return (
        <>
            <title>{`${product.name} · 우분투북스`}</title>
            {/* 책방지기 노트가 다른 본문보다 위 (AC-03-1, INV-02) */}
            <KeeperNote note={product.keeperNote} />

            {/* 360px: 노트 → 표지 → 정보 한 열, 768px 이상: 표지 | 정보 2단 (PM-SCR §3) */}
            <div className="mt-10 flex flex-col gap-8 md:flex-row md:gap-12">
                <div className="w-full max-w-50 shrink-0 md:max-w-70">
                    <BookCover
                        key={product.imageUrl}
                        src={product.imageUrl}
                        title={product.name}
                        theme={product.theme}
                        soldOut={soldOut}
                        sizes="(min-width: 768px) 280px, 200px"
                        priority
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="font-heading text-3xl leading-snug font-bold md:text-4xl md:leading-snug">{product.name}</h1>
                    <p className="text-muted-foreground mt-1">{product.author}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <ThemeBadge theme={product.theme} />
                        {soldOut && <SoldOutBadge />}
                        <span className="text-xl">{formatPrice(product.price)}</span>
                    </div>
                    <p className="mt-5 max-w-xl leading-relaxed">{product.description}</p>

                    <AddToCartButton productId={product.id} soldOut={soldOut} addToCart={addToCart} />

                    {/* 출판사 소개가 없으면 영역을 그리지 않는다 (AC-03-2) */}
                    {product.publisherDescription && (
                        <details className="mt-6 border-t pt-2">
                            <summary className="flex min-h-11 cursor-pointer items-center rounded-lg">출판사 소개</summary>
                            <p className="text-muted-foreground mt-2 max-w-xl leading-relaxed whitespace-pre-line">
                                {product.publisherDescription}
                            </p>
                        </details>
                    )}

                    <Link
                        href={`/products?theme=${product.theme}`}
                        className="mt-6 inline-flex min-h-11 items-center rounded-lg underline underline-offset-4"
                    >
                        테마 서가로 돌아가기
                    </Link>
                </div>
            </div>
        </>
    );
}

function ProductDetailPending() {
    return (
        <div aria-busy="true" className="bg-card rounded-lg border p-6 md:p-8">
            <p className="text-muted-foreground">책을 꺼내 오는 중이에요.</p>
        </div>
    );
}

// SCR-03 상품 상세 (KANT-R6·C12): await params → getProduct(id) → null이면 notFound()
export default function ProductPage({ params }: PageProps<'/products/[id]'>) {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
            <Suspense fallback={<ProductDetailPending />}>
                <ProductDetail params={params} />
            </Suspense>
        </main>
    );
}
