import 'server-only';
import { cacheTag } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';
import type { Product, Theme } from '@/types/product';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEW_ARRIVALS_LIMIT = 4; // D-035

// DB 행 → 화면 타입 변환은 여기 한 곳에서만 한다 (AR-DB §8).
export function toProduct(row: Tables<'products'>): Product {
    return {
        id: row.id,
        name: row.name,
        price: row.price,
        imageUrl: row.image_url,
        description: row.description,
        theme: row.theme,
        author: row.author,
        keeperNote: row.keeper_note,
        publisherDescription: row.publisher_description,
        stock: row.stock,
        createdAt: row.created_at,
    };
}

// API-01: 테마별(없으면 전체) 최신순. 실패하면 던진다 → 화면이 AC-01-4 문구로 처리
export async function getProducts(theme?: Theme): Promise<Product[]> {
    'use cache';
    cacheTag('products');

    const supabase = createPublicClient();
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (theme) query = query.eq('theme', theme);

    const { data, error } = await query;
    if (error) throw new Error(`[API-01] getProducts: ${error.message}`);
    return data.map(toProduct);
}

// API-02: uuid 형식이 아니거나 없는 책이면 null → 화면이 notFound()
export async function getProduct(id: string): Promise<Product | null> {
    'use cache';
    cacheTag('products');

    if (!UUID_PATTERN.test(id)) return null;

    const supabase = createPublicClient();
    const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`[API-02] getProduct: ${error.message}`);
    return data ? toProduct(data) : null;
}

// API-03: 재고 있는 책 중 최근 등록 4권 (D-035)
export async function getNewArrivals(): Promise<Product[]> {
    'use cache';
    cacheTag('products');

    const supabase = createPublicClient();
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .gt('stock', 0)
        .order('created_at', { ascending: false })
        .limit(NEW_ARRIVALS_LIMIT);
    if (error) throw new Error(`[API-03] getNewArrivals: ${error.message}`);
    return data.map(toProduct);
}
