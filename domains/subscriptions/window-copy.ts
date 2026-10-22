import { CANCEL_REJECTED_MESSAGE } from '@/domains/orders/order';
import type { RoundStatus, WindowView } from './types/round.types';

// 창가 상태 문구 1곳(D-043). WindowScene 대체 텍스트도 이 문구를 쓴다(NFR-11)
export const WINDOW_COPY = {
    empty: '지금 진행 중인 편지가 없어요', // AC-12-5
    pending_payment: '아직 결제가 끝나지 않았어요', // AC-11-8
    arrived: '편지가 서점에 도착했어요', // AC-12-1
    reading: '책방지기가 당신의 편지를 읽고 있어요', // AC-12-2
    shipped: '책이 서점 문을 나섰습니다', // AC-12-3
} as const satisfies Record<WindowView['kind'], string>;

export const CANCEL_REQUESTED_BADGE = '취소 요청 중'; // AC-12-7
export const ROUND_IN_PROGRESS_COPY = '지금 책방지기가 편지를 준비하고 있어요'; // AC-11-4

// 회차 상태 이름(PM-DOMAIN §5.3). 상태를 안내할 때 쓴다(AC-20-7)
export const ROUND_STATUS_LABELS: Record<RoundStatus, string> = {
    pending_payment: '결제 대기',
    arrived: '편지 도착',
    reading: '읽는 중',
    shipped: '발송됨',
    unboxed: '언박싱됨',
    cancelled: '취소됨',
};

export function windowCopy(view: WindowView): string {
    return WINDOW_COPY[view.kind];
}

// 창가 아래에 덧붙는 안내(취소 요청 중 / 거절 안내). 없으면 null
export function windowNotice(view: WindowView): string | null {
    if (view.kind !== 'arrived' && view.kind !== 'reading') return null;
    if (view.cancelRequested) return CANCEL_REQUESTED_BADGE;
    if (view.cancelRejected) return CANCEL_REJECTED_MESSAGE;
    return null;
}

export type WindowRoundRow = {
    id: string;
    status: RoundStatus;
    teaser: string | null;
    cancelRequestedAt: string | null;
    cancelRejectedAt: string | null;
};

// 회원의 회차들 → 창가 하나. 진행 중 회차(결제 대기·도착·읽는 중, 회원당 1개 INV-12)를 먼저 보고,
// 없으면 아직 열지 않은 가장 최근 발송 회차, 그것도 없으면 빈 창가(AC-12-5). rows는 최신순
export function toWindowView(rows: readonly WindowRoundRow[]): WindowView {
    const inProgress = rows.find((row) => row.status === 'pending_payment' || row.status === 'arrived' || row.status === 'reading');
    if (inProgress) {
        if (inProgress.status === 'pending_payment') return { kind: 'pending_payment', roundId: inProgress.id };
        return {
            kind: inProgress.status === 'arrived' ? 'arrived' : 'reading',
            roundId: inProgress.id,
            cancelRequested: inProgress.cancelRequestedAt !== null,
            cancelRejected: inProgress.cancelRequestedAt === null && inProgress.cancelRejectedAt !== null,
        };
    }
    const shipped = rows.find((row) => row.status === 'shipped');
    if (shipped) return { kind: 'shipped', roundId: shipped.id, teaser: shipped.teaser ?? '' };
    return { kind: 'empty' };
}
