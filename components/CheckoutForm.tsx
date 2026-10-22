'use client';

import { useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/shared/utils/formatPrice';
import { readShippingValues, SHIPPING_FIELD_NAMES, ShippingFields, shippingErrors, type ShippingValues } from './ShippingFields';
import { openTossPayment, type TossPaymentRequest } from './toss-payment';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type StartResult = { ok: true; data: TossPaymentRequest } | { ok: false; error: { message: string; fieldErrors?: Record<string, string> } };

// 주문서 (SCR-10): [주문할 책 → 받는 곳 | 합계 + [결제하기]].
// 빈칸이면 결제창을 열지 않고 칸 아래에 이유 (AC-08-7, UX-15). 주문 액션(app/checkout/actions의 startOrderPayment)은 화면이 넘긴다
export function CheckoutForm({
    defaults,
    total,
    summary,
    startOrderPayment,
}: {
    defaults: ShippingValues | null;
    total: number;
    summary: ReactNode; // 주문할 책 목록 (서버에서 그림)
    startOrderPayment: (input: ShippingValues) => Promise<StartResult>;
}) {
    const formRef = useRef<HTMLFormElement>(null);
    const [pending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);

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
        setErrors({});
        startTransition(async () => {
            const result = await startOrderPayment(values);
            if (!result.ok) {
                showErrors(result.error.fieldErrors ?? {});
                setMessage(result.error.message);
                return;
            }
            // 결제창으로 넘어가면 돌아오지 않는다. 열지 못했을 때만 이유가 온다
            const problem = await openTossPayment(result.data);
            if (problem) setMessage(problem);
        });
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-8 grid items-start gap-8 md:grid-cols-3">
            <div className="md:col-span-2">
                <section aria-labelledby="checkout-items">
                    <h2 id="checkout-items" className="font-heading text-xl font-bold">
                        주문할 책
                    </h2>
                    {summary}
                </section>
                <section aria-labelledby="checkout-shipping" className="mt-10">
                    <h2 id="checkout-shipping" className="font-heading text-xl font-bold">
                        받는 곳
                    </h2>
                    {defaults && <p className="text-muted-foreground mt-1 text-sm">기본 배송지를 채워 두었어요</p>}
                    <div className="mt-4">
                        <ShippingFields defaults={defaults} errors={errors} idPrefix="checkout" />
                    </div>
                </section>
            </div>
            <aside aria-label="결제" className="bg-card rounded-lg border p-6">
                <dl className="flex items-baseline justify-between">
                    <dt className="text-muted-foreground">합계</dt>
                    <dd className="font-heading text-2xl">{formatPrice(total)}</dd>
                </dl>
                <p className="text-muted-foreground mt-2 text-sm">카드·간편결제 (테스트 결제)</p>
                <Button type="submit" disabled={pending} className="mt-5 h-13 w-full text-base">
                    {pending ? '결제창을 여는 중이에요' : '결제하기'}
                </Button>
                <p role="alert" className="text-destructive mt-3 min-h-6 text-sm">
                    {message}
                </p>
            </aside>
        </form>
    );
}
