import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CANCEL_REJECTED_MESSAGE } from '@/domains/orders/order';
import { toWindowView, windowCopy, windowNotice, type WindowRoundRow } from './window-copy';

const row = (overrides: Partial<WindowRoundRow>): WindowRoundRow => ({
    id: 'r1',
    status: 'arrived',
    teaser: null,
    cancelRequestedAt: null,
    cancelRejectedAt: null,
    ...overrides,
});

describe('창가 문구 매핑 (D-043)', () => {
    it('AC-12-5: 회차가 없으면 빈 창가', () => {
        const view = toWindowView([]);
        assert.deepEqual(view, { kind: 'empty' });
        assert.equal(windowCopy(view), '지금 진행 중인 편지가 없어요');
    });

    it('AC-12-1: 편지 도착 → 어두운 창문 문구', () => {
        assert.equal(windowCopy(toWindowView([row({ status: 'arrived' })])), '편지가 서점에 도착했어요');
    });

    it('AC-12-2·6: 읽는 중 → 촛불 문구', () => {
        assert.equal(windowCopy(toWindowView([row({ status: 'reading' })])), '책방지기가 당신의 편지를 읽고 있어요');
    });

    it('AC-12-3: 발송됨 → 우체통 불빛 문구와 힌트', () => {
        const view = toWindowView([row({ status: 'shipped', teaser: '바다 냄새' })]);
        assert.deepEqual(view, { kind: 'shipped', roundId: 'r1', teaser: '바다 냄새' });
        assert.equal(windowCopy(view), '책이 서점 문을 나섰습니다');
    });

    it('AC-11-8: 결제 대기 회차', () => {
        assert.equal(windowCopy(toWindowView([row({ status: 'pending_payment' })])), '아직 결제가 끝나지 않았어요');
    });

    it('진행 중 회차가 지난 발송 회차보다 먼저 보인다(INV-12)', () => {
        const view = toWindowView([row({ id: 'old', status: 'shipped' }), row({ id: 'now', status: 'arrived' })]);
        assert.equal(view.kind === 'arrived' && view.roundId, 'now');
    });

    it('언박싱·취소된 회차만 있으면 빈 창가', () => {
        assert.deepEqual(toWindowView([row({ status: 'unboxed' }), row({ status: 'cancelled' })]), { kind: 'empty' });
    });

    it('AC-12-7: 취소 요청 표시가 있는 읽는 중 회차는 촛불 그대로 + "취소 요청 중"', () => {
        const view = toWindowView([row({ status: 'reading', cancelRequestedAt: '2026-10-22T00:00:00Z' })]);
        assert.equal(view.kind, 'reading');
        assert.equal(windowNotice(view), '취소 요청 중');
    });

    it('AC-20-6: 거절된 회차는 거절 안내', () => {
        const view = toWindowView([row({ status: 'arrived', cancelRejectedAt: '2026-10-22T00:00:00Z' })]);
        assert.equal(windowNotice(view), CANCEL_REJECTED_MESSAGE);
    });

    it('AC-12-4: 어떤 문구에도 택배사·운송장·단계 숫자가 없다', () => {
        for (const view of [toWindowView([]), toWindowView([row({ status: 'arrived' })]), toWindowView([row({ status: 'shipped' })])]) {
            assert.doesNotMatch(windowCopy(view), /택배|운송장|\d/);
        }
    });
});
