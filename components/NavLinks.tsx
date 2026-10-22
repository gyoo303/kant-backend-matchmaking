'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
    href: string;
    label: string;
    count?: number; // 장바구니 개수 (AC-07-1)
}

const ITEM_CLASS =
    'inline-flex min-h-11 items-center rounded-lg px-2 whitespace-nowrap hover:bg-muted aria-[current=page]:bg-secondary md:px-3';

function isCurrent(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItemContent({ item }: { item: NavItem }) {
    return (
        <>
            {item.label}
            {item.count !== undefined && item.count > 0 && (
                <span
                    aria-label={`담은 책 ${item.count}권`}
                    className="bg-primary text-primary-foreground ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-sm leading-none"
                >
                    {item.count}
                </span>
            )}
        </>
    );
}

// 지금 화면의 메뉴에 aria-current="page" + --secondary 바탕 (UX-3)
export function NavLinks({ items }: { items: NavItem[] }) {
    const pathname = usePathname();
    return items.map((item) => (
        <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
            className={ITEM_CLASS}
        >
            <NavItemContent item={item} />
        </Link>
    ));
}

// 주소를 아직 모를 때(Cache Components 사전 렌더링) 쓰는 같은 모양의 링크. 현재 표시만 없다.
export function StaticNavLinks({ items }: { items: NavItem[] }) {
    return items.map((item) => (
        <Link key={item.href} href={item.href} className={ITEM_CLASS}>
            <NavItemContent item={item} />
        </Link>
    ));
}
