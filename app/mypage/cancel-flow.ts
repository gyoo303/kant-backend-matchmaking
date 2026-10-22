import 'server-only';
import { revalidatePath } from 'next/cache';
import { currentStateMessage, ORDER_STATUS_LABELS, type CancelTarget } from '@/domains/orders/order';
import type { OrderStatus } from '@/domains/orders/types/order.types';
import { ROUND_STATUS_LABELS } from '@/domains/subscriptions/window-copy';
import { getCurrentStatus, transition } from '@/lib/data/orders';
import { AppError, fail, ok, type ActionResult } from '@/lib/http/result';

// API-11~13 공용: 상태 전이 RPC를 부르고, 지금 상태에서 안 되는 요청이면 현재 상태를 안내한다(AC-09-7, AC-20-7)
export async function runTransition(
    rpc: 'request_cancel' | 'withdraw_cancel' | 'cancel_pending' | 'reject_cancel',
    target: CancelTarget,
): Promise<ActionResult<OrderStatus | null>> {
    try {
        const status = await transition(rpc, target);
        revalidateCancelScreens();
        return ok(status);
    } catch (error) {
        if (error instanceof AppError && error.code === 'INVALID_STATE') return fail('INVALID_STATE', await invalidStateMessage(target));
        throw error;
    }
}

export async function invalidStateMessage(target: CancelTarget): Promise<string> {
    const current = await getCurrentStatus(target);
    if (!current) return '찾을 수 없어요.';
    return currentStateMessage(current.kind === 'order' ? ORDER_STATUS_LABELS[current.status] : ROUND_STATUS_LABELS[current.status]);
}

// 취소·환불·발송 뒤 회원·책방지기 화면을 새로 읽게 한다
export function revalidateCancelScreens(): void {
    for (const path of ['/mypage', '/mypage/orders', '/mypage/window', '/letters/new', '/admin', '/admin/orders', '/admin/desk']) {
        revalidatePath(path);
    }
}
