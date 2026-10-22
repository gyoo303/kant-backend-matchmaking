import type { Metadata } from 'next';
import { Suspense } from 'react';
import { withdraw } from '@/app/mypage/actions';
import { AccountActions } from '@/components/AccountActions';
import { MenuList, type MenuListItem } from '@/components/MenuList';
import { WindowSummary } from '@/components/WindowSummary';
import { windowCopy } from '@/domains/subscriptions/window-copy';
import { requireMember } from '@/lib/auth/guards';
import { getSubscriptionState, getWindow } from '@/lib/data/rounds';

export const metadata: Metadata = { title: '마이페이지' };

// 구독이 없거나 마무리됐으면 "구독 마무리하기"를 두지 않는다 (AC-18-7)
function memberMenu(subscriptionActive: boolean): MenuListItem[] {
    return [
        { href: '/mypage/orders', label: '주문 현황' },
        { href: '/mypage/window', label: '창가' }, // D-042: 창가 화면(SCR-15)으로
        { href: '/mypage/shelf', label: '나의 서가' },
        { href: '/mypage/address', label: '기본 배송지' },
        ...(subscriptionActive ? [{ href: '/mypage/farewell', label: '구독 마무리하기' }] : []),
    ];
}

// 회원 확인 → 창가 요약 → 메뉴. 세션을 읽으므로 <Suspense> 안 (CONV-07). 비회원은 로그인 후 돌아온다 (AC-05-6)
async function MyPageContent() {
    await requireMember('/mypage');
    const [view, subscription] = await Promise.all([getWindow(), getSubscriptionState()]);

    return (
        <>
            <div className="mt-6">
                <WindowSummary kind={view.kind} copy={windowCopy(view)} />
            </div>
            <MenuList label="마이페이지 메뉴" className="mt-8" items={memberMenu(subscription.active)}>
                <AccountActions withdraw={withdraw} />
            </MenuList>
        </>
    );
}

// SCR-06 마이페이지 (AC-05-3)
export default function MyPage() {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-10">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">마이페이지</h1>
            <Suspense fallback={<p className="text-muted-foreground mt-6">창가를 살피는 중이에요.</p>}>
                <MyPageContent />
            </Suspense>
        </main>
    );
}
