import Image from 'next/image';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import type { UnboxedRound } from '@/domains/subscriptions/types/round.types';
import { BookCover } from './BookCover';
import { OUTLINE_BUTTON } from './button-styles';
import { LetterPaper } from './LetterPaper';

// 언박싱 뒤 (SCR-16 열린 뒤, AC-16-2): [표지·제목·저자 | 책방지기의 답장 → 엽서 사진(있을 때만) → [나의 서가에 한 줄 남기기]]
// 이 화면에 오는 데이터는 언박싱 성공 뒤에만 서버가 만든다 (NFR-08). reveal이면 공개 전환(motion-safe, NFR-10)
export function UnboxedView({ round, reveal = false }: { round: UnboxedRound; reveal?: boolean }) {
    const motion = reveal ? 'motion-safe:animate-unbox-reveal' : '';
    return (
        <div className={`grid items-start gap-8 md:grid-cols-3 md:gap-12 ${motion}`}>
            <div className="w-full max-w-50 md:max-w-none">
                <BookCover key={round.product.imageUrl} src={round.product.imageUrl} title={round.product.name} sizes="(min-width: 768px) 280px, 200px" />
                <h1 className="font-heading mt-4 text-2xl leading-snug font-bold">{round.product.name}</h1>
                <p className="text-muted-foreground mt-1">{round.product.author}</p>
            </div>
            <div className="min-w-0 md:col-span-2">
                <LetterPaper label="책방지기의 답장">{round.replyLetter}</LetterPaper>
                {round.postcardUrl && (
                    <div className="relative mt-6 aspect-4/3 w-full max-w-sm overflow-hidden rounded-lg border">
                        <Image src={round.postcardUrl} alt="책방지기가 보낸 손글씨 엽서 사진" fill unoptimized sizes="384px" className="object-cover" />
                    </div>
                )}
                <Link href="/mypage/shelf" className={buttonVariants({ variant: 'ghost', className: `mt-6 ${OUTLINE_BUTTON}` })}>
                    나의 서가에 한 줄 남기기
                </Link>
            </div>
        </div>
    );
}
