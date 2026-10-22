import 'server-only';
import { AppError } from '@/lib/http/result';
import type { createClient } from '@/lib/supabase/server';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// 회원 화면용 조회는 "내 행"으로 한 번 더 좁힌다. 책방지기 계정은 RLS상 모든 회원 행을 읽을 수 있기 때문이다.
export async function sessionUserId(supabase: ServerClient): Promise<string> {
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (error || !userId) throw new AppError('UNAUTHENTICATED', 'session 없음');
    return userId;
}
