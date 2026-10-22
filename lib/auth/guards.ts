import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { fail, type ActionResult } from '@/lib/http/result';
import { createClient } from '@/lib/supabase/server';
import type { Enums } from '@/types/database';

export type CurrentMember = { id: string; nickname: string; role: Enums<'member_role'> };

// API-25: 로그인한 회원(프로필 포함) 또는 null. 한 요청 안에서는 한 번만 조회한다.
// 쿠키를 읽으므로 이 함수를 부르는 서버 컴포넌트는 <Suspense> 안에 둔다(CONV-07).
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return null;

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, nickname, role')
        .eq('id', userId)
        .maybeSingle();
    if (error) throw new Error(`[API-25] getCurrentMember: ${error.message}`);
    // 프로필이 없는 계정(탈퇴 처리 중 등)은 로그인하지 않은 것으로 본다
    return profile ?? null;
});

// API-26 (화면용): 비로그인이면 로그인 화면으로 보내고, 로그인 후 next로 돌아온다(AC-05-6)
export async function requireMember(next: string): Promise<CurrentMember> {
    const member = await getCurrentMember();
    if (!member) redirect(`/login?next=${encodeURIComponent(next)}`);
    return member;
}

// API-26 (화면용): 책방지기가 아니면 관리자 화면이 있다는 것도 드러내지 않는다(NFR-06, AC-06-5)
export async function requireKeeper(): Promise<CurrentMember> {
    const member = await getCurrentMember();
    if (!member || member.role !== 'keeper') notFound();
    return member;
}

// 책방지기 Server Action용: 화면 이동 대신 FORBIDDEN/UNAUTHENTICATED를 ActionResult로 돌려준다(API-04·13·17~19)
export async function authorizeKeeper(): Promise<ActionResult<CurrentMember>> {
    const member = await getCurrentMember();
    if (!member) return fail('UNAUTHENTICATED');
    if (member.role !== 'keeper') return fail('FORBIDDEN');
    return { ok: true, data: member };
}
