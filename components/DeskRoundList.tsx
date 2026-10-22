import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { DeskRound } from '@/domains/subscriptions/types/round.types';
import { ROUND_STATUS_LABELS } from '@/domains/subscriptions/window-copy';
import { formatDate } from './format-date';
import { KeeperOrderActions, type KeeperOrderActionSet } from './KeeperOrderActions';

export function DeskStatusBadge({ label, cancel = false }: { label: string; cancel?: boolean }) {
    return (
        <Badge variant="secondary" className={`h-auto px-2.5 py-1 text-sm font-normal ${cancel ? 'bg-destructive-soft text-destructive-soft-foreground' : ''}`}>
            {label}
        </Badge>
    );
}

// 서재 작업 ① 회차 목록 (SCR-19): "<받는 사람> 님의 편지" + 도착일 + 상태 배지. 결제 확정된 회차만, 도착 순 (AC-13-4, INV-18).
// 취소 요청 회차는 [환불]·[취소 거절] (AC-20-*). 환불·거절 액션은 화면이 넘긴다
export function DeskRoundList({
    rounds,
    selectedId,
    cancelActions,
}: {
    rounds: DeskRound[];
    selectedId: string | null;
    cancelActions: KeeperOrderActionSet;
}) {
    if (rounds.length === 0) return <p className="text-muted-foreground">지금 읽을 편지가 없어요</p>;
    return (
        <ul className="border-t">
            {rounds.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
                    <Link
                        href={`/admin/desk?round=${item.id}`}
                        aria-current={item.id === selectedId ? 'true' : undefined}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg aria-[current=true]:font-bold"
                    >
                        {item.recipientName} 님의 편지
                        {item.paidAt && <span className="text-muted-foreground text-sm font-normal">{formatDate(item.paidAt)} 도착</span>}
                        {item.cancelRequested && <DeskStatusBadge label="취소 요청" cancel />}
                    </Link>
                    {item.cancelRequested ? (
                        <KeeperOrderActions targetId={item.id} kind="round" cancelRequested actions={cancelActions} />
                    ) : (
                        <DeskStatusBadge label={ROUND_STATUS_LABELS[item.status]} />
                    )}
                </li>
            ))}
        </ul>
    );
}
