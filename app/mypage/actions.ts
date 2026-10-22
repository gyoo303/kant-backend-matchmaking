'use server';

import { runTransition } from '@/app/mypage/cancel-flow';
import { cancelTargetSchema, type CancelTarget } from '@/domains/orders/order';
import type { OrderStatus } from '@/domains/orders/types/order.types';
import { redirect } from 'next/navigation';
import { requireMember } from '@/lib/auth/guards';
import { deleteAuthUser, deletePostcards, signOut, withdrawMemberData } from '@/lib/data/members';
import { fail, runAction, type ActionResult } from '@/lib/http/result';

const NOT_FOUND_MESSAGE = '주문이나 편지를 찾을 수 없어요.';

// API-11 취소 요청: 주문 paid → cancel_requested / 회차 arrived·reading에 표시(AC-09-2, US-20).
// 성공하면 화면은 domains/orders/order.ts의 CANCEL_REQUESTED_MESSAGE를 보여 준다
export async function requestCancel(input: CancelTarget): Promise<ActionResult<OrderStatus | null>> {
    return runAction(
        'API-11',
        async () => {
            await requireMember('/mypage');
            const parsed = cancelTargetSchema.safeParse(input);
            if (!parsed.success) return fail('NOT_FOUND', NOT_FOUND_MESSAGE);
            return runTransition('request_cancel', parsed.data);
        },
        { NOT_FOUND: NOT_FOUND_MESSAGE },
    );
}

// API-11 취소 요청 철회: 주문 cancel_requested → paid / 회차 표시 해제(AC-09-5, AC-20-5)
export async function withdrawCancel(input: CancelTarget): Promise<ActionResult<OrderStatus | null>> {
    return runAction(
        'API-11',
        async () => {
            await requireMember('/mypage');
            const parsed = cancelTargetSchema.safeParse(input);
            if (!parsed.success) return fail('NOT_FOUND', NOT_FOUND_MESSAGE);
            return runTransition('withdraw_cancel', parsed.data);
        },
        { NOT_FOUND: NOT_FOUND_MESSAGE },
    );
}

// API-12 결제 대기 취소(D-037): 주문 결제 대기 → cancelled / 회차 [편지 거두기](AC-11-8)
export async function cancelPending(input: CancelTarget): Promise<ActionResult<OrderStatus | null>> {
    return runAction(
        'API-12',
        async () => {
            await requireMember('/mypage');
            const parsed = cancelTargetSchema.safeParse(input);
            if (!parsed.success) return fail('NOT_FOUND', NOT_FOUND_MESSAGE);
            return runTransition('cancel_pending', parsed.data);
        },
        { NOT_FOUND: NOT_FOUND_MESSAGE },
    );
}

// API-23 탈퇴(AR-DB §7): 발송 전 결제 완료 주문·결제 확정된 진행 중 회차가 있으면 거부(AC-05-7·9).
// 성공하면 사적인 글·엽서·계정을 지우고 로그아웃한 뒤 메인으로 간다(AC-05-4·8)
export async function withdraw(): Promise<ActionResult<never>> {
    return runAction('API-23', async () => {
        const member = await requireMember('/mypage');
        const { postcardPaths } = await withdrawMemberData();
        await deletePostcards(postcardPaths);
        await deleteAuthUser(member.id);
        await signOut();
        redirect('/');
    });
}
