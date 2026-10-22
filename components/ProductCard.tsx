import Link from 'next/link';
import { formatPrice } from '@/shared/utils/formatPrice';
import type { Product } from '@/types/product';
import { BookCover } from './BookCover';
import { SoldOutBadge, ThemeBadge } from './BookBadges';

// AR-API §4.1 (KANT-C8)
interface ProductCardProps {
    product: Product;
    href?: string;
}

// 표지 → 제목 → 저자 → 가격 + 테마(또는 품절) 배지. 카드 전체가 링크 (design-system §5)
export function ProductCard({ product, href = `/products/${product.id}` }: ProductCardProps) {
    const soldOut = product.stock <= 0;

    return (
        <Link href={href} className="group flex h-full flex-col rounded-lg">
            <BookCover
                key={product.imageUrl}
                src={product.imageUrl}
                title={product.name}
                theme={product.theme}
                soldOut={soldOut}
                sizes="(min-width: 1280px) 270px, (min-width: 768px) 33vw, 50vw"
            />
            <div className="mt-3 flex flex-1 flex-col">
                <h3 className="font-heading text-lg leading-snug font-bold group-hover:underline">{product.name}</h3>
                <p className="text-muted-foreground text-sm">{product.author}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                    <span>{formatPrice(product.price)}</span>
                    {soldOut ? <SoldOutBadge /> : <ThemeBadge theme={product.theme} />}
                </div>
            </div>
        </Link>
    );
}
