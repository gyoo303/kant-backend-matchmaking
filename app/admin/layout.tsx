import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminBar } from '@/components/AdminBar';
import { requireKeeper } from '@/lib/auth/guards';

export const metadata: Metadata = { title: { default: '책방지기 서재', template: '%s · 책방지기 서재' } };

// 책방지기가 아니면 notFound() — 관리자 화면이 있다는 것도 드러내지 않는다 (AC-06-5, NFR-06).
// 그래서 관리자 바도 확인이 끝난 뒤에만 그린다. 세션을 읽으므로 <Suspense> 안 (CONV-07)
async function KeeperShell({ children }: { children: React.ReactNode }) {
    await requireKeeper();
    return (
        <div data-admin-shell className="flex flex-1 flex-col">
            <AdminBar />
            <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-8 md:py-10">{children}</main>
        </div>
    );
}

// 관리자 화면 공통: 상단 --primary 바, 본문 한 열 max-w-3xl (UX-18)
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
    return (
        <Suspense fallback={<div aria-busy="true" className="flex-1" />}>
            <KeeperShell>{children}</KeeperShell>
        </Suspense>
    );
}
