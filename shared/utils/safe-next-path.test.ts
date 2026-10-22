import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { safeNextPath } from './safe-next-path';

describe('safeNextPath (SEQ-01 오픈 리다이렉트 방지)', () => {
    it('AC-05-2: 내부 경로는 그대로 돌아간다', () => {
        assert.equal(safeNextPath('/products/abc?x=1'), '/products/abc?x=1');
        assert.equal(safeNextPath('/mypage'), '/mypage');
    });

    it('AC-05-6: 값이 없으면 기본 경로', () => {
        assert.equal(safeNextPath(null), '/');
        assert.equal(safeNextPath(undefined), '/');
        assert.equal(safeNextPath(''), '/');
    });

    it('외부 주소·프로토콜 상대 주소·역슬래시 주소는 막는다', () => {
        assert.equal(safeNextPath('https://evil.com'), '/');
        assert.equal(safeNextPath('//evil.com'), '/');
        assert.equal(safeNextPath('/\\evil.com'), '/');
        assert.equal(safeNextPath('javascript:alert(1)'), '/');
    });

    it('제어 문자가 섞인 경로는 막는다', () => {
        assert.equal(safeNextPath('/\t/evil.com'), '/');
    });

    it('fallback을 바꿀 수 있다', () => {
        assert.equal(safeNextPath('https://evil.com', '/mypage'), '/mypage');
    });
});
