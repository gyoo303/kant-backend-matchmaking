import 'server-only';
import { z } from 'zod';
import { toAppError } from '@/lib/data/rpc-error';
import { AppError } from '@/lib/http/result';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// 회원 탈퇴 (TKT-BE-M4-03, AR-DB §7). 순서: withdraw_member(회원 세션) → 엽서 삭제(admin) → 계정 삭제(admin) → 로그아웃
// RPC가 성공한 뒤 Storage·계정 삭제가 실패해도 다시 부르면 된다(두 번째 RPC는 빈 목록).

const withdrawResultSchema = z.object({ postcardPaths: z.array(z.string()) });

// 거부(WITHDRAW_BLOCKED) → 결제 대기 취소 → 사적인 글·배송지·장바구니 삭제 → 거래 기록 연결 끊기
export async function withdrawMemberData(): Promise<{ postcardPaths: string[] }> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('withdraw_member');
    if (error) throw toAppError('withdraw_member', error);
    const parsed = withdrawResultSchema.safeParse(data);
    if (!parsed.success) throw new AppError('UNKNOWN', `[API-23] withdraw_member 반환 형식: ${parsed.error.message}`);
    return parsed.data;
}

// 엽서 사진 삭제(postcards 버킷, 회원 정책이 없어 service role로 지운다)
export async function deletePostcards(paths: readonly string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await createAdminClient().storage.from('postcards').remove([...paths]);
    if (error) throw new AppError('UNKNOWN', `[API-23] postcards remove: ${error.message}`);
}

// auth 계정 삭제 → profiles cascade
export async function deleteAuthUser(userId: string): Promise<void> {
    const { error } = await createAdminClient().auth.admin.deleteUser(userId);
    if (error) throw new AppError('UNKNOWN', `[API-23] deleteUser: ${error.message}`);
}

// 탈퇴 후 이 브라우저의 세션 쿠키를 지운다. 계정이 이미 없으므로 서버 호출 없이 local만 지운다
export async function signOut(): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw new AppError('UNKNOWN', `[API-23] signOut: ${error.message}`);
}
