import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { readSupabasePublicEnv } from './env';

// 브라우저용 클라이언트. 쓰기는 하지 않는다(로그인 호출 제외, CONV-05).
export function createClient() {
    const { url, publishableKey } = readSupabasePublicEnv();
    return createBrowserClient<Database>(url, publishableKey);
}
