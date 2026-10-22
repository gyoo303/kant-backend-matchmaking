import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Suspense } from 'react';
import { ADMIN_MENU } from '@/components/AdminBar';
import { MenuList } from '@/components/MenuList';
import { getKeeperCounts, type KeeperCounts } from '@/lib/data/admin';

const COUNT_TILES: { key: keyof KeeperCounts; label: string; href: string; action: string }[] = [
    { key: 'arrivedLetters', label: '도착한 편지', href: '/admin/desk', action: '서재 작업' },
    { key: 'ordersToShip', label: '발송 대기 주문', href: '/admin/orders', action: '주문 처리' },
    { key: 'cancelRequests', label: '취소 요청', href: '/admin/orders', action: '주문 처리' },
];

async function loadCounts(): Promise<KeeperCounts | null> {
    try {
        return await getKeeperCounts();
    } catch (error) {
        unstable_rethrow(error);
        console.error('[SCR-20] 오늘 할 일 수를 읽지 못함', error);
        return null;
    }
}

// 숫자 상자 3개. 0건이어도 숨기지 않는다. 상자 전체가 해당 화면 링크 (UX-PLAN-FE screens §SCR-20)
async function TodayCounts() {
    const counts = await loadCounts();
    return (
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {COUNT_TILES.map((tile) => (
                <li key={tile.key}>
                    <Link href={tile.href} className="bg-card hover:border-input flex h-full flex-col rounded-lg border p-5">
                        <span className="text-muted-foreground">{tile.label}</span>
                        <span className="font-heading mt-2 text-4xl leading-none">
                            {counts ? counts[tile.key] : '–'}
                            <span className="sr-only">건</span>
                        </span>
                        <span className="mt-3 text-sm underline underline-offset-4">{tile.action}</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

// SCR-20 관리자 홈: 오늘 할 일 수 → 메뉴 3개
export default function AdminHomePage() {
    return (
        <>
            <h1 className="font-heading text-3xl font-bold md:text-4xl">오늘 할 일</h1>
            <Suspense fallback={<p className="text-muted-foreground mt-6">할 일을 세는 중이에요.</p>}>
                <TodayCounts />
            </Suspense>
            <MenuList label="관리자 메뉴" className="mt-10" items={ADMIN_MENU} />
        </>
    );
}
