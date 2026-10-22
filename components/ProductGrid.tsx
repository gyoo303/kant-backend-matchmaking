import type { Product } from '@/types/product';
import { ProductCard } from './ProductCard';

// 목록 격자: 360px 2열 / 768px 3열 / 1280px 4열, 카드 간격 동일 (CONV-08, NFR-02). key는 도메인 id (CONV-09)
export function ProductGrid({ products, className = '' }: { products: Product[]; className?: string }) {
    return (
        <ul className={`grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4 ${className}`}>
            {products.map((product) => (
                <li key={product.id}>
                    <ProductCard product={product} />
                </li>
            ))}
        </ul>
    );
}
