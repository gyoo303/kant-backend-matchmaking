// Supabase 공개 환경변수 (ADR-005). 값이 없으면 CONFIG_MISSING으로 알린다(AC-21-4 안내는 화면에서).
// NEXT_PUBLIC_ 변수는 빌드 시 문자열로 바뀌므로 process.env.이름을 그대로 적는다.
export function readSupabasePublicEnv(): { url: string; publishableKey: string } {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !publishableKey) {
        throw new Error('CONFIG_MISSING: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 .env.local에 넣어 주세요.');
    }
    return { url, publishableKey };
}
