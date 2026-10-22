import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/shared/utils/safe-next-path';

// API-24: 소셜 로그인 콜백(SEQ-01 2). 성공하면 next(내부 경로만), 실패·취소면 /login?error=1 (AC-05-5)
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const next = safeNextPath(searchParams.get('next'));

    if (!code) {
        // 제공자 화면에서 취소하면 code 없이 error 파라미터로 돌아온다
        console.error('[API-24] code 없음', searchParams.get('error'), searchParams.get('error_description'));
        return NextResponse.redirect(new URL('/login?error=1', request.url));
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
        console.error('[API-24] exchangeCodeForSession', error.message);
        return NextResponse.redirect(new URL('/login?error=1', request.url));
    }
    return NextResponse.redirect(new URL(next, request.url));
}
