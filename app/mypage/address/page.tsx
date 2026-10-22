import type { Metadata } from 'next';
import { Suspense } from 'react';
import { saveShippingAddress } from '@/app/mypage/address/actions';
import { ShippingAddressForm } from '@/components/ShippingAddressForm';
import { requireMember } from '@/lib/auth/guards';
import { getShippingAddress } from '@/lib/data/cart';

export const metadata: Metadata = { title: '기본 배송지' };

// 세션을 읽으므로 <Suspense> 안 (CONV-07). 비회원은 로그인 후 돌아온다 (AC-05-6)
async function AddressForm() {
    await requireMember('/mypage/address');
    const address = await getShippingAddress();
    return <ShippingAddressForm defaults={address} saveShippingAddress={saveShippingAddress} />;
}

// SCR-07 기본 배송지: 받는 사람 → 연락처 → 주소 → [저장]. 주문서·편지 띄우기에 먼저 채워진다 (AC-08-2)
export default function AddressPage() {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-10">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">기본 배송지</h1>
            <p className="text-muted-foreground mt-3 text-lg leading-relaxed">
                주문과 편지 띄우기에 이 주소를 먼저 채워 드려요. 이미 한 주문의 주소는 바뀌지 않아요.
            </p>
            <Suspense fallback={<p className="text-muted-foreground mt-8">주소를 꺼내 오는 중이에요.</p>}>
                <AddressForm />
            </Suspense>
        </main>
    );
}
