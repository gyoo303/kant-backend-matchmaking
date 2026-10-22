'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { THEME_LABELS, THEMES, type Product } from '@/types/product';
import { BookCover } from './BookCover';
import { fieldDescribedBy, FormField, INPUT_CLASS, TEXTAREA_CLASS } from './FormField';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type SaveResult =
    | { ok: true; data: { id: string } }
    | { ok: false; error: { message: string; fieldErrors?: Record<string, string> } };
type SaveProduct = (formData: FormData) => Promise<SaveResult>;

export const SAVED_MESSAGE = '저장했어요'; // US-06

// 칸 순서: PM-SCR SCR-08 그대로. 라벨 괄호 안은 "어디에 보이는지" (UX-PLAN-FE screens §SCR-08 [제안])
const FIELD_ORDER = ['name', 'author', 'price', 'theme', 'cover', 'description', 'keeperNote', 'publisherDescription', 'stock'];

// 책 등록·수정 폼 (SCR-08). 저장 액션(app/admin/products/actions의 saveProduct)은 화면이 넘긴다.
// 폼 action 대신 onSubmit을 쓴다: 오류가 나도 입력값이 지워지지 않게 하려는 것이다
export function ProductForm({
    product,
    saveProduct,
    initiallySaved = false,
}: {
    product?: Product;
    saveProduct: SaveProduct;
    initiallySaved?: boolean;
}) {
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [pending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<{ tone: 'status' | 'alert'; text: string } | null>(
        initiallySaved ? { tone: 'status', text: SAVED_MESSAGE } : null,
    );

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        if (product) formData.set('id', product.id);
        setMessage(null);

        startTransition(async () => {
            const result = await saveProduct(formData);
            if (result.ok) {
                setErrors({});
                if (product) {
                    setMessage({ tone: 'status', text: SAVED_MESSAGE });
                    router.refresh();
                } else {
                    // 새 책은 저장 뒤 그 책의 수정 화면으로 간다(목록·상세에 바로 보임, AC-06-1)
                    router.replace(`/admin/products/${result.data.id}?saved=1`);
                }
                return;
            }
            // 칸별 이유는 해당 칸 아래에 (AC-06-4, UX-15). 첫 오류 칸으로 포커스를 옮긴다
            const fieldErrors = result.error.fieldErrors ?? {};
            setErrors(fieldErrors);
            setMessage({ tone: 'alert', text: result.error.message });
            const first = FIELD_ORDER.find((name) => fieldErrors[name]);
            if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
        });
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-6">
            <FormField id="name" label="제목" error={errors.name}>
                <Input id="name" name="name" defaultValue={product?.name} maxLength={200} className={INPUT_CLASS} {...fieldDescribedBy('name', false, errors.name)} />
            </FormField>
            <FormField id="author" label="저자" error={errors.author}>
                <Input id="author" name="author" defaultValue={product?.author} maxLength={100} className={INPUT_CLASS} {...fieldDescribedBy('author', false, errors.author)} />
            </FormField>
            <FormField id="price" label="가격 (원)" error={errors.price}>
                <Input id="price" name="price" type="number" inputMode="numeric" defaultValue={product?.price} className={INPUT_CLASS} {...fieldDescribedBy('price', false, errors.price)} />
            </FormField>

            <fieldset className="flex flex-col gap-1.5" aria-describedby={errors.theme ? 'theme-error' : undefined}>
                <legend className="mb-1.5">테마</legend>
                <div className="flex flex-wrap gap-2">
                    {THEMES.map((theme) => (
                        <label
                            key={theme}
                            className="border-input has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-ring inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 has-focus-visible:outline-3 has-focus-visible:outline-offset-2"
                        >
                            <input type="radio" name="theme" value={theme} defaultChecked={product?.theme === theme} className="sr-only" />
                            {THEME_LABELS[theme]}
                        </label>
                    ))}
                </div>
                {errors.theme && (
                    <p id="theme-error" className="text-destructive text-sm">
                        {errors.theme}
                    </p>
                )}
            </fieldset>

            <FormField
                id="cover"
                label="표지 이미지"
                hint={product ? '새 이미지를 고르지 않으면 지금 표지를 그대로 써요. 세로 3:4 비율 사진이 가장 잘 보여요' : '세로 3:4 비율 사진이 가장 잘 보여요'}
                error={errors.cover}
            >
                {product && (
                    <div className="mb-2 w-24">
                        <BookCover key={product.imageUrl} src={product.imageUrl} title={product.name} theme={product.theme} sizes="96px" />
                    </div>
                )}
                <Input
                    id="cover"
                    name="cover"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className={`${INPUT_CLASS} py-2 file:mr-3`}
                    {...fieldDescribedBy('cover', true, errors.cover)}
                />
            </FormField>
            <FormField id="description" label="짧은 설명 (상세 화면 정보 칸에 보여요)" error={errors.description}>
                <Input id="description" name="description" defaultValue={product?.description} maxLength={300} className={INPUT_CLASS} {...fieldDescribedBy('description', false, errors.description)} />
            </FormField>
            <FormField id="keeperNote" label="책방지기 노트 (상세 맨 위에 크게 보여요)" error={errors.keeperNote}>
                <textarea id="keeperNote" name="keeperNote" defaultValue={product?.keeperNote} className={`${TEXTAREA_CLASS} min-h-40`} {...fieldDescribedBy('keeperNote', false, errors.keeperNote)} />
            </FormField>
            <FormField id="publisherDescription" label="출판사 소개 (없으면 비워 두세요)" error={errors.publisherDescription}>
                <textarea
                    id="publisherDescription"
                    name="publisherDescription"
                    defaultValue={product?.publisherDescription ?? ''}
                    className={TEXTAREA_CLASS}
                    {...fieldDescribedBy('publisherDescription', false, errors.publisherDescription)}
                />
            </FormField>
            <FormField id="stock" label="재고" hint="0으로 두면 품절로 보이고 담을 수 없어요" error={errors.stock}>
                <Input id="stock" name="stock" type="number" inputMode="numeric" defaultValue={product?.stock} className={INPUT_CLASS} {...fieldDescribedBy('stock', true, errors.stock)} />
            </FormField>

            <div>
                <Button type="submit" disabled={pending} className="h-13 px-8 text-base">
                    {pending ? '저장하는 중이에요' : '저장'}
                </Button>
                <p
                    role={message?.tone === 'alert' ? 'alert' : 'status'}
                    className={`mt-3 min-h-6 ${message?.tone === 'alert' ? 'text-destructive' : ''}`}
                >
                    {message?.text}
                </p>
            </div>
        </form>
    );
}
