import 'server-only';
import { isPurchasable } from '@/domains/cart/cart';
import type { CartLine } from '@/domains/cart/types/cart.types';
import type { ShippingInput } from '@/domains/shipping/shipping.schema';
import { toProduct } from '@/lib/data/products';
import { sessionUserId } from '@/lib/data/session';
import { AppError } from '@/lib/http/result';
import { createClient } from '@/lib/supabase/server';

// 장바구니·기본 배송지 (TKT-BE-M3-01). 회원 세션 클라이언트로만 읽고 쓴다(RLS: member_id = auth.uid()).

// 장바구니 화면(SCR-09): 담은 순서대로, 품절 줄은 purchasable=false (AC-07-5)
export async function getCartLines(): Promise<CartLine[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('cart_items')
        .select('quantity, products(*)')
        .order('created_at', { ascending: true });
    if (error) throw new AppError('UNKNOWN', `[API-05] getCartLines: ${error.message}`);
    return data.flatMap((row) =>
        row.products ? [{ product: toProduct(row.products), quantity: row.quantity, purchasable: isPurchasable(row.products.stock) }] : [],
    );
}

// Header 장바구니 개수(AC-07-1): 담은 책 줄 수
export async function getCartCount(): Promise<number> {
    const supabase = await createClient();
    const { count, error } = await supabase.from('cart_items').select('product_id', { count: 'exact', head: true });
    if (error) throw new AppError('UNKNOWN', `[API-05] getCartCount: ${error.message}`);
    return count ?? 0;
}

// 담기 전 서버에서 다시 읽는 값: 책 재고와 이미 담은 수량(클라이언트 값을 믿지 않는다)
export async function getStockAndCartQuantity(productId: string): Promise<{ stock: number; inCart: number } | null> {
    const supabase = await createClient();
    const [product, cartItem] = await Promise.all([
        supabase.from('products').select('stock').eq('id', productId).maybeSingle(),
        supabase.from('cart_items').select('quantity').eq('product_id', productId).maybeSingle(),
    ]);
    if (product.error) throw new AppError('UNKNOWN', `[API-05] product: ${product.error.message}`);
    if (cartItem.error) throw new AppError('UNKNOWN', `[API-05] cart_items: ${cartItem.error.message}`);
    if (!product.data) return null;
    return { stock: product.data.stock, inCart: cartItem.data?.quantity ?? 0 };
}

// 같은 책은 줄을 늘리지 않고 수량만 바꾼다(AC-07-3, PK member_id+product_id)
export async function setCartQuantity(memberId: string, productId: string, quantity: number): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
        .from('cart_items')
        .upsert({ member_id: memberId, product_id: productId, quantity }, { onConflict: 'member_id,product_id' });
    if (error) throw new AppError('UNKNOWN', `[API-05] setCartQuantity: ${error.code} ${error.message}`);
}

export async function deleteCartItem(productId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('cart_items').delete().eq('product_id', productId);
    if (error) throw new AppError('UNKNOWN', `[API-05] deleteCartItem: ${error.message}`);
}

// 기본 배송지(회원당 1행). 주문서·편지 화면의 미리 채우기(AC-08-2)
export async function getShippingAddress(): Promise<ShippingInput | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('shipping_addresses')
        .select('recipient_name, phone, address')
        .eq('member_id', await sessionUserId(supabase))
        .maybeSingle();
    if (error) throw new AppError('UNKNOWN', `[API-06] getShippingAddress: ${error.message}`);
    return data ? { recipientName: data.recipient_name, phone: data.phone, address: data.address } : null;
}

// API-06: 기본 배송지 저장. 이미 한 주문의 배송지 사본은 바뀌지 않는다(AC-08-3, D-004)
export async function upsertShippingAddress(memberId: string, input: ShippingInput): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('shipping_addresses').upsert(
        { member_id: memberId, recipient_name: input.recipientName, phone: input.phone, address: input.address },
        { onConflict: 'member_id' },
    );
    if (error) throw new AppError('UNKNOWN', `[API-06] upsertShippingAddress: ${error.code} ${error.message}`);
}
