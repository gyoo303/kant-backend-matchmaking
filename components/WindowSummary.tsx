import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { WindowArt, type WindowArtState } from './WindowArt';

export type WindowSummaryKind = 'empty' | 'pending_payment' | 'arrived' | 'reading' | 'shipped';

// 결제 대기는 아직 서점에 닿지 않았으므로 빈 창가 그림을 쓴다
const ART_STATE: Record<WindowSummaryKind, WindowArtState> = {
    empty: 'empty',
    pending_payment: 'empty',
    arrived: 'arrived',
    reading: 'reading',
    shipped: 'shipped',
};

const NIGHT_OUTLINE_BUTTON =
    'border-night-border text-night-foreground hover:bg-night-foreground/10 inline-flex h-11 items-center rounded-lg border px-5';

// 마이페이지 창가 요약 (SCR-06): 밤 패널 안 창가 그림 + 상태 문구(그림 대체 텍스트와 같음, NFR-11) + 다음 행동 하나
// 구독 없음(빈 창가)이면 [편지 띄우기], 그 밖에는 [창가로 가기] (AC-12-5)
export function WindowSummary({ kind, copy }: { kind: WindowSummaryKind; copy: string }) {
    const empty = kind === 'empty';
    return (
        <section
            data-surface="night"
            aria-label="창가"
            className="bg-night text-night-foreground grid items-center gap-6 rounded-lg p-6 md:grid-cols-2 md:gap-8 md:p-8"
        >
            <div className="max-w-xs">
                <WindowArt state={ART_STATE[kind]} label={copy} />
            </div>
            <div>
                <p className="font-heading text-2xl leading-normal">
                    {copy}
                </p>
                {empty ? (
                    <Link href="/letters/new" className={buttonVariants({ className: 'bg-lamp text-lamp-foreground hover:bg-lamp/90 mt-5 h-11 px-5 text-base' })}>
                        편지 띄우기
                    </Link>
                ) : (
                    <Link href="/mypage/window" className={`${NIGHT_OUTLINE_BUTTON} mt-5`}>
                        창가로 가기
                    </Link>
                )}
            </div>
        </section>
    );
}
