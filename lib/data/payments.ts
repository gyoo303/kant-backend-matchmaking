import 'server-only';
import { z } from 'zod';
import type { PaymentTarget } from '@/domains/payments/types/payment.types';
import { toAppError } from '@/lib/data/rpc-error';
import { AppError } from '@/lib/http/result';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// 결제 RPC 래퍼 (TKT-BE-M3-02·03). 호출 클라이언트 규칙은 docs/03-db/briefing.md "레이어 계층 확인 포인트"
// - create_payment·begin_refund: 회원·책방지기 세션(createClient)
// - confirm_payment·fail_payment·complete_refund·fail_refund: service_role(createAdminClient)만

export type StoredPayment = {
    id: string;
    status: 'ready' | 'paid' | 'refunding' | 'refunded' | 'failed';
    amount: number;
    target: PaymentTarget;
};

function targetOf(row: { order_id: string | null; round_id: string | null }): PaymentTarget | null {
    if (row.order_id) return { kind: 'order', orderId: row.order_id };
    if (row.round_id) return { kind: 'round', roundId: row.round_id };
    return null;
}

// SEQ-03 1단계: ready 결제를 만들고 pg_order_id·서버 금액을 받는다. 부를 때마다 새 결제(API-08 다시 결제하기)
export async function createPayment(target: PaymentTarget): Promise<{ pgOrderId: string; amount: number }> {
    const supabase = await createClient();
    // 두 인자는 default null(0050). 대상 쪽 인자만 넘긴다
    const { data, error } = await supabase.rpc(
        'create_payment',
        target.kind === 'order' ? { p_order_id: target.orderId } : { p_round_id: target.roundId },
    );
    if (error) throw toAppError('create_payment', error);
    return { pgOrderId: data.pg_order_id, amount: data.amount };
}

// API-09: 결제 리다이렉트에는 세션이 없을 수 있어 service_role로 pg_order_id의 결제를 찾는다(응답에는 넣지 않는다)
export async function findPaymentByPgOrderId(pgOrderId: string): Promise<StoredPayment | null> {
    const admin = createAdminClient();
    const { data, error } = await admin
        .from('payments')
        .select('id, status, amount, order_id, round_id')
        .eq('pg_order_id', pgOrderId)
        .maybeSingle();
    if (error) throw new AppError('UNKNOWN', `[API-09] payments: ${error.message}`);
    if (!data) return null;
    const target = targetOf(data);
    if (!target) throw new AppError('UNKNOWN', `[API-09] payments ${data.id}: 대상 없음`);
    return { id: data.id, status: data.status, amount: data.amount, target };
}

const confirmResultSchema = z.union([
    z.object({ already: z.boolean(), kind: z.literal('order'), orderId: z.string() }),
    z.object({ already: z.boolean(), kind: z.literal('round'), roundId: z.string() }),
]);

// SEQ-03 5단계: 재고·상태를 한 트랜잭션으로 반영. 이미 paid면 already=true(AC-08-6)
export async function confirmPayment(
    pgOrderId: string,
    paymentKey: string,
    approvedAmount: number,
): Promise<{ already: boolean; target: PaymentTarget }> {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('confirm_payment', {
        p_pg_order_id: pgOrderId,
        p_payment_key: paymentKey,
        p_amount: approvedAmount,
    });
    if (error) throw toAppError('confirm_payment', error);
    const parsed = confirmResultSchema.safeParse(data);
    if (!parsed.success) throw new AppError('UNKNOWN', `[API-09] confirm_payment 반환 형식: ${parsed.error.message}`);
    const result = parsed.data;
    return {
        already: result.already,
        target: result.kind === 'order' ? { kind: 'order', orderId: result.orderId } : { kind: 'round', roundId: result.roundId },
    };
}

// ready → failed (이미 다른 상태면 변화 없음). 주문·회차는 pending_payment 그대로(AC-08-4)
export async function failPayment(pgOrderId: string, code: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.rpc('fail_payment', { p_pg_order_id: pgOrderId, p_code: code });
    if (error) throw toAppError('fail_payment', error);
}

// SEQ-08 환불 1단계: paid → refunding. 결제 행(pg_payment_key 포함)은 서버 안에서만 쓴다
export async function beginRefund(target: PaymentTarget): Promise<{ paymentId: string; paymentKey: string }> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('begin_refund', {
        p_kind: target.kind,
        p_id: target.kind === 'order' ? target.orderId : target.roundId,
    });
    if (error) throw toAppError('begin_refund', error);
    if (!data.pg_payment_key) throw new AppError('UNKNOWN', `[API-13] begin_refund ${data.id}: pg_payment_key 없음`);
    return { paymentId: data.id, paymentKey: data.pg_payment_key };
}

// PG 환불 성공 → refunded(주문 재고 복구 / 회차 cancelled)
export async function completeRefund(paymentId: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.rpc('complete_refund', { p_payment_id: paymentId });
    if (error) throw toAppError('complete_refund', error);
}

// PG 환불 실패 → paid로 되돌림(AC-10-3)
export async function failRefund(paymentId: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.rpc('fail_refund', { p_payment_id: paymentId });
    if (error) throw toAppError('fail_refund', error);
}
