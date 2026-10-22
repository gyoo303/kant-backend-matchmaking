// "주문 접수 → 발송됨" 2단계 표시 (AC-09-1). 택배 정보·진행률 숫자는 두지 않는다 (design-system §8)
export function OrderSteps({ shipped }: { shipped: boolean }) {
    const dot = (on: boolean) => `border-primary size-3 shrink-0 rounded-full border-2 ${on ? 'bg-primary' : 'bg-background'}`;
    return (
        <p className="mt-3 flex items-center" aria-label={`주문 접수, 발송됨 중 ${shipped ? '발송됨' : '주문 접수'} 단계`}>
            <span aria-hidden="true" className={dot(true)} />
            <span aria-hidden="true" className="mr-2.5 ml-1.5">
                주문 접수
            </span>
            <span aria-hidden="true" className={`h-0.5 w-12 shrink-0 ${shipped ? 'bg-primary' : 'bg-border'}`} />
            <span aria-hidden="true" className={dot(shipped)} />
            <span aria-hidden="true" className="ml-1.5">
                발송됨
            </span>
        </p>
    );
}
