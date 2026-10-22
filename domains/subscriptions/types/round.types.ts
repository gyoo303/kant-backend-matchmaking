import type { ShippingSnapshot } from '@/domains/orders/types/order.types';
import type { Product } from '@/types/product';

// AR-API §1.2·§4.2
export type RoundStatus = 'pending_payment' | 'arrived' | 'reading' | 'shipped' | 'unboxed' | 'cancelled';

export type WindowView =
    | { kind: 'empty' }
    | { kind: 'pending_payment'; roundId: string }
    | { kind: 'arrived' | 'reading'; roundId: string; cancelRequested: boolean; cancelRejected: boolean }
    | { kind: 'shipped'; roundId: string; teaser: string };

// 언박싱 후에만 만들 수 있는 값(NFR-08). postcardUrl은 600초 서명 URL
export interface UnboxedRound {
    roundId: string;
    product: Pick<Product, 'id' | 'name' | 'imageUrl' | 'author' | 'theme'>; // theme: 대체 표지 무늬(UX-D-10)
    replyLetter: string;
    postcardUrl: string | null;
    unboxedAt: string;
    memo: { body: string; updatedAt: string } | null;
}

// 서재 작업 화면(SCR-19)용. 책방지기에게만 돌려준다(편지 전문·매칭·코드 포함)
// 서재 작업 목록(SCR-19) 한 줄. recipientName은 결제 시점 배송지 사본의 받는 사람 (AR-API §1.2)
export interface DeskRound {
    id: string;
    status: RoundStatus;
    paidAt: string | null;
    cancelRequested: boolean;
    recipientName: string;
}

export interface KeeperRound {
    id: string;
    status: RoundStatus;
    letter: string;
    paidAt: string | null;
    openedAt: string | null;
    cancelRequested: boolean;
    cancelRejected: boolean;
    shipping: ShippingSnapshot;
    product: Pick<Product, 'id' | 'name' | 'imageUrl' | 'author' | 'stock'> | null;
    replyLetter: string | null;
    postcardUrl: string | null;
    teaser: string | null;
    code: string | null;
}
