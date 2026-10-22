import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { readSupabasePublicEnv } from './env';

// service role 클라이언트: RLS를 건너뛴다. 엽서 서명 URL·탈퇴(auth.admin)·결제 확정 RPC처럼 설계가 정한 곳에서만 쓴다.
export function createAdminClient() {
    const { url } = readSupabasePublicEnv();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        throw new Error('CONFIG_MISSING: SUPABASE_SERVICE_ROLE_KEY를 .env.local에 넣어 주세요.');
    }
    return createClient<Database>(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}
