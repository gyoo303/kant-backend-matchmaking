import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { removeCartItem, updateCartQuantity } from '@/app/cart/actions';
import { SoldOutBadge } from '@/components/BookBadges';
import { BookCover } from '@/components/BookCover';
import { CartLineControls } from '@/components/CartLineControls';
import { buttonVariants } from '@/components/ui/button';
import { cartTotal, remainingStockMessage } from '@/domains/cart/cart';
import type { CartLine } from '@/domains/cart/types/cart.types';
import { requireMember } from '@/lib/auth/guards';
import { getCartLines } from '@/lib/data/cart';
import { formatPrice } from '@/shared/utils/formatPrice';

export const metadata: Metadata = { title: '장바구니' };

const CART_ACTIONS = { updateCartQuantity, removeCartItem };

function CartLineRow({ line }: { line: CartLine }) {
    const { product, quantity, purchasable } = line;
    // 담은 뒤 재고가 줄어 담은 수량보다 적어진 경우 (AC-07-4 안내 문구)
    const notice = purchasable && quantity > product.stock ? remainingStockMessage(product.stock) : null;
    return (
        <li className="flex gap-4 border-b py-4">
            <Link href={`/products/${product.id}`} className="w-18 shrink-0 rounded-xs" tabIndex={-1} aria-hidden="true">
                <BookCover key={product.imageUrl} src={product.imageUrl} title={product.name} theme={product.theme} soldOut={!purchasable} sizes="72px" />
            </Link>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3">
                    <div>
                        <Link href={`/products/${product.id}`} className="font-heading rounded-xs font-bold hover:underline">
                            {product.name}
                        </Link>
                        <p className="text-muted-foreground text-sm">{product.author}</p>
                    </div>
                    <span className="whitespace-nowrap">{formatPrice(product.price)}</span>
                </div>
                {!purchasable && (
                    <div className="mt-2">
                        <SoldOutBadge />
                    </div>
                )}
                <CartLineControls
                    productId={product.id}
                    productName={product.name}
                    quantity={quantity}
                    stock={product.stock}
                    purchasable={purchasable}
                    notice={notice}
                    actions={CART_ACTIONS}
                />
            </div>
        </li>
    );
}

// 세션을 읽으므로 <Suspense> 안 (CONV-07). 비회원은 로그인 후 돌아온다 (AC-05-6)
async function CartContent() {
    await requireMember('/cart');
    const lines = await getCartLines();

    // 비었을 때: 안내 + 다음 행동 1개 (UX-14)
    if (lines.length === 0) {
        return (
            <div className="bg-card mt-8 rounded-lg border p-6">
                <p className="font-heading text-xl font-bold">장바구니가 비어 있어요</p>
                <Link href="/products" className={buttonVariants({ className: 'mt-4 h-11 px-5 text-base' })}>
                    테마 서가로 가기
                </Link>
            </div>
        );
    }

    const orderable = lines.filter((line) => line.purchasable);
    const bookCount = orderable.reduce((sum, line) => sum + line.quantity, 0);

    return (
        <div className="mt-8 grid items-start gap-8 md:grid-cols-3">
            <ul className="border-t md:col-span-2">
                {lines.map((line) => (
                    <CartLineRow key={line.product.id} line={line} />
                ))}
            </ul>
            <aside aria-label="주문 합계" className="bg-card rounded-lg border p-6">
                <dl className="grid grid-cols-2 gap-y-2">
                    <dt className="text-muted-foreground">책 {bookCount}권</dt>
                    <dd className="text-right">{formatPrice(cartTotal(lines))}</dd>
                    <dt className="text-muted-foreground">합계</dt>
                    <dd className="font-heading text-right text-2xl">{formatPrice(cartTotal(lines))}</dd>
                </dl>
                {orderable.length > 0 ? (
                    <Link href="/checkout" className={buttonVariants({ className: 'mt-5 h-13 w-full text-base' })}>
                        주문하기
                    </Link>
                ) : (
                    <p className="text-muted-foreground mt-5 text-sm">주문할 수 있는 책이 없어요. 품절된 책은 주문에서 빠져요.</p>
                )}
            </aside>
        </div>
    );
}

// SCR-09 장바구니 (AC-07-1~5)
export default function CartPage() {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">장바구니</h1>
            <Suspense fallback={<p className="text-muted-foreground mt-8">장바구니를 살피는 중이에요.</p>}>
                <CartContent />
            </Suspense>
        </main>
    );
}
