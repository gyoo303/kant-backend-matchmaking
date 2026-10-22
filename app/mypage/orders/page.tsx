import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { retryPayment } from '@/app/checkout/actions';
import { cancelPending, requestCancel, withdrawCancel } from '@/app/mypage/actions';
import { formatDate } from '@/components/format-date';
import { MemberOrderActions } from '@/components/MemberOrderActions';
import { OrderSteps } from '@/components/OrderSteps';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { CANCEL_REJECTED_MESSAGE, CANCEL_REQUESTED_MESSAGE, ORDER_STATUS_LABELS } from '@/domains/orders/order';
import type { OrderSummary } from '@/domains/orders/types/order.types';
import { requireMember } from '@/lib/auth/guards';
import { getMyOrders } from '@/lib/data/orders';

export const metadata: Metadata = { title: '주문 현황' };

const ORDER_ACTIONS = { requestCancel, withdrawCancel, cancelPending, retryPayment };

// "첫 책 외 N권"
function orderTitle(order: OrderSummary): string {
    const [firstItem, ...rest] = order.items;
    if (!firstItem) return `주문 ${order.orderNumber}`;
    return rest.length > 0 ? `${firstItem.productName} 외 ${rest.length}권` : firstItem.productName;
}

function StatusBadge({ label }: { label: string }) {
    return <Badge variant="secondary" className="mt-3 h-auto px-3 py-1 text-sm font-normal">{label}</Badge>;
}

// 주문 상자: 책 요약·주문일 → 2단계 표시(또는 상태 배지) → 상태별 안내·버튼 (UX-PLAN-FE screens §SCR-12)
function OrderCard({ order }: { order: OrderSummary }) {
    const { status } = order;
    const inSteps = status === 'paid' || status === 'cancel_requested' || status === 'shipped';
    return (
        <li className="bg-card rounded-lg border p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-bold">{orderTitle(order)}</h2>
                <p className="text-muted-foreground text-sm">{formatDate(order.createdAt)} 주문</p>
            </div>
            {inSteps ? <OrderSteps shipped={status === 'shipped'} /> : <StatusBadge label={ORDER_STATUS_LABELS[status]} />}

            {status === 'cancel_requested' && (
                <p role="status" className="bg-accent text-accent-foreground mt-4 rounded-lg px-4 py-3">
                    {CANCEL_REQUESTED_MESSAGE}
                </p>
            )}
            {status === 'paid' && order.cancelRejected && (
                <p className="bg-secondary mt-4 rounded-lg px-4 py-3">{CANCEL_REJECTED_MESSAGE}</p>
            )}
            {status === 'pending_payment' && <p className="text-muted-foreground mt-3">결제가 끝나지 않았어요. 다시 결제하거나 주문을 거둘 수 있어요.</p>}

            {/* 발송된 주문은 [취소 요청]이 없다 (AC-09-3). 거절된 주문은 안내만 둔다 */}
            {(status === 'pending_payment' || status === 'cancel_requested' || (status === 'paid' && !order.cancelRejected)) && (
                <MemberOrderActions orderId={order.id} mode={status} actions={ORDER_ACTIONS} />
            )}
        </li>
    );
}

// 세션을 읽으므로 <Suspense> 안 (CONV-07). RLS로 본인 주문만 온다 (AC-09-4)
async function OrderList() {
    await requireMember('/mypage/orders');
    const orders = await getMyOrders();

    if (orders.length === 0) {
        return (
            <div className="bg-card mt-6 rounded-lg border p-6">
                <p className="font-heading text-xl font-bold">아직 주문한 책이 없어요</p>
                <Link href="/products" className={buttonVariants({ className: 'mt-4 h-11 px-5 text-base' })}>
                    테마 서가로 가기
                </Link>
            </div>
        );
    }
    return (
        <ul className="mt-6 flex flex-col gap-4">
            {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
            ))}
        </ul>
    );
}

// SCR-12 주문 현황 (AC-09-1~7)
export default function MyOrdersPage() {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-10">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">주문 현황</h1>
            <Suspense fallback={<p className="text-muted-foreground mt-6">주문을 꺼내 오는 중이에요.</p>}>
                <OrderList />
            </Suspense>
        </main>
    );
}
