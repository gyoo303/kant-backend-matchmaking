import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LoginButtons } from '@/components/LoginButtons';
import { getCurrentMember } from '@/lib/auth/guards';
import { safeNextPath } from '@/shared/utils/safe-next-path';

export const metadata: Metadata = { title: '로그인' };

// ?next=(로그인 후 돌아갈 내부 주소), ?error=1(취소·실패로 돌아옴, AC-05-5)을 읽는다. 이미 로그인했으면 next로 보낸다
async function LoginActions({ searchParams }: { searchParams: PageProps<'/login'>['searchParams'] }) {
    const params = await searchParams;
    const next = safeNextPath(typeof params.next === 'string' ? params.next : null);
    if (await getCurrentMember()) redirect(next);
    return <LoginButtons next={next} initialError={params.error === '1'} />;
}

// SCR-05 로그인: 환영 문구 → [카카오로 시작하기] → [네이버로 시작하기] (AC-05-1)
export default function LoginPage({ searchParams }: PageProps<'/login'>) {
    return (
        <main className="mx-auto w-full max-w-md px-4 py-10 md:py-16">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">반가워요</h1>
            <p className="text-muted-foreground mt-3 text-lg leading-relaxed">
                아이디나 비밀번호를 만들지 않아도 돼요. 쓰던 계정으로 바로 들어오세요.
            </p>
            <Suspense fallback={<div aria-busy="true" className="mt-8 h-29" />}>
                <LoginActions searchParams={searchParams} />
            </Suspense>
        </main>
    );
}
