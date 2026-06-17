export type PaymentProviderName = 'paypal';

export type ProviderCreateOrderInput = {
  currency: string;
  subtotal: number;
  shipping: number;
  tax: number;
  items: Array<{
    name: string;
    quantity: number;
    unit_amount: number;
    category?: 'PHYSICAL_GOODS' | 'DIGITAL_GOODS';
  }>;
  requestId?: string;
  referenceId?: string;
};

export type ProviderCreateOrderResult = {
  providerOrderId: string;
  approveUrl?: string | null;
  raw?: any;
};

export type ProviderCaptureOrderResult = {
  providerOrderId: string;
  providerCaptureId?: string | null;
  paypalFeeAmount?: number | null;
  raw?: any;
};

export interface PaymentProvider {
  name: PaymentProviderName;
  createOrder(input: ProviderCreateOrderInput): Promise<ProviderCreateOrderResult>;
  captureOrder(providerOrderId: string, requestId?: string): Promise<ProviderCaptureOrderResult>;
  verifyWebhookSignature?(args: { headers: Record<string, string | undefined>; rawBody: string }): Promise<boolean>;
}
