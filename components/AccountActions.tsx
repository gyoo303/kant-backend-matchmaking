'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MENU_ROW_CLASS } from './MenuList';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type WithdrawResult = { ok: true } | { ok: false; error: { message: string } };

// 마이페이지 메뉴 끝의 [로그아웃]·[탈퇴] 줄 (SCR-06). 확인 팝업은 쓰지 않는다 (UX-PLAN-FE screens §SCR-06, design-system §5)
// 탈퇴 액션(app/mypage/actions의 withdraw)은 화면이 넘긴다. 성공하면 액션이 메인으로 보낸다 (AC-05-4)
export function AccountActions({ withdraw }: { withdraw: () => Promise<WithdrawResult> }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);

    function handleLogout() {
        setMessage(null);
        startTransition(async () => {
            // 로그인과 같은 브라우저 인증 호출 (CONV-05 예외). 서버 쿠키는 proxy가 다음 요청에서 정리한다
            const { error } = await createClient().auth.signOut();
            if (error) {
                console.error('[SCR-06] signOut', error.message);
                setMessage('로그아웃하지 못했어요. 다시 시도해 주세요');
                return;
            }
            router.push('/');
            router.refresh();
        });
    }

    function handleWithdraw() {
        setMessage(null);
        startTransition(async () => {
            const result = await withdraw();
            // 발송 전 주문·준비 중 편지가 있으면 탈퇴되지 않고 이유가 보인다 (AC-05-7·9)
            if (!result.ok) setMessage(result.error.message);
        });
    }

    return (
        <>
            <li className="border-b">
                <button type="button" onClick={handleLogout} disabled={pending} className={MENU_ROW_CLASS}>
                    로그아웃
                </button>
            </li>
            <li className="border-b">
                {/* 탈퇴는 흐린 글자, 빨간색 아님 (UX-D-09) */}
                <button type="button" onClick={handleWithdraw} disabled={pending} className={`${MENU_ROW_CLASS} text-muted-foreground`}>
                    탈퇴
                </button>
            </li>
            {message && (
                <li className="pt-4">
                    <p role="alert" className="bg-accent text-accent-foreground rounded-lg px-4 py-3">
                        {message}
                    </p>
                </li>
            )}
        </>
    );
}
