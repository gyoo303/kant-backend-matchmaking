import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cancelTargetSchema, currentStateMessage, ORDER_STATUS_LABELS } from './order';

describe('주문 취소 흐름 입력·문구 (API-11~13)', () => {
    it('대상은 order·round와 uuid만 받는다', () => {
        const id = 'b0000000-0000-4000-8000-000000000001';
        assert.equal(cancelTargetSchema.safeParse({ kind: 'order', id }).success, true);
        assert.equal(cancelTargetSchema.safeParse({ kind: 'round', id }).success, true);
        assert.equal(cancelTargetSchema.safeParse({ kind: 'payment', id }).success, false);
        assert.equal(cancelTargetSchema.safeParse({ kind: 'order', id: '1' }).success, false);
    });

    it('AC-09-7: 환불 완료 주문에 철회를 시도하면 현재 상태가 안내된다', () => {
        assert.equal(currentStateMessage(ORDER_STATUS_LABELS.refunded), "지금은 '환불 완료' 상태라 이 요청을 처리할 수 없어요.");
    });

    it('AC-09-1: 회원 화면 2단계 이름', () => {
        assert.equal(ORDER_STATUS_LABELS.paid, '주문 접수');
        assert.equal(ORDER_STATUS_LABELS.shipped, '발송됨');
    });
});
