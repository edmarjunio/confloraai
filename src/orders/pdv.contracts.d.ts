export type PaymentMethod = 'PIX' | 'DINHEIRO' | 'DEBITO' | 'CREDITO' | 'FIADO' | 'SALDO_CLIENTE' | 'MISTO';
export interface StaffActor { id: string; name: string; role: 'ADMIN' | 'CAIXA' | 'VENDEDOR' | 'ENTREGADOR'; }
export interface SaleInput {
  requestId: string;
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: PaymentMethod;
  paymentParts?: Array<{ method: Exclude<PaymentMethod, 'MISTO'>; amount: number }>;
  deferToCashier?: boolean;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  discountPercent?: number;
  orderType?: 'PICKUP' | 'DELIVERY';
  freightValue?: number;
  deliveryAddress?: string;
  deliveryLocation?: { lat: number; lng: number; address?: string; reference?: string };
  cashReceived?: number | null;
  notes?: string;
}
export interface VerifiedPix { txid: string; endToEndId: string; amountMinor: number; }
export interface DebtSettlementInput {
  id: string; customerKey: string; amount: number;
  paymentMethod: 'DINHEIRO' | 'DEBITO' | 'CREDITO' | 'PIX' | 'MISTO';
  paymentParts?: Array<{ method: 'DINHEIRO' | 'DEBITO' | 'CREDITO' | 'PIX'; amount: number }>;
  verification?: { manualPixProofSeen: boolean; manualPixNote: string; manualPixProofId: string };
  receivedBy: StaffActor; notes: string;
}
