import 'server-only';
import type { CancelTarget } from '@/domains/orders/order';
import type { KeeperOrder, OrderStatus, OrderSummary } from '@/domains/orders/types/order.types';
import type { ShippingInput } from '@/domains/shipping/shipping.schema';
import type { RoundStatus } from '@/domains/subscriptions/types/round.types';
import { toAppError } from '@/lib/data/rpc-error';
import { sessionUserId } from '@/lib/data/session';
import { AppError } from '@/lib/http/result';
import { createClient } from '@/lib/supabase/server';

// 주문 RPC 래퍼·주문 조회 (TKT-BE-M3-02·03). 회원·책방지기 세션(createClient)으로 부른다.

// SEQ-02: 장바구니(재고>0 줄)로 주문을 만든다. 합계·가격은 DB가 계산한다(NFR-19)
export async function createOrder(ship: ShippingInput): Promise<{ orderId: string }> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_order', {
        p_ship: { recipientName: ship.recipientName, phone: ship.phone, address: ship.address },
    });
    if (error) throw toAppError('create_order', error);
    return { orderId: data.id };
}

// 결제창 상품명용 책 이름
export async function getOrderItemNames(orderId: string): Promise<string[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('order_items')
        .select('product_name')
        .eq('order_id', orderId)
        .order('product_name');
    if (error) throw new AppError('UNKNOWN', `[API-07] order_items: ${error.message}`);
    return data.map((row) => row.product_name);
}

// SEQ-08 상태 전이(주문·회차 공용). 회차는 DB가 null을 돌려준다(표시만 바뀜, AR-DB §5.1)
type TransitionRpc = 'request_cancel' | 'withdraw_cancel' | 'cancel_pending' | 'reject_cancel';

export async function transition(rpc: TransitionRpc, target: CancelTarget): Promise<OrderStatus | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(rpc, { p_kind: target.kind, p_id: target.id });
    if (error) throw toAppError(rpc, error);
    return data;
}

// API-13 발송 완료: paid → shipped. 취소 요청 중이면 CANCEL_REQUESTED(AC-10-4)
export async function shipOrder(orderId: string): Promise<OrderStatus> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('ship_order', { p_order_id: orderId });
    if (error) throw toAppError('ship_order', error);
    return data;
}

// INVALID_STATE 안내용 현재 상태(AC-09-7, AC-20-7). 볼 수 없으면 null
export async function getCurrentStatus(
    target: CancelTarget,
): Promise<{ kind: 'order'; status: OrderStatus } | { kind: 'round'; status: RoundStatus } | null> {
    const supabase = await createClient();
    if (target.kind === 'order') {
        const { data, error } = await supabase.from('orders').select('status').eq('id', target.id).maybeSingle();
        if (error) throw new AppError('UNKNOWN', `[API-11] orders: ${error.message}`);
        return data ? { kind: 'order', status: data.status } : null;
    }
    const { data, error } = await supabase.from('subscription_rounds').select('status').eq('id', target.id).maybeSingle();
    if (error) throw new AppError('UNKNOWN', `[API-11] subscription_rounds: ${error.message}`);
    return data ? { kind: 'round', status: data.status } : null;
}

const ORDER_COLUMNS =
    'id, order_number, status, total_amount, created_at, cancel_rejected_at, paid_at, ship_recipient_name, ship_phone, ship_address, order_items(product_id, product_name, unit_price, quantity)';

type OrderRow = {
    id: string;
    order_number: string;
    status: OrderStatus;
    total_amount: number;
    created_at: string;
    cancel_rejected_at: string | null;
    paid_at: string | null;
    ship_recipient_name: string;
    ship_phone: string;
    ship_address: string;
    order_items: { product_id: string; product_name: string; unit_price: number; quantity: number }[];
};

function toOrderSummary(row: OrderRow): OrderSummary {
    return {
        id: row.id,
        orderNumber: row.order_number,
        status: row.status,
        totalAmount: row.total_amount,
        createdAt: row.created_at,
        // 거절 안내는 다시 주문 접수(paid)로 돌아온 주문에만 보인다(AC-09-6)
        cancelRejected: row.status === 'paid' && row.cancel_rejected_at !== null,
        items: row.order_items.map((item) => ({
            productId: item.product_id,
            productName: item.product_name,
            unitPrice: item.unit_price,
            quantity: item.quantity,
        })),
    };
}

// SCR-12 주문 현황: 내 주문 최신순(RLS로 본인 주문만, AC-09-4)
export async function getMyOrders(): Promise<OrderSummary[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .eq('member_id', await sessionUserId(supabase))
        .order('created_at', { ascending: false });
    if (error) throw new AppError('UNKNOWN', `[SCR-12] orders: ${error.message}`);
    return data.map(toOrderSummary);
}

// 주문 하나(본인 것만, 남의 주문이면 null — AC-09-4)
export async function getMyOrder(orderId: string): Promise<OrderSummary | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .eq('id', orderId)
        .eq('member_id', await sessionUserId(supabase))
        .maybeSingle();
    if (error) throw new AppError('UNKNOWN', `[SCR-11] orders: ${error.message}`);
    return data ? toOrderSummary(data) : null;
}

// SCR-13 주문 처리: 발송 대기(paid)·취소 요청 주문, 결제 순. 책방지기 세션에서만 행이 온다(RLS)
export async function getKeeperOrders(): Promise<KeeperOrder[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .in('status', ['paid', 'cancel_requested'])
        .order('paid_at', { ascending: true });
    if (error) throw new AppError('UNKNOWN', `[SCR-13] orders: ${error.message}`);
    return data.map((row) => ({
        ...toOrderSummary(row),
        shipping: { recipientName: row.ship_recipient_name, phone: row.ship_phone, address: row.ship_address },
        paidAt: row.paid_at,
    }));
}
