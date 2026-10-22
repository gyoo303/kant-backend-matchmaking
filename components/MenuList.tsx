import Link from 'next/link';
import type { ReactNode } from 'react';

export interface MenuListItem {
    href: string;
    label: string;
    meta?: string; // 오른쪽 흐린 글자 (예: "2건")
}

// 줄 높이 56px 링크 목록 (SCR-06 마이페이지, SCR-20 관리자 홈). children으로 버튼 줄(로그아웃·탈퇴)을 덧붙인다
export function MenuList({
    items,
    label,
    className = '',
    children,
}: {
    items: MenuListItem[];
    label: string;
    className?: string;
    children?: ReactNode;
}) {
    return (
        <nav aria-label={label} className={className}>
            <ul className="border-t">
                {items.map((item) => (
                    <li key={item.href} className="border-b">
                        <Link href={item.href} className="hover:bg-muted flex min-h-14 items-center justify-between gap-4 rounded-lg px-1">
                            <span>{item.label}</span>
                            {item.meta && <span className="text-muted-foreground text-sm">{item.meta}</span>}
                        </Link>
                    </li>
                ))}
                {children}
            </ul>
        </nav>
    );
}

// MenuList 안의 버튼 줄과 같은 모양 (로그아웃·탈퇴)
export const MENU_ROW_CLASS = 'hover:bg-muted flex min-h-14 w-full items-center rounded-lg px-1 text-left disabled:opacity-50';
