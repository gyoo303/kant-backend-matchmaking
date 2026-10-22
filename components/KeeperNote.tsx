// 책방지기 노트 (design-system §5, UX-D-05): 상세 화면 맨 위, 바탕체 큰 글씨 (INV-02, UX-6·8)
export function KeeperNote({ note }: { note: string }) {
    return (
        <section aria-labelledby="keeper-note-label" className="bg-card rounded-lg border p-6 md:p-8">
            <h2 id="keeper-note-label" className="text-muted-foreground text-sm">
                책방지기 노트
            </h2>
            <blockquote className="font-heading mt-3 max-w-xl text-xl leading-loose whitespace-pre-line md:text-2xl md:leading-loose">
                {note}
            </blockquote>
            <p className="text-muted-foreground mt-4 text-sm">ㅡ 책방지기</p>
        </section>
    );
}
