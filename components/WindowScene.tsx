import type { ReactNode } from 'react';
import { WindowArt, type WindowArtState } from './WindowArt';

export type WindowSceneKind = 'empty' | 'pending_payment' | 'arrived' | 'reading' | 'shipped';

// 결제 대기는 아직 서점에 닿지 않았으므로 빈 창가 그림을 쓴다
const ART_STATE: Record<WindowSceneKind, WindowArtState> = {
    empty: 'empty',
    pending_payment: 'empty',
    arrived: 'arrived',
    reading: 'reading',
    shipped: 'shipped',
};

// 밤 패널 안 버튼 모양: 등불 버튼(주요 행동 1개) / 밤 외곽선 버튼 (design-system §2·§5, UX-D-01: 등불색은 창가 패널 안에서만)
export const LAMP_BUTTON = 'bg-lamp text-lamp-foreground hover:bg-lamp/90 inline-flex h-11 items-center rounded-lg px-5';
export const NIGHT_OUTLINE_BUTTON =
    'border-night-border text-night-foreground hover:bg-night-foreground/10 inline-flex h-11 items-center rounded-lg border px-5 disabled:opacity-50';

// 창가 (design-system §5 WindowScene, UX-D-03): --night 패널 안 창가 그림 + 상태 문구(heading 24px).
// 그림의 대체 텍스트는 상태 문구와 같다(NFR-11, D-043). 768px 이상 좌우 2단, 360px 위아래. 상태별 버튼·안내는 children
export function WindowScene({ kind, copy, children, compact = false }: { kind: WindowSceneKind; copy: string; children?: ReactNode; compact?: boolean }) {
    return (
        <section
            data-surface="night"
            aria-label="창가"
            className={`bg-night text-night-foreground grid items-center gap-6 rounded-lg md:grid-cols-2 md:gap-8 ${compact ? 'p-6 md:p-8' : 'p-5 md:p-10'}`}
        >
            <div className={compact ? 'max-w-xs' : 'max-w-md'}>
                <WindowArt state={ART_STATE[kind]} label={copy} />
            </div>
            <div>
                <p role="status" className="font-heading text-2xl leading-normal">
                    {copy}
                </p>
                {children}
            </div>
        </section>
    );
}
