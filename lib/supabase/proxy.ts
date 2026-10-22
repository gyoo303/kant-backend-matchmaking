import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { readSupabasePublicEnv } from './env';

// 모든 요청에서 세션 쿠키를 갱신한다(Supabase SSR 가이드, ADR-003). 반환한 response를 그대로 돌려줘야 쿠키가 유지된다.
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; isSignedIn: boolean }> {
    let response = NextResponse.next({ request });
    const { url, publishableKey } = readSupabasePublicEnv();

    const supabase = createServerClient<Database>(url, publishableKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
            },
        },
    });

    // createServerClient와 getClaims 사이에 다른 코드를 넣지 않는다(세션이 무작위로 끊기는 문제 방지).
    const { data } = await supabase.auth.getClaims();
    return { response, isSignedIn: Boolean(data?.claims?.sub) };
}
