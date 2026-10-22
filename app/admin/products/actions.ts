'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { authorizeKeeper } from '@/lib/auth/guards';
import { createProduct, updateProduct } from '@/lib/data/product-admin';
import { fail, fieldErrorsOf, ok, runAction, type ActionResult } from '@/lib/http/result';
import { checkCoverFile, productInputSchema } from '@/domains/products/product.schema';
import { isUuid } from '@/shared/utils/uuid';

function textField(formData: FormData, name: string): string | undefined {
    const value = formData.get(name);
    return typeof value === 'string' ? value : undefined;
}

// API-04: 책 저장(새 책·수정). 폼 필드 이름은 ProductInput 키 + id(수정할 때만) + cover(표지 파일)
export async function saveProduct(formData: FormData): Promise<ActionResult<{ id: string }>> {
    return runAction(
        'API-04',
        async () => {
            const keeper = await authorizeKeeper();
            if (!keeper.ok) return keeper;

            const id = textField(formData, 'id') || null;
            if (id !== null && !isUuid(id)) return fail('NOT_FOUND');

            const parsed = productInputSchema.safeParse({
                name: textField(formData, 'name'),
                author: textField(formData, 'author'),
                price: textField(formData, 'price'),
                theme: textField(formData, 'theme'),
                description: textField(formData, 'description'),
                keeperNote: textField(formData, 'keeperNote'),
                publisherDescription: textField(formData, 'publisherDescription'),
                stock: textField(formData, 'stock'),
            });
            const cover = checkCoverFile(formData.get('cover'), id === null);

            // 칸별 이유를 한 번에 돌려준다(AC-06-4)
            if (!parsed.success || !cover.ok) {
                return fail('VALIDATION', undefined, {
                    ...(parsed.success ? {} : fieldErrorsOf(parsed.error)),
                    ...(cover.ok ? {} : { cover: cover.message }),
                });
            }

            let saved: { id: string };
            if (id !== null) {
                saved = await updateProduct(id, parsed.data, cover.file);
            } else if (cover.file) {
                saved = await createProduct(parsed.data, cover.file);
            } else {
                return fail('VALIDATION', undefined, { cover: '표지 이미지를 넣어 주세요.' });
            }

            updateTag('products');
            revalidatePath('/admin/products');
            return ok(saved);
        },
        { NOT_FOUND: '책을 찾을 수 없어요.' },
    );
}
