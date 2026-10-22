import { z } from 'zod';

// ShippingInput (API-06·07·15). 한도는 shipping_addresses check·create_order 검사와 같다(AR-DB §3)
export const PHONE_PATTERN = /^[0-9-]{9,13}$/;

export const shippingInputSchema = z.object({
    recipientName: z
        .string({ error: '받는 사람을 입력해 주세요.' })
        .trim()
        .min(1, '받는 사람을 입력해 주세요.')
        .max(50, '받는 사람은 50자까지 쓸 수 있어요.'),
    phone: z
        .string({ error: '연락처를 입력해 주세요.' })
        .trim()
        .min(1, '연락처를 입력해 주세요.')
        .regex(PHONE_PATTERN, '연락처는 숫자와 -로 9~13자리를 입력해 주세요.'),
    address: z
        .string({ error: '주소를 입력해 주세요.' })
        .trim()
        .min(1, '주소를 입력해 주세요.')
        .max(200, '주소는 200자까지 쓸 수 있어요.'),
});

export type ShippingInput = z.infer<typeof shippingInputSchema>;
