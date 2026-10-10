export interface StoreConfig {
  tenantId: string;
  slug: string;
  version: number;
  identity: {
    name: string;
    subtitle: string;
    niche: string;
    city: string;
    region: string;
    locale: string;
    currency: string;
  };
  branding: {
    logoUrl: string;
    iconUrl: string;
    colors: {
      primary: string;
      accent: string;
      text: string;
      background: string;
    };
  };
  categories: { id: string; name: string; order: number; isActive: boolean }[];
  checkout: {
    enabledPayments: ("PIX" | "CARD" | "CASH")[];
    pix: { key: string; recipientName: string };
    contactPhone: string;
    delivery: {
      enabled: boolean;
      label: string;
      serviceAreas: string[];
      feeMinor: number;
    };
    pickup: { enabled: boolean; label: string; address: string };
    completionMode: "IN_APP" | "WHATSAPP_HANDOFF";
  };
  assistant: {
    enabled: boolean;
    displayName: string;
    welcomeMessage: string;
    suggestedQuestions: string[];
  };
}
export interface Product {
  tenantId: string;
  id: string;
  slug: string;
  name: string;
  description: string;
  price: { amountMinor: number; currency: string };
  imageUrl: string;
  images: { url: string; alt: string }[];
  categories: string[];
  tags: string[];
  specifications: Record<
    string,
    { label: string; value: string | number | boolean; unit?: string }
  >;
  contentSections: { id: string; title: string; body: string }[];
  isAvailable: boolean;
  stock: { tracked: boolean; quantity: number };
  saleUnit: { code: string; label: string; minimum: number; increment: number };
  salesCount?: number;
  updatedAt: string;
  revision: string;
}
