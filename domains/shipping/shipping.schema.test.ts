import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shippingInputSchema } from './shipping.schema';

const valid = { recipientName: '이연지', phone: '010-1234-5678', address: '대전 유성구 어딘가 1' };

describe('shippingInputSchema (API-06·07)', () => {
    it('AC-08-2: 받는 사람·연락처·주소가 있으면 통과(앞뒤 공백 제거)', () => {
        const result = shippingInputSchema.safeParse({ ...valid, recipientName: ' 이연지 ' });
        assert.equal(result.success && result.data.recipientName, '이연지');
    });

    it('AC-08-7: 빈칸이 하나라도 있으면 거부되고 그 칸에 이유가 붙는다', () => {
        for (const key of ['recipientName', 'phone', 'address'] as const) {
            const result = shippingInputSchema.safeParse({ ...valid, [key]: '  ' });
            assert.equal(result.success, false, key);
            if (!result.success) assert.equal(result.error.issues[0].path[0], key);
        }
    });

    it('연락처 형식(숫자·- 9~13자리)이 아니면 거부', () => {
        assert.equal(shippingInputSchema.safeParse({ ...valid, phone: '010-abcd' }).success, false);
        assert.equal(shippingInputSchema.safeParse({ ...valid, phone: '01012' }).success, false);
    });
});
