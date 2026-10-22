import 'server-only';
import { imageExtension } from '@/domains/products/product.schema';
import type { ShippingInput } from '@/domains/shipping/shipping.schema';
import type { DeskRound, KeeperRound, RoundStatus, UnboxedRound, WindowView } from '@/domains/subscriptions/types/round.types';
import { toWindowView } from '@/domains/subscriptions/window-copy';
import { toAppError, isRpcSignal } from '@/lib/data/rpc-error';
import { sessionUserId } from '@/lib/data/session';
import { AppError } from '@/lib/http/result';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Enums } from '@/types/database';

// 편지 구독 회차 (TKT-BE-M4-01~03). 회원 데이터는 회원 세션(createClient)과 RLS로만 읽는다.
// round_contents(책·답장·엽서)는 언박싱 전에는 RLS가 0행을 돌려준다(NFR-08). admin 클라이언트로 읽어 회원에게 주지 않는다.

const POSTCARD_BUCKET = 'postcards';
const POSTCARD_URL_SECONDS = 600; // SEQ-07

// ── 회원: 편지 띄우기·창가 (TKT-BE-M4-01) ─────────────────────────

// SEQ-04: 편지 + 회차 pending_payment(배송지 사본). 진행 중 회차가 있으면 ROUND_IN_PROGRESS(INV-12)
export async function createRound(body: string, ship: ShippingInput): Promise<{ roundId: string }> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_round', {
        p_letter: body,
        p_ship: { recipientName: ship.recipientName, phone: ship.phone, address: ship.address },
    });
    if (error) throw toAppError('create_round', error);
    return { roundId: data.id };
}

// API-16: 창가. 문구 매핑은 domains/subscriptions/window-copy.ts (ADR-006: 진입·새로고침 때마다 읽는다)
export async function getWindow(): Promise<WindowView> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('subscription_rounds')
        .select('id, status, teaser, cancel_requested_at, cancel_rejected_at')
        .eq('member_id', await sessionUserId(supabase))
        .in('status', ['pending_payment', 'arrived', 'reading', 'shipped'])
        .order('created_at', { ascending: false })
        .limit(10);
    if (error) throw new AppError('UNKNOWN', `[API-16] getWindow: ${error.message}`);
    return toWindowView(
        data.map((row) => ({
            id: row.id,
            status: row.status,
            // 힌트는 발송 뒤에만 회원 화면에 나간다(DB 브리핑 TKT-DB-03)
            teaser: row.status === 'shipped' ? row.teaser : null,
            cancelRequestedAt: row.cancel_requested_at,
            cancelRejectedAt: row.cancel_rejected_at,
        })),
    );
}

// SCR-14 편지지 화면 상태: 새 편지 / 결제 대기 편지(내용 보존, AC-11-6·8) / 진행 중(AC-11-4)
export type LetterPageState =
    | { kind: 'write' }
    | { kind: 'pending_payment'; roundId: string; body: string }
    | { kind: 'in_progress'; roundId: string };

export async function getLetterPageState(): Promise<LetterPageState> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('subscription_rounds')
        .select('id, status, reader_letters(body)')
        .eq('member_id', await sessionUserId(supabase))
        .in('status', ['pending_payment', 'arrived', 'reading'])
        .maybeSingle();
    if (error) throw new AppError('UNKNOWN', `[API-15] letter page: ${error.message}`);
    if (!data) return { kind: 'write' };
    if (data.status === 'pending_payment') return { kind: 'pending_payment', roundId: data.id, body: data.reader_letters?.body ?? '' };
    return { kind: 'in_progress', roundId: data.id };
}

// ── 책방지기: 서재 작업 (TKT-BE-M4-02) ───────────────────────────

// SEQ-05 / API-17: arrived → reading(이미 reading이면 변화 없음, AC-13-2·3)
export async function openRound(roundId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.rpc('open_round', { p_round_id: roundId });
    if (error) throw toAppError('open_round', error);
}

// SCR-19 목록: 결제 확정된 진행 중 회차만(arrived·reading, AC-13-4), 도착순
export async function getDeskRounds(): Promise<DeskRound[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('subscription_rounds')
        .select('id, status, paid_at, cancel_requested_at, ship_recipient_name')
        .in('status', ['arrived', 'reading'])
        .order('paid_at', { ascending: true });
    if (error) throw new AppError('UNKNOWN', `[SCR-19] rounds: ${error.message}`);
    return data.map((row) => ({
        id: row.id,
        status: row.status,
        paidAt: row.paid_at,
        cancelRequested: row.cancel_requested_at !== null,
        recipientName: row.ship_recipient_name,
    }));
}

// SCR-19 회차 하나(편지 전문·매칭·코드). 책방지기 세션에서만 행이 온다(RLS). 엽서는 책방지기 Storage 정책으로 서명
export async function getKeeperRound(roundId: string): Promise<KeeperRound | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('subscription_rounds')
        .select(
            'id, status, paid_at, opened_at, cancel_requested_at, cancel_rejected_at, teaser, ship_recipient_name, ship_phone, ship_address, reader_letters(body), round_contents(reply_letter, postcard_path, products(id, name, image_url, author, stock)), unboxing_codes(code)',
        )
        .eq('id', roundId)
        .neq('status', 'pending_payment')
        .maybeSingle();
    if (error) throw new AppError('UNKNOWN', `[SCR-19] round: ${error.message}`);
    if (!data) return null;

    const contents = data.round_contents;
    const product = contents?.products ?? null;
    let postcardUrl: string | null = null;
    if (contents?.postcard_path) {
        const signed = await supabase.storage.from(POSTCARD_BUCKET).createSignedUrl(contents.postcard_path, POSTCARD_URL_SECONDS);
        if (signed.error) console.error('[SCR-19] postcard url', signed.error.message);
        postcardUrl = signed.data?.signedUrl ?? null;
    }
    return {
        id: data.id,
        status: data.status,
        letter: data.reader_letters?.body ?? '',
        paidAt: data.paid_at,
        openedAt: data.opened_at,
        cancelRequested: data.cancel_requested_at !== null,
        cancelRejected: data.cancel_requested_at === null && data.cancel_rejected_at !== null,
        shipping: { recipientName: data.ship_recipient_name, phone: data.ship_phone, address: data.ship_address },
        product: product
            ? { id: product.id, name: product.name, imageUrl: product.image_url, author: product.author, stock: product.stock }
            : null,
        replyLetter: contents?.reply_letter ?? null,
        postcardUrl,
        teaser: data.teaser,
        code: data.unboxing_codes?.code ?? null,
    };
}

// API-18 엽서 업로드: rounds/{round_id}/postcard.{ext} (AR-DB §6). 다시 올리면 덮어쓴다
export async function uploadPostcard(roundId: string, file: File): Promise<string> {
    const supabase = await createClient();
    const path = `rounds/${roundId}/postcard.${imageExtension(file.type)}`;
    const { error } = await supabase.storage.from(POSTCARD_BUCKET).upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw new AppError('UNKNOWN', `[API-18] postcard upload: ${error.message}`);
    return path;
}

// API-18 매칭·답장 저장. 회차가 arrived·reading일 때만 RLS가 통과시킨다(그 밖에는 INVALID_STATE)
export async function saveRoundContents(
    roundId: string,
    contents: { productId: string; replyLetter: string; postcardPath: string | null },
): Promise<void> {
    const supabase = await createClient();
    const row = {
        round_id: roundId,
        product_id: contents.productId,
        reply_letter: contents.replyLetter,
        ...(contents.postcardPath ? { postcard_path: contents.postcardPath } : {}),
    };
    const { data, error } = await supabase.from('round_contents').upsert(row, { onConflict: 'round_id' }).select('round_id');
    if (error) {
        // RLS with check 위반(42501)은 회차 상태가 arrived·reading이 아니라는 뜻이다
        throw new AppError(error.code === '42501' ? 'INVALID_STATE' : 'UNKNOWN', `[API-18] round_contents: ${error.code} ${error.message}`);
    }
    if (data.length === 0) throw new AppError('INVALID_STATE', `[API-18] round_contents ${roundId}: 저장 0행`);
}

// 매칭할 책이 품절인지 저장 전에 확인한다(AC-14-2). 없는 책이면 null
export async function getProductStock(productId: string): Promise<number | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('products').select('stock').eq('id', productId).maybeSingle();
    if (error) throw new AppError('UNKNOWN', `[API-18] products: ${error.message}`);
    return data?.stock ?? null;
}

// SEQ-06 / API-19: 발송·코드 발급. 겹치는 코드면 'collision'을 돌려준다(액션이 새 코드로 다시 부른다)
export async function shipRound(roundId: string, code: string, teaser: string): Promise<{ code: string } | 'collision'> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('ship_round', { p_round_id: roundId, p_code: code, p_teaser: teaser });
    if (error) {
        if (isRpcSignal(error, 'CODE_COLLISION')) return 'collision';
        throw toAppError('ship_round', error);
    }
    return { code: data };
}

// SCR-19 하단: 작별 안부 목록(AC-18-4). 책방지기만 전체 select
export async function getFarewellNotes(): Promise<{ subscriptionId: string; body: string; createdAt: string }[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('farewell_notes')
        .select('subscription_id, body, created_at')
        .order('created_at', { ascending: false });
    if (error) throw new AppError('UNKNOWN', `[SCR-19] farewell_notes: ${error.message}`);
    return data.map((row) => ({ subscriptionId: row.subscription_id, body: row.body, createdAt: row.created_at }));
}

// ── 회원: 언박싱·서가·마무리 (TKT-BE-M4-03) ─────────────────────

// SEQ-07 / API-20: 소유자·shipped·코드 일치일 때만 true. 그 밖에는 모두 false(AC-16-3·4)
export async function unboxRound(roundId: string, code: string): Promise<boolean> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('unbox_round', { p_round_id: roundId, p_code: code });
    if (error) throw toAppError('unbox_round', error);
    return data;
}

// SCR-16 언박싱 전 화면: 상태와 (발송됐으면) 힌트만(NFR-08). 남의 회차면 null
export async function getMemberRound(roundId: string): Promise<{ id: string; status: RoundStatus; teaser: string | null } | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('subscription_rounds')
        .select('id, status, teaser')
        .eq('id', roundId)
        .eq('member_id', await sessionUserId(supabase))
        .maybeSingle();
    if (error) throw new AppError('UNKNOWN', `[SCR-16] round: ${error.message}`);
    if (!data) return null;
    const showTeaser = data.status === 'shipped' || data.status === 'unboxed';
    return { id: data.id, status: data.status, teaser: showTeaser ? data.teaser : null };
}

type UnboxedRow = {
    id: string;
    unboxed_at: string | null;
    round_contents: {
        reply_letter: string | null;
        postcard_path: string | null;
        products: { id: string; name: string; image_url: string; author: string; theme: Enums<'theme'> } | null;
    } | null;
    shelf_memos: { body: string; updated_at: string } | null;
};

const UNBOXED_COLUMNS =
    'id, unboxed_at, round_contents(reply_letter, postcard_path, products(id, name, image_url, author, theme)), shelf_memos(body, updated_at)';

// 엽서 서명 URL: 언박싱 후 RLS로 읽은 경로만 admin으로 서명한다(AR-DB §6, 금지 패턴 9의 예외)
async function signPostcard(path: string | null): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await createAdminClient().storage.from(POSTCARD_BUCKET).createSignedUrl(path, POSTCARD_URL_SECONDS);
    if (error) {
        console.error('[API-20] postcard url', error.message);
        return null;
    }
    return data.signedUrl;
}

async function toUnboxedRound(row: UnboxedRow): Promise<UnboxedRound | null> {
    const contents = row.round_contents;
    if (!contents?.products || !row.unboxed_at) return null;
    return {
        roundId: row.id,
        product: {
            id: contents.products.id,
            name: contents.products.name,
            imageUrl: contents.products.image_url,
            author: contents.products.author,
            theme: contents.products.theme,
        },
        replyLetter: contents.reply_letter ?? '',
        postcardUrl: await signPostcard(contents.postcard_path),
        unboxedAt: row.unboxed_at,
        memo: row.shelf_memos ? { body: row.shelf_memos.body, updatedAt: row.shelf_memos.updated_at } : null,
    };
}

// 언박싱된 회차 하나(AC-16-2). 언박싱 전·남의 회차면 null
export async function getUnboxedRound(roundId: string): Promise<UnboxedRound | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('subscription_rounds')
        .select(UNBOXED_COLUMNS)
        .eq('id', roundId)
        .eq('member_id', await sessionUserId(supabase))
        .eq('status', 'unboxed')
        .maybeSingle();
    if (error) throw new AppError('UNKNOWN', `[API-20] unboxed round: ${error.message}`);
    return data ? toUnboxedRound(data) : null;
}

// SCR-17 나의 서가: 언박싱된 책 최신순(메모 포함)
export async function getShelf(): Promise<UnboxedRound[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('subscription_rounds')
        .select(UNBOXED_COLUMNS)
        .eq('member_id', await sessionUserId(supabase))
        .eq('status', 'unboxed')
        .order('unboxed_at', { ascending: false });
    if (error) throw new AppError('UNKNOWN', `[SCR-17] shelf: ${error.message}`);
    const rounds = await Promise.all(data.map(toUnboxedRound));
    return rounds.filter((round): round is UnboxedRound => round !== null);
}

// API-21 메모 저장: 1권 1개(INV-16). 언박싱된 내 회차가 아니면 RLS가 막는다 → FORBIDDEN
export async function upsertMemo(memberId: string, roundId: string, body: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
        .from('shelf_memos')
        .upsert({ round_id: roundId, member_id: memberId, body }, { onConflict: 'round_id' });
    if (error) throw new AppError(error.code === '42501' ? 'FORBIDDEN' : 'UNKNOWN', `[API-21] shelf_memos: ${error.code} ${error.message}`);
}

// API-21 메모 삭제(없어도 성공)
export async function deleteMemo(roundId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('shelf_memos').delete().eq('round_id', roundId);
    if (error) throw new AppError('UNKNOWN', `[API-21] shelf_memos delete: ${error.message}`);
}

// SCR-18·마이페이지: 진행 중 구독이 있는지(AC-18-7)와 결제 확정된 진행 중 회차가 있는지(SCR-18 안내 한 줄)
export async function getSubscriptionState(): Promise<{ active: boolean; roundInProgress: boolean }> {
    const supabase = await createClient();
    const memberId = await sessionUserId(supabase);
    const [subscription, rounds] = await Promise.all([
        supabase.from('subscriptions').select('id').eq('member_id', memberId).eq('status', 'active').maybeSingle(),
        supabase.from('subscription_rounds').select('id').eq('member_id', memberId).in('status', ['arrived', 'reading']).limit(1),
    ]);
    if (subscription.error) throw new AppError('UNKNOWN', `[SCR-18] subscriptions: ${subscription.error.message}`);
    if (rounds.error) throw new AppError('UNKNOWN', `[SCR-18] rounds: ${rounds.error.message}`);
    return { active: subscription.data !== null, roundInProgress: rounds.data.length > 0 };
}

// SEQ-09 / API-22: 구독 마무리. 활성 구독이 없으면 INVALID_STATE
export async function endSubscription(note: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.rpc('end_subscription', { p_note: note });
    if (error) throw toAppError('end_subscription', error);
}
