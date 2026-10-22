import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { startOrderPayment } from '@/app/checkout/actions';
import { CheckoutForm } from '@/components/CheckoutForm';
import { buttonVariants } from '@/components/ui/button';
import { cartTotal } from '@/domains/cart/cart';
import { requireMember } from '@/lib/auth/guards';
import { getCartLines, getShippingAddress } from '@/lib/data/cart';
import { formatPrice } from '@/shared/utils/formatPrice';

export const metadata: Metadata = { title: '주문서' };

// 세션을 읽으므로 <Suspense> 안 (CONV-07). 기본 배송지가 있으면 미리 채운다 (AC-08-2)
async function CheckoutContent() {
    await requireMember('/checkout');
    const [lines, address] = await Promise.all([getCartLines(), getShippingAddress()]);
    const orderable = lines.filter((line) => line.purchasable);

    if (orderable.length === 0) {
        return (
            <div className="bg-card mt-8 rounded-lg border p-6">
                <p className="font-heading text-xl font-bold">주문할 수 있는 책이 없어요</p>
                <p className="text-muted-foreground mt-2">품절된 책은 주문에서 빠져요.</p>
                <Link href="/cart" className={buttonVariants({ className: 'mt-4 h-11 px-5 text-base' })}>
                    장바구니로 가기
                </Link>
            </div>
        );
    }

    // 금액은 화면 표시용이다. 실제 결제 금액은 서버(create_order·create_payment)가 다시 계산한다 (NFR-19)
    const summary = (
        <>
            <ul className="mt-3 border-t">
                {orderable.map(({ product, quantity }) => (
                    <li key={product.id} className="flex justify-between gap-4 border-b py-3">
                        <span>
                            {product.name} × {quantity}
                        </span>
                        <span className="whitespace-nowrap">{formatPrice(product.price * quantity)}</span>
                    </li>
                ))}
            </ul>
            {orderable.length < lines.length && <p className="text-muted-foreground mt-2 text-sm">품절된 책은 주문에서 빠졌어요.</p>}
        </>
    );

    return <CheckoutForm defaults={address} total={cartTotal(lines)} summary={summary} startOrderPayment={startOrderPayment} />;
}

// SCR-10 주문서·결제 (AC-08-1·2·7)
export default function CheckoutPage() {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">주문서</h1>
            <Suspense fallback={<p className="text-muted-foreground mt-8">주문서를 준비하는 중이에요.</p>}>
                <CheckoutContent />
            </Suspense>
        </main>
    );
}
