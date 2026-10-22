import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateUnboxingCode } from './unboxing-code';

describe('generateUnboxingCode (INV-08)', () => {
    it('AC-15-1: 6자리 숫자 코드를 만든다', () => {
        assert.equal(generateUnboxingCode(() => 123456), '123456');
    });

    it('작은 수는 앞을 0으로 채워 6자리를 유지한다', () => {
        assert.equal(generateUnboxingCode(() => 42), '000042');
        assert.equal(generateUnboxingCode(() => 0), '000000');
        assert.equal(generateUnboxingCode(() => 999999), '999999');
    });

    it('주입받은 난수 함수에 [0, 1000000) 범위를 넘긴다', () => {
        const calls: [number, number][] = [];
        generateUnboxingCode((min, max) => {
            calls.push([min, max]);
            return 7;
        });
        assert.deepEqual(calls, [[0, 1_000_000]]);
    });

    it('범위 밖 값을 받으면 코드를 만들지 않는다', () => {
        assert.throws(() => generateUnboxingCode(() => 1_000_000), RangeError);
        assert.throws(() => generateUnboxingCode(() => 1.5), RangeError);
    });

    it('결정적 난수를 넣으면 매번 같은 코드(테스트 가능, AR-API §7)', () => {
        const seq = [1, 2, 3];
        const codes = seq.map((n) => generateUnboxingCode(() => n));
        assert.deepEqual(codes, ['000001', '000002', '000003']);
    });
});
