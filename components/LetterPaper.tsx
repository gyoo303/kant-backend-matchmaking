import type { ReactNode } from 'react';

// 편지지 (design-system §5, UX-D-05): --card 상자, 윗선 3px --wood, 바탕체, 줄 간격 2.0, 한 줄 최대 max-w-xl (UX-8)
// 손편지·답장·마지막 인사·서재 작업의 편지 전문이 같이 쓴다. 입력칸을 넣을 때는 children으로 받는다
export function LetterPaper({ children, label, className = '' }: { children: ReactNode; label?: string; className?: string }) {
    return (
        <div className={`bg-card border-t-wood rounded-lg border border-t-3 px-6 py-6 md:px-10 md:py-8 ${className}`}>
            {label && <p className="text-muted-foreground mb-3 text-sm">{label}</p>}
            <div className="font-heading max-w-xl text-lg leading-loose whitespace-pre-line">{children}</div>
        </div>
    );
}
