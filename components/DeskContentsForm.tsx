'use client';

import Image from 'next/image';
import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { REPLY_MAX } from '@/domains/subscriptions/subscription.schema';
import { SoldOutBadge } from './BookBadges';
import { fieldDescribedBy, FormField, INPUT_CLASS, TEXTAREA_CLASS } from './FormField';

// ActionResult(lib/http/result) 중 화면이 쓰는 부분. 'use client' 파일은 lib/*를 import하지 않는다 (AR-CONV §2)
type SaveResult = { ok: true } | { ok: false; error: { message: string; fieldErrors?: Record<string, string> } };

export interface DeskBook {
    id: string;
    name: string;
    author: string;
    stock: number;
}

// 서재 작업 ② 책 고르기와 답장 (SCR-19, AC-14-1~3). 저장 액션(app/admin/desk/actions의 saveRoundContents)은 화면이 넘긴다.
// 품절 책은 고를 수 없다(AC-14-2). 엽서는 이미지 1장 10MB까지(AC-14-3, 서버가 검사해 칸 아래에 이유)
export function DeskContentsForm({
    roundId,
    books,
    savedProductId,
    savedReply,
    postcardUrl,
    saveRoundContents,
}: {
    roundId: string;
    books: DeskBook[];
    savedProductId: string | null;
    savedReply: string | null;
    postcardUrl: string | null;
    saveRoundContents: (formData: FormData) => Promise<SaveResult>;
}) {
    const [query, setQuery] = useState('');
    const [productId, setProductId] = useState(savedProductId);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<{ tone: 'status' | 'alert'; text: string } | null>(null);
    const [pending, startTransition] = useTransition();

    const results = useMemo(() => {
        const q = query.trim();
        if (!q) return books;
        return books.filter((book) => book.name.includes(q) || book.author.includes(q));
    }, [books, query]);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set('roundId', roundId);
        setMessage(null);
        startTransition(async () => {
            const result = await saveRoundContents(formData);
            if (result.ok) {
                setErrors({});
                setMessage({ tone: 'status', text: '저장했어요' });
                return;
            }
            setErrors(result.error.fieldErrors ?? {});
            setMessage({ tone: 'alert', text: result.error.message });
        });
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <FormField id="desk-search" label="제목이나 저자로 찾기">
                <Input id="desk-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={INPUT_CLASS} />
            </FormField>
            <fieldset aria-describedby={errors.productId ? 'desk-book-error' : undefined}>
                <legend className="sr-only">답장과 함께 보낼 책</legend>
                <ul className="border-t">
                    {results.map((book) => {
                        const soldOut = book.stock <= 0;
                        return (
                            <li key={book.id} className="border-b">
                                <label className={`flex min-h-12 items-center gap-3 ${soldOut ? 'text-muted-foreground' : 'cursor-pointer'}`}>
                                    <input
                                        type="radio"
                                        name="productId"
                                        value={book.id}
                                        checked={productId === book.id}
                                        onChange={() => setProductId(book.id)}
                                        disabled={soldOut}
                                        className="accent-primary size-4"
                                    />
                                    <span>{book.name}</span>
                                    <span className="text-muted-foreground text-sm">{book.author}</span>
                                    {soldOut ? <SoldOutBadge /> : <span className="text-muted-foreground ml-auto text-sm">재고 {book.stock}</span>}
                                </label>
                            </li>
                        );
                    })}
                    {results.length === 0 && <li className="text-muted-foreground border-b py-3">찾는 책이 없어요</li>}
                </ul>
                {errors.productId && (
                    <p id="desk-book-error" className="text-destructive mt-2 text-sm">
                        {errors.productId}
                    </p>
                )}
            </fieldset>
            <FormField id="desk-reply" label="답장 편지" error={errors.replyLetter}>
                <textarea
                    id="desk-reply"
                    name="replyLetter"
                    defaultValue={savedReply ?? ''}
                    maxLength={REPLY_MAX}
                    className={`${TEXTAREA_CLASS} font-heading min-h-40 leading-loose`}
                    {...fieldDescribedBy('desk-reply', false, errors.replyLetter)}
                />
            </FormField>
            <FormField
                id="desk-postcard"
                label="손글씨 엽서 사진 (선택, 10MB 이하 이미지)"
                hint={postcardUrl ? '새 사진을 고르지 않으면 지금 사진을 그대로 써요' : undefined}
                error={errors.postcard}
            >
                {postcardUrl && (
                    <div className="relative mb-2 aspect-4/3 w-40 overflow-hidden rounded-lg border">
                        <Image src={postcardUrl} alt="지금 올린 엽서 사진" fill unoptimized sizes="160px" className="object-cover" />
                    </div>
                )}
                <Input
                    id="desk-postcard"
                    name="postcard"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className={`${INPUT_CLASS} py-2 file:mr-3`}
                    {...fieldDescribedBy('desk-postcard', Boolean(postcardUrl), errors.postcard)}
                />
            </FormField>
            <div>
                <Button type="submit" variant="ghost" disabled={pending} className="border-input h-11 border px-5 text-base">
                    {pending ? '저장하는 중이에요' : '책과 답장 저장'}
                </Button>
                <p role={message?.tone === 'alert' ? 'alert' : 'status'} className={`mt-2 min-h-6 text-sm ${message?.tone === 'alert' ? 'text-destructive' : ''}`}>
                    {message?.text}
                </p>
            </div>
        </form>
    );
}
