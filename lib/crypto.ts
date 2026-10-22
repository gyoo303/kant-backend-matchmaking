import 'server-only';
import { randomInt as nodeRandomInt, randomUUID } from 'node:crypto';

// 앱 쪽 난수는 이 파일에서만 만든다(AR-API §7). domains/는 이 함수를 인자로 받는다.

// [min, max) 범위의 암호학적 난수 정수 (언박싱 코드, SEQ-06)
export function randomInt(min: number, max: number): number {
    return nodeRandomInt(min, max);
}

// Storage 파일 이름용 uuid (book-covers `products/{product_id}/{uuid}.{ext}`, AR-DB §6)
export function randomUuid(): string {
    return randomUUID();
}
