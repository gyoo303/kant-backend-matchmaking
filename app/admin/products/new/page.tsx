import type { Metadata } from 'next';
import Link from 'next/link';
import { saveProduct } from '@/app/admin/products/actions';
import { ProductForm } from '@/components/ProductForm';

export const metadata: Metadata = { title: '새 책 등록' };

// SCR-08 새 책 등록 (AC-06-1). 권한은 admin/layout(requireKeeper)과 saveProduct(authorizeKeeper) 두 곳에서 본다
export default function NewProductPage() {
    return (
        <>
            <Link href="/admin/products" className="inline-flex min-h-11 items-center rounded-lg underline underline-offset-4">
                책 목록으로
            </Link>
            <h1 className="font-heading mt-2 text-3xl font-bold md:text-4xl">새 책 등록</h1>
            <ProductForm saveProduct={saveProduct} />
        </>
    );
}
