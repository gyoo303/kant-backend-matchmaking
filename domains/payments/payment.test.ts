import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    decideConfirm,
    idempotencyKeys,
    paymentOrderName,
    paymentTargetSchema,
    resultPath,
    ROUND_ORDER_NAME,
    tossSuccessQuerySchema,
} from './payment';

const ORDER_ID = 'b0000000-0000-4000-8000-000000000001';

describe('decideConfirm (SEQ-03 3단계)', () => {
    it('AC-08-8: 저장 금액 45,000원인데 승인 요청 금액이 1,000원이면 승인 호출 없이 거부', () => {
        assert.deepEqual(decideConfirm({ status: 'ready', amount: 45000 }, 1000), { action: 'reject', code: 'AMOUNT_MISMATCH' });
    });

    it('AC-11-10: 회차 결제 금액이 30,000원이 아니면 거부', () => {
        assert.deepEqual(decideConfirm({ status: 'ready', amount: 30000 }, 29999), { action: 'reject', code: 'AMOUNT_MISMATCH' });
    });

    it('AC-08-6: 이미 확정된 결제(새로고침·중복)는 다시 승인하지 않는다', () => {
        assert.deepEqual(decideConfirm({ status: 'paid', amount: 45000 }, 45000), { action: 'already_paid' });
    });

    it('실패·환불된 결제는 확정하지 않는다', () => {
        assert.deepEqual(decideConfirm({ status: 'failed', amount: 45000 }, 45000), { action: 'reject', code: 'INVALID_STATE' });
    });

    it('AC-08-1: 금액이 같은 ready 결제만 승인한다', () => {
        assert.deepEqual(decideConfirm({ status: 'ready', amount: 45000 }, 45000), { action: 'confirm' });
    });
});

describe('tossSuccessQuerySchema (API-09)', () => {
    it('금액은 정수 문자열만 받는다', () => {
        assert.equal(tossSuccessQuerySchema.safeParse({ paymentKey: 'pk', orderId: 'ub123456', amount: '45000' }).success, true);
        assert.equal(tossSuccessQuerySchema.safeParse({ paymentKey: 'pk', orderId: 'ub123456', amount: '45000.5' }).success, false);
        assert.equal(tossSuccessQuerySchema.safeParse({ paymentKey: 'pk', orderId: 'ub123456', amount: '-1' }).success, false);
    });
});

describe('결제 보조 규칙', () => {
    it('NFR-07: 멱등키는 같은 결제에 항상 같다', () => {
        assert.equal(idempotencyKeys.confirm('ubabc'), 'confirm-ubabc');
        assert.equal(idempotencyKeys.compensate('ubabc'), 'compensate-ubabc');
        assert.equal(idempotencyKeys.refund('p1'), 'refund-p1');
    });

    it('결제창 상품명: 첫 책 외 N권 / 회차', () => {
        assert.equal(paymentOrderName('order', ['숲의 시간']), '숲의 시간');
        assert.equal(paymentOrderName('order', ['숲의 시간', '새벽 강가', '밥상']), '숲의 시간 외 2권');
        assert.equal(paymentOrderName('round', []), ROUND_ORDER_NAME);
        assert.ok(paymentOrderName('order', ['가'.repeat(150)]).length <= 100);
    });

    it('결과 화면 주소', () => {
        assert.equal(
            resultPath({ status: 'ok', target: { kind: 'order', orderId: ORDER_ID } }),
            `/checkout/result?status=ok&target=order&id=${ORDER_ID}`,
        );
        assert.equal(resultPath({ status: 'fail', code: 'OUT_OF_STOCK', contact: true }), '/checkout/result?status=fail&code=OUT_OF_STOCK&contact=1');
    });

    it('결제 대상 입력은 kind와 uuid를 검사한다', () => {
        assert.equal(paymentTargetSchema.safeParse({ kind: 'order', orderId: ORDER_ID }).success, true);
        assert.equal(paymentTargetSchema.safeParse({ kind: 'round', orderId: ORDER_ID }).success, false);
        assert.equal(paymentTargetSchema.safeParse({ kind: 'order', orderId: '1' }).success, false);
    });
});
