// AR-API §1.2 결제 대상(주문·회차 공용, D-002)과 결제창 요청값
export type PaymentTarget = { kind: 'order'; orderId: string } | { kind: 'round'; roundId: string };

// 토스 결제창 requestPayment에 넘기는 값. amount는 서버가 계산한 값(NFR-19)
export interface PaymentRequest {
    pgOrderId: string;
    amount: number;
    orderName: string;
    customerKey: string;
}
