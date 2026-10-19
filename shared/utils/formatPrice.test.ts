import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPrice } from './formatPrice';

describe('formatPrice 유틸리티 함수 테스트', () => {
    it('숫자가 주어지면 3자리마다 콤마를 찍고 "원" 단위를 접미사로 붙여야 한다.', () => {
        const result = formatPrice(1500000);
        assert.strictEqual(result, '1,500,000원');
    });

    it('0원이 주어지면 "0원"으로 정상 포맷팅되어야 한다', () => {
        const result = formatPrice(0);
        assert.strictEqual(result, '0원');
    });

    it('음수 금액이 주어지면 마이너스 기호와 함께 정상 포맷팅되어야 한다', () => {
        const result = formatPrice(-5000);
        assert.strictEqual(result, '-5,000원');
    });
});
