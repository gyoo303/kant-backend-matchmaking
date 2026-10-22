import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { csvCell, shippingListFileName, toShippingCsv, type ShippingTargetRow } from './shipping-list';

const order: ShippingTargetRow = {
    kind: 'order',
    orderNumber: 'UB261022-0001',
    recipientName: '이연지',
    phone: '010-1234-5678',
    address: '대전 유성구 대학로 1, 101호',
    books: '숲의 시간을 걷다 x1',
};
const round: ShippingTargetRow = {
    kind: 'round',
    orderNumber: null,
    recipientName: '김독자',
    phone: '010-9999-0000',
    address: '서울 마포구 2',
    books: null,
};

describe('toShippingCsv (ADR-007)', () => {
    it('AC-19-1: UTF-8 BOM으로 시작하고 줄은 CRLF로 끝난다', () => {
        const csv = toShippingCsv([order]);
        assert.equal(csv.charCodeAt(0), 0xfeff);
        assert.ok(csv.endsWith('\r\n'));
        assert.equal(csv.split('\r\n').length, 3); // 머리글 + 1행 + 마지막 빈 줄
        assert.doesNotMatch(csv.replace(/\r\n/g, ''), /\n/);
    });

    it('AC-19-1: 열은 구분·번호·받는 사람·연락처·주소·책 순서, 주문 1건·회차 1건이 담긴다', () => {
        const [header, first, second] = toShippingCsv([order, round]).slice(1).split('\r\n');
        assert.equal(header, '구분,번호,받는 사람,연락처,주소,책');
        assert.equal(first, '주문,UB261022-0001,이연지,010-1234-5678,"대전 유성구 대학로 1, 101호",숲의 시간을 걷다 x1');
        assert.equal(second, '편지,,김독자,010-9999-0000,서울 마포구 2,');
    });

    it('AC-19-2: 0건이면 머리글만(화면은 파일 대신 안내를 보여 준다)', () => {
        assert.equal(toShippingCsv([]), '﻿구분,번호,받는 사람,연락처,주소,책\r\n');
    });
});

describe('csvCell', () => {
    it('따옴표는 두 번 쓰고 감싼다', () => {
        assert.equal(csvCell('책 "숲"'), '"책 ""숲"""');
    });

    it('줄바꿈이 있는 주소는 감싼다', () => {
        assert.equal(csvCell('1층\n2층'), '"1층\n2층"');
    });

    it('수식으로 읽힐 수 있는 값은 앞에 \'를 붙인다', () => {
        assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
        assert.equal(csvCell('+82'), "'+82");
    });
});

describe('shippingListFileName', () => {
    it('서울 날짜로 이름을 만든다', () => {
        assert.equal(shippingListFileName(new Date('2026-10-22T15:30:00Z')), 'shipping-list-20261023.csv');
        assert.equal(shippingListFileName(new Date('2026-10-22T01:00:00Z')), 'shipping-list-20261022.csv');
    });
});
