import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    checkPostcardFile,
    farewellInputSchema,
    letterInputSchema,
    memoInputSchema,
    POSTCARD_MAX_BYTES,
    shipRoundInputSchema,
    unboxInputSchema,
} from './subscription.schema';

const ROUND_ID = 'b0000000-0000-4000-8000-000000000001';
const shipping = { recipientName: '이연지', phone: '010-1234-5678', address: '대전 유성구 1' };

describe('편지 구독 입력 한도 (D-025)', () => {
    it('AC-11-5: 편지 9자·2,001자는 거부, 10자·2,000자는 통과', () => {
        assert.equal(letterInputSchema.safeParse({ body: 'a'.repeat(9), shipping }).success, false);
        assert.equal(letterInputSchema.safeParse({ body: 'a'.repeat(2001), shipping }).success, false);
        assert.equal(letterInputSchema.safeParse({ body: 'a'.repeat(10), shipping }).success, true);
        assert.equal(letterInputSchema.safeParse({ body: 'a'.repeat(2000), shipping }).success, true);
    });

    it('AC-11-5: 앞뒤 공백은 글자 수에 넣지 않는다(create_round와 같은 btrim)', () => {
        assert.equal(letterInputSchema.safeParse({ body: `   ${'a'.repeat(9)}   `, shipping }).success, false);
    });

    it('AC-15-3: 힌트가 비면 발송 입력이 거부된다', () => {
        assert.equal(shipRoundInputSchema.safeParse({ roundId: ROUND_ID, teaser: '   ' }).success, false);
        assert.equal(shipRoundInputSchema.safeParse({ roundId: ROUND_ID, teaser: 'a'.repeat(101) }).success, false);
        assert.equal(shipRoundInputSchema.safeParse({ roundId: ROUND_ID, teaser: '바다 냄새가 나는 책' }).success, true);
    });

    it('AC-16-5: 5자리·문자 코드는 거부', () => {
        assert.equal(unboxInputSchema.safeParse({ roundId: ROUND_ID, code: '12345' }).success, false);
        assert.equal(unboxInputSchema.safeParse({ roundId: ROUND_ID, code: '12a456' }).success, false);
        assert.equal(unboxInputSchema.safeParse({ roundId: ROUND_ID, code: '012345' }).success, true);
    });

    it('AC-17-4: 메모 101자는 거부, 100자는 통과', () => {
        assert.equal(memoInputSchema.safeParse({ roundId: ROUND_ID, body: 'a'.repeat(101) }).success, false);
        assert.equal(memoInputSchema.safeParse({ roundId: ROUND_ID, body: 'a'.repeat(100) }).success, true);
    });

    it('AC-18-5: 작별 안부 1,001자는 거부, 빈 안부는 허용', () => {
        assert.equal(farewellInputSchema.safeParse({ note: 'a'.repeat(1001) }).success, false);
        const empty = farewellInputSchema.safeParse({});
        assert.equal(empty.success && empty.data.note, '');
    });

    it('AC-14-3: 11MB 이미지·PDF 엽서는 거부', () => {
        const big = new File([new Uint8Array(POSTCARD_MAX_BYTES + 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
        assert.equal(checkPostcardFile(big).ok, false);
        assert.equal(checkPostcardFile(new File(['x'], 'a.pdf', { type: 'application/pdf' })).ok, false);
        assert.equal(checkPostcardFile(new File(['x'], 'a.webp', { type: 'image/webp' })).ok, true);
        assert.deepEqual(checkPostcardFile(null), { ok: true, file: null });
    });
});
