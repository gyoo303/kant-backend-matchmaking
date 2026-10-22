import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { Suspense } from 'react';
import { refund, rejectCancel, shipOrder } from '@/app/admin/orders/actions';
import { KeeperOrderActions } from '@/components/KeeperOrderActions';
import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS_LABELS } from '@/domains/orders/order';
import type { KeeperOrder } from '@/domains/orders/types/order.types';
import { getKeeperOrders } from '@/lib/data/orders';

export const metadata: Metadata = { title: '주문 처리' };

const KEEPER_ACTIONS = { shipOrder, refund, rejectCancel };
const NOTHING_TO_SHIP = '지금 보낼 책이 없어요'; // AC-19-2

async function loadOrders(): Promise<KeeperOrder[] | null> {
    try {
        return await getKeeperOrders();
    } catch (error) {
        unstable_rethrow(error);
        console.error('[SCR-13] 주문을 읽지 못함', error);
        return null;
    }
}

// 주문 상자: 책·수량 → 받는 사람/연락처/주소(결제 시점 사본) → 버튼. 취소 요청이면 테두리 --destructive (UX-PLAN-FE screens §SCR-13)
function KeeperOrderCard({ order }: { order: KeeperOrder }) {
    const cancelRequested = order.status === 'cancel_requested';
    return (
        <li className={`bg-card rounded-lg border p-5 ${cancelRequested ? 'border-destructive' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-bold">
                    {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}
                </h2>
                <Badge
                    variant="secondary"
                    className={`h-auto px-3 py-1 text-sm font-normal ${cancelRequested ? 'bg-destructive-soft text-destructive-soft-foreground' : ''}`}
                >
                    {ORDER_STATUS_LABELS[order.status]}
                </Badge>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
                {order.shipping.recipientName} / {order.shipping.phone} / {order.shipping.address}
            </p>
            <p className="text-muted-foreground text-sm">주문 번호 {order.orderNumber}</p>
            <KeeperOrderActions orderId={order.id} cancelRequested={cancelRequested} actions={KEEPER_ACTIONS} />
        </li>
    );
}

async function KeeperOrderList() {
    const orders = await loadOrders();
    if (orders === null) {
        return <p role="status" className="bg-card mt-6 rounded-lg border p-6">주문을 불러오지 못했어요</p>;
    }
    if (orders.length === 0) {
        return <p className="bg-card mt-6 rounded-lg border p-6">{NOTHING_TO_SHIP}</p>;
    }
    return (
        <ul className="mt-6 flex flex-col gap-4">
            {orders.map((order) => (
                <KeeperOrderCard key={order.id} order={order} />
            ))}
        </ul>
    );
}

// SCR-13 주문 처리 (AC-10-1~6). [주소록 내려받기]는 TKT-FE-M4-03에서 이 제목 줄에 붙인다
export default function AdminOrdersPage() {
    return (
        <>
            <h1 className="font-heading text-3xl font-bold md:text-4xl">주문 처리</h1>
            <p className="text-muted-foreground mt-3">오래된 주문부터 보여요.</p>
            <Suspense fallback={<p className="text-muted-foreground mt-6">주문을 꺼내 오는 중이에요.</p>}>
                <KeeperOrderList />
            </Suspense>
        </>
    );
}
