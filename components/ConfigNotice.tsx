// 환경 변수 누락 안내 (AC-21-4). 화면을 멈추지 않고 어떤 값이 필요한지 알려 준다.
export function ConfigNotice({ missing }: { missing: string[] }) {
    return (
        <div role="alert" className="bg-destructive-soft text-destructive-soft-foreground">
            <div className="mx-auto w-full max-w-6xl px-4 py-3 md:px-8">
                <p>사이트 설정 값이 비어 있어 책 정보를 불러올 수 없어요.</p>
                <p className="mt-1 text-sm">
                    <code>.env.local</code>에 {missing.join(', ')} 값을 넣고 다시 실행해 주세요. (<code>.env.example</code> 참고)
                </p>
            </div>
        </div>
    );
}
