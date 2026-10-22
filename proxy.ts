import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// 로그인이 필요한 화면(SEQ-01 4). 여기서는 낙관적으로 돌려보내기만 하고, 최종 판단은 페이지·액션의 가드가 한다.
const MEMBER_ONLY_PREFIXES = ['/mypage', '/cart', '/checkout', '/letters', '/admin'];

function isMemberOnly(pathname: string): boolean {
    return MEMBER_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
    let session: Awaited<ReturnType<typeof updateSession>>;
    try {
        session = await updateSession(request);
    } catch (error) {
        // env 누락(CONFIG_MISSING)이면 화면이 안내를 보여 줄 수 있게 그대로 통과시킨다(AC-21-4).
        console.error('[proxy] updateSession', error instanceof Error ? error.message : error);
        return NextResponse.next({ request });
    }

    const { pathname, search } = request.nextUrl;
    if (!session.isSignedIn && isMemberOnly(pathname)) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.search = '';
        loginUrl.searchParams.set('next', `${pathname}${search}`);
        return NextResponse.redirect(loginUrl);
    }
    return session.response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|covers/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
