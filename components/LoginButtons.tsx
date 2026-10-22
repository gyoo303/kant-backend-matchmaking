'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Provider = 'kakao' | 'custom:naver';

export const LOGIN_FAILED = '로그인을 마치지 못했어요. 다시 시도해 주세요'; // AC-05-5

// 버튼 공통: 두 버튼 폭 같게, 높이 52px (UX-PLAN-FE screens §SCR-05)
const BUTTON_CLASS =
    'flex h-13 w-full items-center justify-center gap-2 rounded-lg border text-base disabled:opacity-60';

// 소셜 로그인 2개뿐, 아이디·비밀번호 칸 없음 (AC-05-1, INV-03). 로그인 호출은 브라우저 클라이언트 (CONV-05 예외)
// 버튼 색은 브랜드 색 예외 (design-system §2 예외 1, UX-D-08): 카카오 노랑 / 네이버 흰 바탕 + 초록 N
export function LoginButtons({ next, initialError }: { next: string; initialError: boolean }) {
    const [pending, setPending] = useState<Provider | null>(null);
    const [failed, setFailed] = useState(initialError);

    async function signIn(provider: Provider) {
        setPending(provider);
        setFailed(false);
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        let errorMessage: string | null;
        try {
            const { error } = await createClient().auth.signInWithOAuth({
                provider,
                options: { redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
            });
            errorMessage = error ? error.message : null;
        } catch (error) {
            // env 누락(CONFIG_MISSING) 등으로 클라이언트를 만들지 못한 경우
            errorMessage = error instanceof Error ? error.message : String(error);
        }
        // 성공하면 제공자 화면으로 이동한다. 오류가 있으면 시작하지 못한 것이다
        if (errorMessage) {
            console.error('[SCR-05] signInWithOAuth', errorMessage);
            setPending(null);
            setFailed(true);
        }
    }

    return (
        <>
            <div className="mt-8 flex flex-col gap-3">
                <button
                    type="button"
                    onClick={() => signIn('kakao')}
                    disabled={pending !== null}
                    className={`${BUTTON_CLASS} border-transparent bg-[#fee500] text-[#191919]`}
                >
                    <span aria-hidden="true" className="size-3 rounded-full bg-[#191919]" />
                    카카오로 시작하기
                </button>
                <button
                    type="button"
                    onClick={() => signIn('custom:naver')}
                    disabled={pending !== null}
                    className={`${BUTTON_CLASS} border-input bg-[#ffffff] text-[#191919]`}
                >
                    <span
                        aria-hidden="true"
                        className="grid size-5.5 place-items-center rounded-xs bg-[#03c75a] text-sm leading-none font-bold text-[#ffffff]"
                    >
                        N
                    </span>
                    네이버로 시작하기
                </button>
            </div>
            {failed && (
                <p role="alert" className="bg-destructive-soft text-destructive-soft-foreground mt-6 rounded-lg px-4 py-3">
                    {LOGIN_FAILED}
                </p>
            )}
        </>
    );
}
