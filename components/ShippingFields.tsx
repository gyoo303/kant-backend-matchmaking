import { Input } from '@/components/ui/input';
import { shippingInputSchema, type ShippingInput } from '@/domains/shipping/shipping.schema';
import { fieldDescribedBy, FormField, INPUT_CLASS } from './FormField';

export type ShippingValues = ShippingInput;

// 첫 오류 칸으로 포커스를 옮길 때의 순서
export const SHIPPING_FIELD_NAMES = ['recipientName', 'phone', 'address'] as const;

// 받는 사람 → 연락처 → 주소 (SCR-07·10, 편지 띄우기 SCR-14도 같은 칸). 오류는 칸 바로 아래 (UX-15)
// errors 키는 ShippingInput 키 그대로(recipientName·phone·address)
export function ShippingFields({
    defaults,
    errors,
    idPrefix = 'shipping',
}: {
    defaults: ShippingValues | null;
    errors: Record<string, string>;
    idPrefix?: string;
}) {
    const id = (name: string) => `${idPrefix}-${name}`;
    return (
        <div className="flex flex-col gap-5">
            <FormField id={id('recipientName')} label="받는 사람" error={errors.recipientName}>
                <Input
                    id={id('recipientName')}
                    name="recipientName"
                    autoComplete="name"
                    maxLength={50}
                    defaultValue={defaults?.recipientName}
                    className={INPUT_CLASS}
                    {...fieldDescribedBy(id('recipientName'), false, errors.recipientName)}
                />
            </FormField>
            <FormField id={id('phone')} label="연락처" error={errors.phone}>
                <Input
                    id={id('phone')}
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={13}
                    placeholder="010-0000-0000"
                    defaultValue={defaults?.phone}
                    className={INPUT_CLASS}
                    {...fieldDescribedBy(id('phone'), false, errors.phone)}
                />
            </FormField>
            <FormField id={id('address')} label="주소" error={errors.address}>
                <Input
                    id={id('address')}
                    name="address"
                    autoComplete="street-address"
                    maxLength={200}
                    defaultValue={defaults?.address}
                    className={INPUT_CLASS}
                    {...fieldDescribedBy(id('address'), false, errors.address)}
                />
            </FormField>
        </div>
    );
}

// 폼에서 세 칸 값을 꺼낸다
export function readShippingValues(form: HTMLFormElement): ShippingValues {
    const data = new FormData(form);
    const text = (name: string) => {
        const value = data.get(name);
        return typeof value === 'string' ? value : '';
    };
    return { recipientName: text('recipientName'), phone: text('phone'), address: text('address') };
}

// 서버와 같은 스키마로 먼저 검사한다 (AC-08-7: 빈칸이면 결제창을 열지 않는다). 서버도 다시 검사한다
export function shippingErrors(values: ShippingValues): Record<string, string> {
    const parsed = shippingInputSchema.safeParse(values);
    if (parsed.success) return {};
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!(key in errors)) errors[key] = issue.message;
    }
    return errors;
}
