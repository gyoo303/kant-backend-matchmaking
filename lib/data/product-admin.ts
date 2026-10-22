import 'server-only';
import { randomUuid } from '@/lib/crypto';
import { AppError } from '@/lib/http/result';
import { createClient } from '@/lib/supabase/server';
import { imageExtension, type ProductInput } from '@/domains/products/product.schema';
import type { TablesInsert } from '@/types/database';

const COVER_BUCKET = 'book-covers';

function toProductRow(input: ProductInput): Omit<TablesInsert<'products'>, 'id' | 'image_url'> {
    return {
        name: input.name,
        author: input.author,
        price: input.price,
        theme: input.theme,
        description: input.description,
        keeper_note: input.keeperNote,
        publisher_description: input.publisherDescription,
        stock: input.stock,
    };
}

// 표지를 book-covers에 올리고 공개 주소를 돌려준다. 책방지기 세션이어야 Storage 정책을 통과한다.
async function uploadCover(productId: string, file: File): Promise<string> {
    const supabase = await createClient();
    const path = `products/${productId}/${randomUuid()}.${imageExtension(file.type)}`;
    const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new AppError('UNKNOWN', `[API-04] cover upload: ${error.message}`);
    return supabase.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
}

// API-04 새 책: id를 먼저 정해 표지 경로에 쓰고, 표지 주소와 함께 저장한다
export async function createProduct(input: ProductInput, cover: File): Promise<{ id: string }> {
    const id = randomUuid();
    const imageUrl = await uploadCover(id, cover);
    const supabase = await createClient();
    const { error } = await supabase.from('products').insert({ id, image_url: imageUrl, ...toProductRow(input) });
    if (error) throw new AppError('UNKNOWN', `[API-04] insert: ${error.code} ${error.message}`);
    return { id };
}

// API-04 수정: 표지를 새로 넣었을 때만 주소를 바꾼다. 없는 책이면 NOT_FOUND
export async function updateProduct(id: string, input: ProductInput, cover: File | null): Promise<{ id: string }> {
    const imageUrl = cover ? await uploadCover(id, cover) : undefined;
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('products')
        .update({ ...toProductRow(input), ...(imageUrl ? { image_url: imageUrl } : {}) })
        .eq('id', id)
        .select('id');
    if (error) throw new AppError('UNKNOWN', `[API-04] update: ${error.code} ${error.message}`);
    if (data.length === 0) throw new AppError('NOT_FOUND', `[API-04] update: ${id} 없음`);
    return { id };
}
