import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { openRound, saveRoundContents, shipRound } from '@/app/admin/desk/actions';
import { refund, rejectCancel } from '@/app/admin/orders/actions';
import { DeskContentsForm } from '@/components/DeskContentsForm';
import { formatDate } from '@/components/format-date';
import { KeeperOrderActions } from '@/components/KeeperOrderActions';
import { LetterPaper } from '@/components/LetterPaper';
import { ShipRoundForm } from '@/components/ShipRoundForm';
import { Badge } from '@/components/ui/badge';
import { UnboxingCode } from '@/components/UnboxingCode';
import { ROUND_STATUS_LABELS } from '@/domains/subscriptions/window-copy';
import { getProducts } from '@/lib/data/products';
import { getDeskRounds, getFarewellNotes, getKeeperRound } from '@/lib/data/rounds';
import { isUuid } from '@/shared/utils/uuid';

export const metadata: Metadata = { title: '서재 작업' };

const ROUND_CANCEL_ACTIONS = { refund, rejectCancel };

// 단계 번호 원 + 제목 (design-system §5 관리자 레이아웃: 서재 작업은 1·2·3으로 위→아래 순서)
function Step({ no, title, children }: { no: number; title: string; children: ReactNode }) {
    return (
        <section aria-labelledby={`desk-step-${no}`} className="mt-10 border-t pt-8">
            <h2 id={`desk-step-${no}`} className="font-heading flex items-center gap-3 text-xl font-bold">
                <span aria-hidden="true" className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-full font-sans text-sm font-normal">
                    {no}
                </span>
                {title}
            </h2>
            <div className="mt-5">{children}</div>
        </section>
    );
}

function StatusBadge({ label, cancel = false }: { label: string; cancel?: boolean }) {
    return (
        <Badge variant="secondary" className={`h-auto px-2.5 py-1 text-sm font-normal ${cancel ? 'bg-destructive-soft text-destructive-soft-foreground' : ''}`}>
            {label}
        </Badge>
    );
}

async function FarewellNotes() {
    let notes: Awaited<ReturnType<typeof getFarewellNotes>> | null = null;
    try {
        notes = await getFarewellNotes();
    } catch (error) {
        unstable_rethrow(error);
        console.error('[SCR-19] 작별 안부를 읽지 못함', error);
    }
    return (
        <section aria-labelledby="desk-farewell" className="mt-12 border-t pt-8">
            <h2 id="desk-farewell" className="font-heading text-xl font-bold">
                작별 안부
            </h2>
            {notes === null ? (
                <p role="status" className="text-muted-foreground mt-4">작별 안부를 불러오지 못했어요</p>
            ) : notes.length === 0 ? (
                <p className="text-muted-foreground mt-4">아직 남겨진 작별 안부가 없어요</p>
            ) : (
                <ul className="mt-4 border-t">
                    {notes.map((note) => (
                        <li key={note.subscriptionId} className="border-b py-4">
                            <p className="text-muted-foreground text-sm">{formatDate(note.createdAt)}</p>
                            <p className="mt-1 whitespace-pre-line">{note.body}</p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

// 화면 진입 때 고른 회차를 열고(API-17, arrived → reading, AC-13-2·3) 그 회차를 읽는다(SEQ-05)
async function loadSelectedRound(roundId: string) {
    const result = await openRound(roundId);
    if (!result.ok) console.error('[SCR-19] openRound', result.error.code);
    return getKeeperRound(roundId);
}

async function loadBooks() {
    try {
        return await getProducts();
    } catch (error) {
        unstable_rethrow(error);
        console.error('[SCR-19] 책 목록을 읽지 못함', error);
        return [];
    }
}

// ?round=<id>로 고른 회차를 보여 준다. 없으면 도착 순 첫 회차. 발송한 회차도 주소로 열면 같은 코드를 다시 본다 (AC-15-2)
async function Desk({ searchParams }: { searchParams: PageProps<'/admin/desk'>['searchParams'] }) {
    const query = await searchParams;
    const requested = typeof query.round === 'string' && isUuid(query.round) ? query.round : null;
    const rounds = await getDeskRounds();
    const selectedId = requested ?? rounds[0]?.id ?? null;
    const [round, books] = await Promise.all([selectedId ? loadSelectedRound(selectedId) : null, loadBooks()]);

    return (
        <>
            <Step no={1} title="편지 읽기">
                {rounds.length === 0 ? (
                    <p className="text-muted-foreground">지금 읽을 편지가 없어요</p>
                ) : (
                    // 결제 확정된 회차만(결제 대기는 없다, AC-13-4·INV-18), 도착 순
                    <ul className="border-t">
                        {rounds.map((item) => (
                            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
                                <Link
                                    href={`/admin/desk?round=${item.id}`}
                                    aria-current={item.id === round?.id ? 'true' : undefined}
                                    className="inline-flex min-h-11 items-center gap-2 rounded-lg aria-[current=true]:font-bold"
                                >
                                    {item.paidAt ? `${formatDate(item.paidAt)} 도착한 편지` : '도착한 편지'}
                                    {item.cancelRequested && <StatusBadge label="취소 요청" cancel />}
                                </Link>
                                {item.cancelRequested ? (
                                    <KeeperOrderActions targetId={item.id} kind="round" cancelRequested actions={ROUND_CANCEL_ACTIONS} />
                                ) : (
                                    <StatusBadge label={ROUND_STATUS_LABELS[item.status]} />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                {round && (
                    <LetterPaper label={`${round.shipping.recipientName} 님의 편지`} className="mt-6">
                        {round.letter}
                    </LetterPaper>
                )}
            </Step>

            {round && round.status !== 'shipped' && round.status !== 'unboxed' && (
                <>
                    <Step no={2} title="책 고르기와 답장">
                        <DeskContentsForm
                            key={round.id}
                            roundId={round.id}
                            books={books.map(({ id, name, author, stock }) => ({ id, name, author, stock }))}
                            savedProductId={round.product?.id ?? null}
                            savedReply={round.replyLetter}
                            postcardUrl={round.postcardUrl}
                            saveRoundContents={saveRoundContents}
                        />
                    </Step>
                    <Step no={3} title="힌트 쓰고 발송">
                        <ShipRoundForm
                            key={round.id}
                            roundId={round.id}
                            hasBook={round.product !== null}
                            hasReply={Boolean(round.replyLetter)}
                            cancelRequested={round.cancelRequested}
                            shipRound={shipRound}
                        />
                    </Step>
                </>
            )}
            {round && (round.status === 'shipped' || round.status === 'unboxed') && round.code && (
                <Step no={3} title="힌트 쓰고 발송">
                    <UnboxingCode code={round.code} />
                </Step>
            )}
        </>
    );
}

// SCR-19 서재 작업: 한 열, 좌우 분할 없음, 회차 하나를 열기→발송까지 다른 화면으로 가지 않는다 (AC-13-1, NFR-13)
export default function DeskPage({ searchParams }: PageProps<'/admin/desk'>) {
    return (
        <>
            <h1 className="font-heading text-3xl font-bold md:text-4xl">서재 작업</h1>
            <p className="text-muted-foreground mt-3">도착한 순서대로 위에서부터 처리해요.</p>
            <Suspense fallback={<p className="text-muted-foreground mt-8">편지를 꺼내 오는 중이에요.</p>}>
                <Desk searchParams={searchParams} />
            </Suspense>
            <Suspense fallback={null}>
                <FarewellNotes />
            </Suspense>
        </>
    );
}
