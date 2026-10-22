// 발송 완료 코드 (SCR-19, AC-15-1·2): heading 글꼴 text-5xl. 스크린 리더는 숫자를 한 자리씩 읽는다
export function UnboxingCode({ code }: { code: string }) {
    return (
        <div role="status" className="bg-card rounded-lg border p-8 text-center">
            <p>발송했어요. 손글씨 카드에 이 코드를 적어 주세요.</p>
            <p aria-label={`언박싱 코드 ${code.split('').join(' ')}`} className="font-heading mt-3 text-5xl tracking-widest">
                {code}
            </p>
            <p className="text-muted-foreground mt-3 text-sm">이 코드는 발송한 회차에서 다시 볼 수 있어요</p>
        </div>
    );
}
