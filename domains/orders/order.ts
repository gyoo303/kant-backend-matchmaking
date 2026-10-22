import { z } from 'zod';
import { isUuid } from '@/shared/utils/uuid';
import type { OrderStatus } from './types/order.types';

// 취소 요청·철회·거절·환불·결제 대기 취소의 대상(API-11~13). 주문과 회차가 같은 흐름을 쓴다(SEQ-08)
export const cancelTargetSchema = z.object({
    kind: z.enum(['order', 'round']),
    id: z.string().refine(isUuid),
});

export type CancelTarget = z.infer<typeof cancelTargetSchema>;

// 회원 화면 상태 이름(PM-DOMAIN §5.1)
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    pending_payment: '결제 대기',
    paid: '주문 접수',
    cancel_requested: '취소 요청',
    shipped: '발송됨',
    refunded: '환불 완료',
    cancelled: '결제 전 취소',
};

export const CANCEL_REQUESTED_MESSAGE = '취소 요청을 책방지기에게 전했어요'; // AC-09-2, US-20
export const CANCEL_REJECTED_MESSAGE = '책방지기가 취소 요청을 받지 않았어요. 책은 그대로 보내드려요'; // AC-09-6, AC-20-6
export const REFUND_FAILED_MESSAGE = '환불하지 못했어요. 잠시 후 다시 눌러 주세요'; // AC-10-3, REJ-21

// 지금 상태에서 할 수 없는 요청일 때 현재 상태를 함께 알린다(AC-09-7, AC-20-7)
export function currentStateMessage(label: string): string {
    return `지금은 '${label}' 상태라 이 요청을 처리할 수 없어요.`;
}
