import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { products } from '@/data/products';
import { checkCoverFile, COVER_MAX_BYTES, imageExtension, productInputSchema } from './product.schema';

const valid = {
    name: '숲의 시간',
    author: '김숲',
    price: '18000',
    theme: 'nature',
    description: '숲에서 보낸 한 해',
    keeperNote: '천천히 읽어 주세요',
    publisherDescription: '',
    stock: '3',
};

function fieldOf(input: Record<string, unknown>): Record<string, string> {
    const result = productInputSchema.safeParse(input);
    assert.equal(result.success, false);
    const fields: Record<string, string> = {};
    if (!result.success) for (const issue of result.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return fields;
}

describe('productInputSchema (API-04, ADR-008)', () => {
    it('AC-06-1: 필수 항목을 모두 넣으면 숫자로 바뀌고 출판사 소개 빈칸은 null', () => {
        const result = productInputSchema.safeParse(valid);
        assert.equal(result.success, true);
        if (result.success) {
            assert.equal(result.data.price, 18000);
            assert.equal(result.data.stock, 3);
            assert.equal(result.data.publisherDescription, null);
        }
    });

    it('AC-06-2: 재고 0은 저장할 수 있다(품절)', () => {
        assert.equal(productInputSchema.safeParse({ ...valid, stock: '0' }).success, true);
    });

    it('AC-06-4: 가격 -1000은 가격 칸에 이유가 붙는다', () => {
        assert.equal(fieldOf({ ...valid, price: '-1000' }).price, '0 이상으로 입력해 주세요.');
    });

    it('AC-06-4: 재고 1.5는 재고 칸에 이유가 붙는다', () => {
        assert.equal(fieldOf({ ...valid, stock: '1.5' }).stock, '소수는 넣을 수 없어요. 정수로 입력해 주세요.');
    });

    it('AC-06-4: 필수 항목 빈칸·숫자 아닌 값은 칸마다 이유가 붙는다', () => {
        const fields = fieldOf({ ...valid, name: '  ', price: '', stock: 'abc', theme: 'poem' });
        assert.equal(fields.name, '제목을 입력해 주세요.');
        assert.equal(fields.price, '가격을 입력해 주세요.');
        assert.equal(fields.stock, '숫자로 입력해 주세요.');
        assert.equal(fields.theme, '테마를 골라 주세요.');
    });

    it('짧은 설명 301자는 거부(products check와 같은 한도)', () => {
        assert.ok(fieldOf({ ...valid, description: 'a'.repeat(301) }).description);
    });

    it('Mock 8권(data/products.ts)은 모두 스키마를 통과한다', () => {
        for (const product of products) {
            const result = productInputSchema.safeParse({ ...product, publisherDescription: product.publisherDescription ?? '' });
            assert.equal(result.success, true, product.name);
        }
    });
});

describe('checkCoverFile', () => {
    it('새 책은 표지가 필수, 수정은 선택', () => {
        assert.deepEqual(checkCoverFile(null, true), { ok: false, message: '표지 이미지를 넣어 주세요.' });
        assert.deepEqual(checkCoverFile(new File([], 'empty.png', { type: 'image/png' }), false), { ok: true, file: null });
    });

    it('이미지가 아니거나 5MB를 넘으면 거부', () => {
        const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' });
        assert.equal(checkCoverFile(pdf, true).ok, false);
        const big = new File([new Uint8Array(COVER_MAX_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' });
        assert.equal(checkCoverFile(big, true).ok, false);
    });

    it('JPG·PNG·WEBP는 통과하고 확장자가 정해진다', () => {
        const png = new File(['x'], 'a.png', { type: 'image/png' });
        assert.equal(checkCoverFile(png, true).ok, true);
        assert.equal(imageExtension('image/png'), 'png');
        assert.equal(imageExtension('image/webp'), 'webp');
        assert.equal(imageExtension('image/jpeg'), 'jpg');
    });
});
