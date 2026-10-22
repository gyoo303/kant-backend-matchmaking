import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SoldOutBadge, ThemeBadge } from '@/components/BookBadges';
import { buttonVariants } from '@/components/ui/button';
import { getProducts } from '@/lib/data/products';
import { formatPrice } from '@/shared/utils/formatPrice';
import type { Product } from '@/types/product';

export const metadata: Metadata = { title: '책 관리' };

async function loadProducts(): Promise<Product[] | null> {
    try {
        return await getProducts();
    } catch (error) {
        console.error('[SCR-08] 책 목록을 읽지 못함', error);
        return null;
    }
}

// 제목·테마·가격·재고·[고치기]. 삭제 버튼 없음 (AC-06-3, D-023). 360px에서는 테마 칸을 숨겨 제목이 접히지 않게 한다
async function ProductTable() {
    const products = await loadProducts();
    if (products === null) {
        return (
            <p role="status" className="bg-card mt-6 rounded-lg border p-6">
                책을 불러오지 못했어요
            </p>
        );
    }
    if (products.length === 0) {
        return <p className="bg-card mt-6 rounded-lg border p-6">아직 등록한 책이 없어요. [새 책 등록]으로 첫 책을 올려 주세요.</p>;
    }
    return (
        <table className="mt-6 w-full border-collapse text-left">
            <thead className="text-muted-foreground text-sm">
                <tr className="border-b">
                    <th scope="col" className="py-3 pr-3 font-normal">
                        제목
                    </th>
                    <th scope="col" className="hidden py-3 pr-3 font-normal md:table-cell">
                        테마
                    </th>
                    <th scope="col" className="py-3 pr-3 font-normal">
                        가격
                    </th>
                    <th scope="col" className="py-3 pr-3 font-normal">
                        재고
                    </th>
                    <th scope="col" className="py-3 font-normal">
                        <span className="sr-only">고치기</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                {products.map((product) => (
                    <tr key={product.id} className="border-b">
                        <td className="py-3 pr-3">{product.name}</td>
                        <td className="hidden py-3 pr-3 md:table-cell">
                            <ThemeBadge theme={product.theme} />
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">{formatPrice(product.price)}</td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                            {product.stock <= 0 ? (
                                <span className="inline-flex items-center gap-1.5">
                                    <SoldOutBadge /> 0
                                </span>
                            ) : (
                                product.stock
                            )}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                            <Link
                                href={`/admin/products/${product.id}`}
                                className="inline-flex min-h-11 items-center rounded-lg underline underline-offset-4"
                            >
                                고치기<span className="sr-only">: {product.name}</span>
                            </Link>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// SCR-08 책 관리 목록
export default function AdminProductsPage() {
    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="font-heading text-3xl font-bold md:text-4xl">책 관리</h1>
                <Link href="/admin/products/new" className={buttonVariants({ className: 'h-11 px-5 text-base' })}>
                    새 책 등록
                </Link>
            </div>
            <Suspense fallback={<p className="text-muted-foreground mt-6">책을 꺼내 오는 중이에요.</p>}>
                <ProductTable />
            </Suspense>
            <p className="text-muted-foreground mt-3 text-sm">책을 지우는 기능은 없어요. 팔지 않을 책은 재고를 0으로 두세요.</p>
        </>
    );
}
