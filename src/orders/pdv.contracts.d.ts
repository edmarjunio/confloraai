export type PaymentMethod = 'PIX' | 'DINHEIRO' | 'DEBITO' | 'CREDITO' | 'FIADO';
export interface StaffActor { id: string; name: string; role: 'ADMIN' | 'CAIXA' | 'VENDEDOR'; }
export interface SaleInput {
  requestId: string;
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: PaymentMethod;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  discountPercent?: number;
  orderType?: 'PICKUP' | 'DELIVERY';
  freightValue?: number;
  deliveryAddress?: string;
  cashReceived?: number | null;
  notes?: string;
}
export interface VerifiedPix { txid: string; endToEndId: string; amountMinor: number; }
export interface DebtSettlementInput {
  id: string; customerKey: string; amount: number;
  paymentMethod: 'DINHEIRO' | 'DEBITO' | 'CREDITO';
  receivedBy: StaffActor; notes: string;
}
