import 'server-only';
import { z } from 'zod';
import type { ShippingTargetRow } from '@/domains/shipping/shipping-list';
import { toAppError } from '@/lib/data/rpc-error';
import { AppError } from '@/lib/http/result';
import { createClient } from '@/lib/supabase/server';

// 책방지기 운영 (TKT-BE-M4-04). 모두 책방지기 세션(createClient)으로 부른다. 비관리자는 RPC가 FORBIDDEN(AC-19-3)

// SEQ-11: 발송 대상(INV-17) — paid 주문 + 취소 요청 표시 없는 arrived·reading 회차, 결제 시점 배송지 사본
export async function listShippingTargets(): Promise<ShippingTargetRow[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('list_shipping_targets');
    if (error) throw toAppError('list_shipping_targets', error);
    return data.map((row) => ({
        kind: row.kind === 'round' ? 'round' : 'order',
        // 회차는 번호가 없고, 매칭 전이면 책이 없다(DB 브리핑 TKT-DB-04). 생성 타입은 null을 적지 않아 여기서 받는다
        orderNumber: row.order_number ?? null,
        recipientName: row.recipient_name,
        phone: row.phone,
        address: row.address,
        books: row.books ?? null,
    }));
}

// 다운로드 기록 1행(ADR-007, RISK-09)
export async function recordShippingListDownload(keeperId: string, rowCount: number): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('shipping_list_downloads').insert({ keeper_id: keeperId, row_count: rowCount });
    if (error) throw new AppError('UNKNOWN', `[API-14] shipping_list_downloads: ${error.code} ${error.message}`);
}

const keeperCountsSchema = z.object({
    arrivedLetters: z.number().int(),
    ordersToShip: z.number().int(),
    cancelRequests: z.number().int(),
});

export type KeeperCounts = z.infer<typeof keeperCountsSchema>;

// SCR-20 관리자 홈: 오늘 할 일 수
export async function getKeeperCounts(): Promise<KeeperCounts> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('keeper_counts');
    if (error) throw toAppError('keeper_counts', error);
    const parsed = keeperCountsSchema.safeParse(data);
    if (!parsed.success) throw new AppError('UNKNOWN', `[SCR-20] keeper_counts 반환 형식: ${parsed.error.message}`);
    return parsed.data;
}
