import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { NavLinks, StaticNavLinks, type NavItem } from './NavLinks';

const MAIN_MENU: NavItem[] = [
    { href: '/products', label: '테마 서가' },
    { href: '/letters/new', label: '편지 띄우기' },
];

export interface HeaderAccount {
    isKeeper: boolean;
    cartCount: number;
}

// 장바구니·로그인/마이페이지(·서재). 비회원은 [로그인], 회원은 [마이페이지]와 개수, 책방지기는 [서재] 추가 (PM-SCR §2)
export function accountMenu(account: HeaderAccount | null): NavItem[] {
    if (!account) {
        return [
            { href: '/cart', label: '장바구니' },
            { href: '/login', label: '로그인' },
        ];
    }
    return [
        ...(account.isKeeper ? [{ href: '/admin', label: '서재' }] : []),
        { href: '/cart', label: '장바구니', count: account.cartCount },
        { href: '/mypage', label: '마이페이지' },
    ];
}

export function AccountNav({ account }: { account: HeaderAccount | null }) {
    const items = accountMenu(account);
    return (
        <Suspense fallback={<StaticNavLinks items={items} />}>
            <NavLinks items={items} />
        </Suspense>
    );
}

// 세션을 읽는 동안: 로그인 여부를 모르므로 [로그인]/[마이페이지] 자리는 비워 둔다(잘못된 메뉴가 잠깐 보이지 않게)
export function AccountNavPending() {
    return (
        <>
            <StaticNavLinks items={[{ href: '/cart', label: '장바구니' }]} />
            <span aria-hidden="true" className="inline-block h-11 w-20" />
        </>
    );
}

// 360px: 1줄 로고·장바구니·로그인, 2줄 테마 서가·편지 띄우기. 768px 이상 한 줄. 햄버거 없음 (UX-2, UX-D-02)
// account 자리는 세션을 읽으므로 layout이 <Suspense>로 감싸서 넘긴다 (CONV-07)
export function Header({ account }: { account: ReactNode }) {
    return (
        <header className="bg-background border-b">
            <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 md:px-8">
                <Link href="/" className="font-heading flex items-baseline gap-1.5 rounded-lg text-xl font-bold whitespace-nowrap">
                    우분투북스
                    <span className="text-muted-foreground hidden font-sans text-sm font-normal md:inline">대전 어은동</span>
                </Link>
                <nav
                    aria-label="주 메뉴"
                    className="order-last flex basis-full items-center gap-1 border-t py-1 md:order-none md:mr-auto md:ml-8 md:basis-auto md:border-t-0 md:py-0"
                >
                    <Suspense fallback={<StaticNavLinks items={MAIN_MENU} />}>
                        <NavLinks items={MAIN_MENU} />
                    </Suspense>
                </nav>
                <nav aria-label="내 메뉴" className="flex items-center gap-1">
                    {account}
                </nav>
            </div>
        </header>
    );
}
