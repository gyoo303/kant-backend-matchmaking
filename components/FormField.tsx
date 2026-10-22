import type { ReactNode } from 'react';

// components/ui/input의 Input에 덧붙이는 클래스: 높이 44px, 카드 바탕, 16px 글자(iOS 확대 방지, design-system §3)
export const INPUT_CLASS = 'bg-card h-11 px-3 md:text-base';
// 긴 글 입력은 components/ui에 없어 Input과 같은 모양으로 맞춘다 (design-system §5 textarea)
export const TEXTAREA_CLASS =
    'bg-card border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 min-h-32 w-full rounded-lg border px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-3 aria-invalid:ring-3 disabled:opacity-50';

// 라벨은 칸 위, 도움말·오류는 칸 바로 아래. 오류는 --destructive 글자 + aria-describedby (UX-15)
// 칸 쪽은 aria-invalid·aria-describedby를 fieldDescribedBy()로 받는다
export function FormField({
    id,
    label,
    hint,
    error,
    children,
}: {
    id: string;
    label: ReactNode;
    hint?: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id}>{label}</label>
            {children}
            {hint && (
                <p id={`${id}-hint`} className="text-muted-foreground text-sm">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-error`} className="text-destructive text-sm">
                    {error}
                </p>
            )}
        </div>
    );
}

export function fieldDescribedBy(id: string, hint: boolean, error: string | undefined) {
    const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');
    return { 'aria-invalid': error ? true : undefined, 'aria-describedby': ids || undefined };
}
