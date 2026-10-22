// 언박싱 코드 6자리 숫자(INV-08, SEQ-06). 난수는 인자로 받는다(AR-API §7) — 실제 주입원은 lib의 randomInt
export const UNBOXING_CODE_LENGTH = 6;
const CODE_SPACE = 10 ** UNBOXING_CODE_LENGTH;

export type RandomInt = (min: number, max: number) => number; // [min, max)

export function generateUnboxingCode(randomInt: RandomInt): string {
    const value = randomInt(0, CODE_SPACE);
    if (!Number.isInteger(value) || value < 0 || value >= CODE_SPACE) {
        throw new RangeError(`randomInt가 범위 밖의 값을 돌려줬어요: ${value}`);
    }
    return String(value).padStart(UNBOXING_CODE_LENGTH, '0');
}

// 코드가 겹치면(CODE_COLLISION) 새 코드로 다시 부르는 최대 횟수(SEQ-06)
export const CODE_COLLISION_RETRIES = 3;
