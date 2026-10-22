import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { readSupabasePublicEnv } from './env';

// 요청마다 새로 만든다. 로그인한 회원의 세션(쿠키)으로 RLS가 적용된다.
export async function createClient() {
    const { url, publishableKey } = readSupabasePublicEnv();
    const cookieStore = await cookies();

    return createServerClient<Database>(url, publishableKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                } catch {
                    // Server Component에서는 쿠키를 쓸 수 없어 여기로 온다(Supabase SSR 가이드).
                    // 세션 갱신 쿠키는 proxy.ts(TKT-BE-M2-01)가 응답에 쓰므로 무시해도 된다.
                }
            },
        },
    });
}

// 세션 없는 공개 조회용(anon 권한). 'use cache' 안에서는 cookies()를 못 쓰므로 공개 데이터는 이 클라이언트로 읽는다(CONV-07).
export function createPublicClient() {
    const { url, publishableKey } = readSupabasePublicEnv();
    return createSupabaseClient<Database>(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}
