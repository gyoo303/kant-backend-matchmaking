import type { Product } from '@/types/product';

// AR-API §1.2. purchasable = 재고가 있어 주문 대상이 되는 줄(AC-07-5)
export interface CartLine {
    product: Product;
    quantity: number;
    purchasable: boolean;
}
