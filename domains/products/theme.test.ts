import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { products } from '@/data/products';
import { THEMES } from '@/types/product';
import { parseTheme } from './theme';

describe('parseTheme — 주소의 테마 값', () => {
    it('AC-02-2: 4개 테마 값은 그대로 Theme이 된다', () => {
        for (const theme of THEMES) assert.equal(parseTheme(theme), theme);
    });

    it('AC-02-5: 잘못된 값 abc는 오류 없이 undefined(전체 목록)', () => {
        assert.equal(parseTheme('abc'), undefined);
    });

    it('AC-02-5: 값이 없거나 빈 문자열이면 undefined', () => {
        assert.equal(parseTheme(undefined), undefined);
        assert.equal(parseTheme(''), undefined);
    });

    it('AC-02-5: 대소문자가 다르거나 앞뒤 공백이 있으면 전체 목록', () => {
        assert.equal(parseTheme('Food'), undefined);
        assert.equal(parseTheme(' food'), undefined);
    });

    it('AC-02-5: 같은 키가 여러 번 오면 첫 값만 본다', () => {
        assert.equal(parseTheme(['local', 'food']), 'local');
        assert.equal(parseTheme(['abc', 'food']), undefined);
        assert.equal(parseTheme([]), undefined);
    });

    it('NFR-16: Mock 책의 테마는 모두 parseTheme으로 읽힌다', () => {
        for (const product of products) assert.equal(parseTheme(product.theme), product.theme);
    });
});
