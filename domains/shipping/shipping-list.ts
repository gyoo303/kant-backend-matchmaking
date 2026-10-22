// 주소록 CSV (ADR-007, SEQ-11). Excel에서 한글이 깨지지 않게 UTF-8 BOM + CRLF로 만든다(AC-19-1)
export type ShippingTargetRow = {
    kind: 'order' | 'round';
    orderNumber: string | null;
    recipientName: string;
    phone: string;
    address: string;
    books: string | null;
};

export const SHIPPING_LIST_HEADERS = ['구분', '번호', '받는 사람', '연락처', '주소', '책'] as const;
export const SHIPPING_LIST_EMPTY_MESSAGE = '지금 보낼 책이 없어요'; // AC-19-2·4
export const SHIPPING_LIST_NOTICE = '내려받은 파일은 발송 후 지워 주세요'; // ADR-007, A-11

const BOM = '﻿';
const CRLF = '\r\n';
const KIND_LABELS: Record<ShippingTargetRow['kind'], string> = { order: '주문', round: '편지' };

// 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싸고, 수식으로 읽힐 수 있는 값(=,+,-,@로 시작)은 앞에 '를 붙인다
export function csvCell(value: string): string {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toShippingCsv(rows: readonly ShippingTargetRow[]): string {
    const lines = [
        SHIPPING_LIST_HEADERS.join(','),
        ...rows.map((row) =>
            [KIND_LABELS[row.kind], row.orderNumber ?? '', row.recipientName, row.phone, row.address, row.books ?? '']
                .map(csvCell)
                .join(','),
        ),
    ];
    return BOM + lines.join(CRLF) + CRLF;
}

// 파일 이름: shipping-list-YYYYMMDD.csv (서울 날짜). 시간은 인자로 받는다(AR-API §7)
export function shippingListFileName(now: Date): string {
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now).replace(/-/g, '');
    return `shipping-list-${ymd}.csv`;
}
