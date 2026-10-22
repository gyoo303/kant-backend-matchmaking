// AR-API §1.2
export type OrderStatus = 'pending_payment' | 'paid' | 'cancel_requested' | 'shipped' | 'refunded' | 'cancelled';

export interface OrderSummary {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalAmount: number;
    createdAt: string;
    cancelRejected: boolean;
    items: { productId: string; productName: string; unitPrice: number; quantity: number }[];
}

export interface ShippingSnapshot {
    recipientName: string;
    phone: string;
    address: string;
}

// 책방지기 주문 처리 화면(SCR-13): 회원 화면 요약 + 결제 시점 배송지 사본
export interface KeeperOrder extends OrderSummary {
    shipping: ShippingSnapshot;
    paidAt: string | null;
}
