import type { Metadata } from 'next';
import { Gowun_Batang, Gowun_Dodum } from 'next/font/google';
import { unstable_rethrow } from 'next/navigation';
import { Suspense } from 'react';
import { ConfigNotice } from '@/components/ConfigNotice';
import { Footer } from '@/components/Footer';
import { AccountNav, AccountNavPending, Header, type HeaderAccount } from '@/components/Header';
import { getCurrentMember } from '@/lib/auth/guards';
import { getCartCount } from '@/lib/data/cart';
import './globals.css';

// 글꼴 한 쌍 (design-system §3, UX-D-01). 한글 글리프는 unicode-range 조각으로 필요한 만큼 받는다.
// preload를 켜면 조각 47개를 모든 화면에서 미리 받아 첫 화면이 느려진다(NFR-01). 그래서 끈다
const gowunBatang = Gowun_Batang({
    variable: '--font-gowun-batang',
    weight: ['400', '700'],
    subsets: ['latin'],
    display: 'swap',
    preload: false,
});

const gowunDodum = Gowun_Dodum({
    variable: '--font-gowun-dodum',
    weight: '400',
    subsets: ['latin'],
    display: 'swap',
    preload: false,
});

export const metadata: Metadata = {
    title: { default: '우분투북스', template: '%s · 우분투북스' },
    description: '대전 어은동 골목 안쪽의 작은 책방. 테마 서가에서 책을 고르고, 편지를 띄우면 책방지기가 책과 답장을 보내드려요.',
};

// AC-21-4: Supabase 공개 값이 없으면 화면을 멈추지 않고 안내한다. NEXT_PUBLIC_ 값은 빌드 때 문자열로 바뀐다
function missingPublicEnv(): string[] {
    const missing: string[] = [];
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    return missing;
}

async function loadHeaderAccount(): Promise<HeaderAccount | null> {
    const member = await getCurrentMember();
    if (!member) return null;
    return { isKeeper: member.role === 'keeper', cartCount: await getCartCount() };
}

// 세션(쿠키)을 읽는 부분만 따로 둔다 (CONV-07). 조회가 실패해도 Header 때문에 화면 전체가 깨지지 않게 비회원 메뉴로 보인다
async function SessionAccountNav({ configured }: { configured: boolean }) {
    let account: HeaderAccount | null = null;
    if (configured) {
        try {
            account = await loadHeaderAccount();
        } catch (error) {
            unstable_rethrow(error);
            console.error('[Header] 회원 정보를 읽지 못함', error);
        }
    }
    return <AccountNav account={account} />;
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
    const missing = missingPublicEnv();
    return (
        <html lang="ko" className={`${gowunBatang.variable} ${gowunDodum.variable} h-full antialiased`}>
            <body className="flex min-h-full flex-col break-keep wrap-break-word">
                {missing.length > 0 && <ConfigNotice missing={missing} />}
                <Header
                    account={
                        <Suspense fallback={<AccountNavPending />}>
                            <SessionAccountNav configured={missing.length === 0} />
                        </Suspense>
                    }
                />
                <div className="flex flex-1 flex-col">{children}</div>
                <Footer />
            </body>
        </html>
    );
}
