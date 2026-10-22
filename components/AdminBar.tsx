import Link from 'next/link';
import { Suspense } from 'react';
import { NavLinks, StaticNavLinks, type NavItem } from './NavLinks';

export const ADMIN_MENU: NavItem[] = [
    { href: '/admin/products', label: '책 관리' },
    { href: '/admin/orders', label: '주문 처리' },
    { href: '/admin/desk', label: '서재 작업' },
];

// 관리자 상단 바: --primary 바탕으로 회원 화면과 구분 (UX-18, design-system §5 관리자 레이아웃)
// "우분투북스"는 책방 화면으로, "책방지기 서재"는 관리자 홈으로 간다
export function AdminBar() {
    return (
        <header className="bg-primary text-primary-foreground">
            <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 md:px-8">
                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <Link href="/" className="font-heading rounded-lg text-xl font-bold">
                        우분투북스
                    </Link>
                    <Link href="/admin" className="rounded-lg text-sm opacity-80 hover:opacity-100">
                        책방지기 서재
                    </Link>
                </div>
                <nav aria-label="관리자 메뉴" className="flex items-center gap-1">
                    <Suspense fallback={<StaticNavLinks items={ADMIN_MENU} tone="admin" />}>
                        <NavLinks items={ADMIN_MENU} tone="admin" />
                    </Suspense>
                </nav>
            </div>
        </header>
    );
}
