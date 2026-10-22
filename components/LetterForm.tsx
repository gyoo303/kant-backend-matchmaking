'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { LETTER_MAX, LETTER_MIN } from '@/domains/subscriptions/subscription.schema';
import { formatPrice } from '@/shared/utils/formatPrice';
import { LetterArt, type LetterArtStage } from './LetterArt';
import { LetterPaper } from './LetterPaper';
import { readShippingValues, ShippingFields, shippingErrors, type ShippingValues } from './ShippingFields';
import { openTossPayment, type TossPaymentRequest } from './toss-payment';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type PostResult = { ok: true; data: TossPaymentRequest } | { ok: false; error: { message: string; fieldErrors?: Record<string, string> } };
type PostLetter = (input: { body: string; shipping: ShippingValues }) => Promise<PostResult>;

const ENVELOPE_CLOSE_MS = 700; // NFR-10 봉투 닫힘 ≤ 1s (globals.css --animate-envelope-close)

function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// 액션의 칸 이름(shipping.recipientName) → ShippingFields 칸 이름(recipientName)
function shippingFieldErrors(fieldErrors: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(fieldErrors)
            .filter(([key]) => key.startsWith('shipping.'))
            .map(([key, message]) => [key.slice('shipping.'.length), message]),
    );
}

// 편지지 (SCR-14): 편지지 한 장 + 글자 수 + 회차 상자(금액·받는 곳) + [우체통에 편지 넣기]. 체크박스·설문 없음 (AC-11-1)
// 누르면 봉투 닫힘 → 결제창. 우체통에 들어가는 전환은 결제 확정 뒤 결과 화면에서만 (AC-11-2, D-041)
export function LetterForm({ defaults, roundPrice, postLetter }: { defaults: ShippingValues | null; roundPrice: number; postLetter: PostLetter }) {
    const formRef = useRef<HTMLFormElement>(null);
    const [body, setBody] = useState('');
    const [editingAddress, setEditingAddress] = useState(defaults === null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [stage, setStage] = useState<LetterArtStage>('open');
    const [pending, startTransition] = useTransition();

    const length = body.trim().length;
    const lengthOk = length >= LETTER_MIN && length <= LETTER_MAX; // AC-11-5

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!lengthOk) return;
        const shipping = editingAddress || !defaults ? readShippingValues(event.currentTarget) : defaults;
        const local = shippingErrors(shipping);
        setMessage(null);
        if (Object.keys(local).length > 0) {
            setEditingAddress(true);
            setErrors(local);
            return;
        }
        setErrors({});
        // 봉투 닫힘은 누른 즉시 보여야 한다(NFR-10). transition 안에서 바꾸면 액션이 끝날 때까지 화면에 반영되지 않는다
        setStage('closed');
        startTransition(async () => {
            if (!prefersReducedMotion()) await new Promise((resolve) => setTimeout(resolve, ENVELOPE_CLOSE_MS));
            const result = await postLetter({ body, shipping });
            if (!result.ok) {
                setStage('open');
                const fieldErrors = shippingFieldErrors(result.error.fieldErrors ?? {});
                if (Object.keys(fieldErrors).length > 0) setEditingAddress(true);
                setErrors(fieldErrors);
                setMessage(result.error.fieldErrors?.body ?? result.error.message);
                return;
            }
            const problem = await openTossPayment(result.data);
            if (problem) {
                setStage('open');
                setMessage(problem);
            }
        });
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-8 grid items-start gap-8 md:grid-cols-3">
            <div className="md:col-span-2">
                <LetterPaper>
                    <label htmlFor="letter-body" className="sr-only">
                        책방지기에게 보내는 편지
                    </label>
                    <textarea
                        id="letter-body"
                        name="body"
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        maxLength={LETTER_MAX + 200}
                        aria-describedby="letter-count"
                        placeholder="책방지기님께,"
                        className="placeholder:text-muted-foreground min-h-56 w-full resize-y rounded-xs bg-transparent leading-loose outline-none"
                    />
                </LetterPaper>
                {/* 글자 수는 늘 보이고 입력할 때마다 바뀐다 (UX-10) */}
                <p id="letter-count" aria-live="polite" className={`mt-2 text-right text-sm ${lengthOk || length === 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
                    {length.toLocaleString('ko-KR')} / {LETTER_MAX.toLocaleString('ko-KR')}자
                    {length > 0 && length < LETTER_MIN && ` · ${LETTER_MIN}자 이상 써 주세요`}
                </p>

                <section aria-label="이번 편지 회차" className="bg-card mt-6 rounded-lg border p-6">
                    <div className="flex items-baseline justify-between gap-4">
                        <h2>이번 편지 회차</h2>
                        <p className="font-heading text-2xl">{formatPrice(roundPrice)}</p>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">책값과 배송비가 모두 들어 있어요. 책방지기가 책을 골라 답장과 함께 보내드려요.</p>
                    <div className="mt-5 border-t pt-5">
                        {editingAddress || !defaults ? (
                            <ShippingFields defaults={defaults} errors={errors} idPrefix="letter" />
                        ) : (
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-muted-foreground text-sm">받는 곳</p>
                                    <p className="mt-1">
                                        {defaults.recipientName} / {defaults.address}
                                    </p>
                                </div>
                                <Button type="button" variant="link" onClick={() => setEditingAddress(true)} className="h-11 px-1 text-base">
                                    바꾸기
                                </Button>
                            </div>
                        )}
                    </div>
                </section>

                <Button type="submit" disabled={!lengthOk || pending} className="mt-6 h-13 w-full text-base">
                    {pending ? '봉투를 닫는 중이에요' : '우체통에 편지 넣기'}
                </Button>
                <p role="alert" className="text-destructive mt-3 min-h-6 text-sm">
                    {message}
                </p>
            </div>
            {/* 장식 그림. 360px에서는 숨긴다 (UX-PLAN-FE screens §SCR-14) */}
            <div aria-hidden={stage === 'open'} className="bg-card hidden rounded-lg border p-6 md:block">
                <LetterArt stage={stage} label={stage === 'open' ? '편지 봉투와 우체통' : '봉투가 닫혔어요'} />
            </div>
        </form>
    );
}
