import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { saveProduct } from '@/app/admin/products/actions';
import { ProductForm } from '@/components/ProductForm';
import { getProduct } from '@/lib/data/products';

export const metadata: Metadata = { title: '책 고치기' };

// 주소의 id·?saved=1(새 책 저장 직후)은 요청마다 다르므로 <Suspense> 안에서 읽는다 (CONV-07)
async function EditProduct({ params, searchParams }: PageProps<'/admin/products/[id]'>) {
    const [{ id }, query] = await Promise.all([params, searchParams]);
    const product = await getProduct(id);
    if (!product) notFound();

    return (
        <>
            <h1 className="font-heading mt-2 text-3xl font-bold md:text-4xl">{product.name}</h1>
            <ProductForm key={product.id} product={product} saveProduct={saveProduct} initiallySaved={query.saved === '1'} />
        </>
    );
}

// SCR-08 책 고치기 (AC-06-2: 재고 0으로 고치면 목록·상세에 품절)
export default function EditProductPage(props: PageProps<'/admin/products/[id]'>) {
    return (
        <>
            <Link href="/admin/products" className="inline-flex min-h-11 items-center rounded-lg underline underline-offset-4">
                책 목록으로
            </Link>
            <Suspense fallback={<p className="text-muted-foreground mt-6">책을 꺼내 오는 중이에요.</p>}>
                <EditProduct {...props} />
            </Suspense>
        </>
    );
}
