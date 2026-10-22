import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { retryPayment } from '@/app/checkout/actions';
import { PostedLetter } from '@/components/PostedLetter';
import { RetryPaymentButton, type RetryTarget } from '@/components/RetryPaymentButton';
import { OUTLINE_BUTTON } from '@/components/button-styles';
import { buttonVariants } from '@/components/ui/button';
import { WINDOW_COPY } from '@/domains/subscriptions/window-copy';
import { requireMember } from '@/lib/auth/guards';
import { getMyOrder } from '@/lib/data/orders';
import { formatPrice } from '@/shared/utils/formatPrice';
import { isUuid } from '@/shared/utils/uuid';

export const metadata: Metadata = { title: '결제 결과' };

const PAYMENT_INCOMPLETE = '결제가 완료되지 않았어요'; // REJ-15
const AMOUNT_MISMATCH = '결제 금액이 맞지 않아 결제를 취소했어요'; // REJ-56, AC-08-8
const CONTACT_US = '결제 취소를 마치지 못했어요. 번거로우시겠지만 책방으로 문의해 주세요.'; // SEQ-03 6 보상 실패

const OUTLINE = buttonVariants({ variant: 'ghost', className: OUTLINE_BUTTON });
const PRIMARY = buttonVariants({ className: 'h-11 px-5 text-base' });

type ResultQuery = { status?: string; code?: string; target?: string; id?: string; contact?: string };

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

// API-09·10이 보내는 쿼리 → 결제 대상. 형식이 틀리면 대상 없음으로 본다
function readTarget(query: ResultQuery): RetryTarget | null {
    if (!query.id || !isUuid(query.id)) return null;
    if (query.target === 'order') return { kind: 'order', orderId: query.id };
    if (query.target === 'round') return { kind: 'round', roundId: query.id };
    return null;
}

async function OrderSucceeded({ orderId }: { orderId: string }) {
    // 본인 주문만 읽힌다(남의 주문이면 null, AC-09-4). 번호를 못 읽어도 접수 안내는 보인다
    const order = await getMyOrder(orderId);
    return (
        <>
            <h1 className="font-heading text-3xl font-bold md:text-4xl">주문을 받았어요</h1>
            <p className="text-muted-foreground mt-3 text-lg">책방지기가 곧 포장해 보내드려요.</p>
            {order && (
                <dl className="bg-card mt-8 flex flex-col gap-2 rounded-lg border p-6">
                    <div className="flex gap-5">
                        <dt className="text-muted-foreground">주문 번호</dt>
                        <dd>{order.orderNumber}</dd>
                    </div>
                    <div className="flex gap-5">
                        <dt className="text-muted-foreground">결제 금액</dt>
                        <dd>{formatPrice(order.totalAmount)}</dd>
                    </div>
                </dl>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/mypage/orders" className={PRIMARY}>
                    주문 현황 보기
                </Link>
                <Link href="/products" className={OUTLINE}>
                    테마 서가 둘러보기
                </Link>
            </div>
        </>
    );
}

// 편지 회차 결제 성공: 이때만 봉투가 우체통에 들어가는 전환 (D-041, AC-11-2)
function RoundSucceeded() {
    return (
        <>
            <h1 className="font-heading text-3xl font-bold md:text-4xl">편지를 띄웠어요</h1>
            <PostedLetter copy={WINDOW_COPY.arrived} />
        </>
    );
}

function failureDetail(code: string | undefined, target: RetryTarget | null): string {
    if (code === 'AMOUNT_MISMATCH') return AMOUNT_MISMATCH;
    // 확정 직전 재고 부족: 주문은 확정되지 않고 결제는 취소 (AC-08-5)
    if (code === 'OUT_OF_STOCK') return '결제하는 사이 품절된 책이 있어 주문을 확정하지 못했어요. 결제는 취소했어요.';
    if (target?.kind === 'round') return '편지는 그대로 있어요. 준비되면 다시 결제해 주세요.';
    return '장바구니는 그대로 있어요. 준비되면 다시 결제해 주세요.';
}

// 결제 미완료: 주문은 결제 대기, 장바구니 그대로, [다시 결제하기] (AC-08-4). 재고 부족이면 다시 결제 대신 장바구니로 (AC-08-5)
function PaymentFailed({ code, contact, target }: { code: string | undefined; contact: boolean; target: RetryTarget | null }) {
    const canRetry = target !== null && code !== 'OUT_OF_STOCK';
    const backHref = target?.kind === 'round' ? '/letters/new' : '/cart';
    const backLabel = target?.kind === 'round' ? '편지지로 가기' : '장바구니로 가기';
    return (
        <>
            <h1 className="font-heading text-3xl font-bold md:text-4xl">{PAYMENT_INCOMPLETE}</h1>
            <p role="status" className="text-muted-foreground mt-3 text-lg">
                {failureDetail(code, target)}
            </p>
            {contact && (
                <p role="alert" className="bg-destructive-soft text-destructive-soft-foreground mt-6 rounded-lg px-4 py-3">
                    {CONTACT_US}
                </p>
            )}
            <div className="mt-8 flex flex-wrap items-start gap-3">
                {canRetry && <RetryPaymentButton target={target} retryPayment={retryPayment} />}
                <Link href={backHref} className={canRetry ? OUTLINE : PRIMARY}>
                    {backLabel}
                </Link>
            </div>
        </>
    );
}

// 쿼리는 요청마다 다르고, 주문 번호는 세션으로 읽으므로 <Suspense> 안 (CONV-07)
async function ResultContent({ searchParams }: { searchParams: PageProps<'/checkout/result'>['searchParams'] }) {
    const raw = await searchParams;
    const query: ResultQuery = {
        status: first(raw.status),
        code: first(raw.code),
        target: first(raw.target),
        id: first(raw.id),
        contact: first(raw.contact),
    };
    const target = readTarget(query);
    const resultPath = `/checkout/result?${new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => entry[1] !== undefined)).toString()}`;
    await requireMember(resultPath);

    if (query.status === 'ok' && target?.kind === 'order') return <OrderSucceeded orderId={target.orderId} />;
    if (query.status === 'ok' && target?.kind === 'round') return <RoundSucceeded />;
    return <PaymentFailed code={query.code} contact={query.contact === '1'} target={target} />;
}

// SCR-11 주문 완료 / 결제 미완료 (AC-08-1·4·5·8)
export default function CheckoutResultPage({ searchParams }: PageProps<'/checkout/result'>) {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8 md:py-16">
            <div className="max-w-xl">
                <Suspense fallback={<p className="text-muted-foreground">결제 결과를 확인하는 중이에요.</p>}>
                    <ResultContent searchParams={searchParams} />
                </Suspense>
            </div>
        </main>
    );
}
