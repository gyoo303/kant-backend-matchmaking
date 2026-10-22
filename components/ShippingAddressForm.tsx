'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { readShippingValues, SHIPPING_FIELD_NAMES, ShippingFields, shippingErrors, type ShippingValues } from './ShippingFields';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type SaveResult = { ok: true } | { ok: false; error: { message: string; fieldErrors?: Record<string, string> } };

const SAVED_MESSAGE = '저장했어요';

// 기본 배송지 저장 폼 (SCR-07). 저장 액션(app/mypage/address/actions의 saveShippingAddress)은 화면이 넘긴다
export function ShippingAddressForm({
    defaults,
    saveShippingAddress,
}: {
    defaults: ShippingValues | null;
    saveShippingAddress: (input: ShippingValues) => Promise<SaveResult>;
}) {
    const formRef = useRef<HTMLFormElement>(null);
    const [pending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<{ tone: 'status' | 'alert'; text: string } | null>(null);

    function showErrors(fieldErrors: Record<string, string>) {
        setErrors(fieldErrors);
        const first = SHIPPING_FIELD_NAMES.find((name) => fieldErrors[name]);
        if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const values = readShippingValues(event.currentTarget);
        setMessage(null);
        const local = shippingErrors(values);
        if (Object.keys(local).length > 0) {
            showErrors(local);
            return;
        }
        startTransition(async () => {
            const result = await saveShippingAddress(values);
            if (result.ok) {
                setErrors({});
                setMessage({ tone: 'status', text: SAVED_MESSAGE });
                return;
            }
            showErrors(result.error.fieldErrors ?? {});
            setMessage({ tone: 'alert', text: result.error.message });
        });
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-8">
            <ShippingFields defaults={defaults} errors={errors} idPrefix="address" />
            <Button type="submit" disabled={pending} className="mt-6 h-11 px-6 text-base">
                {pending ? '저장하는 중이에요' : '저장'}
            </Button>
            <p role={message?.tone === 'alert' ? 'alert' : 'status'} className={`mt-3 min-h-6 ${message?.tone === 'alert' ? 'text-destructive' : ''}`}>
                {message?.text}
            </p>
        </form>
    );
}
