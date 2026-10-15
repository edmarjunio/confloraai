import { create } from 'zustand';

/**
 * Generic Tenant & Branding Store
 * Allows dynamic white-label branding, customization, and multi-tenant operation.
 */
export const useTenantStore = create((set) => ({
  tenantId: 'conflora',
  slug: 'conflora',
  identity: {
    name: 'Conflora Horta e Viveiro',
    subtitle: 'Horta e Viveiro',
    niche: 'Plantas, mudas e insumos',
    city: 'Mineiros',
    region: 'GO',
    currency: 'BRL',
    locale: 'pt-BR',
  },
  branding: {
    logoUrl: '/store-assets/brands/conflora-logo.png',
    iconUrl: '/store-assets/brands/conflora-icon.png',
    colors: {
      primary: '#2E9348',
      accent: '#F5C518',
      background: '#FFFFFF',
      text: '#1A1A1A',
    },
  },
  checkout: {
    enabledPayments: ['PIX', 'CARD', 'CASH'],
    pix: {
      key: '',
      recipientName: 'Conflora Horta e Viveiro',
    },
    contactPhone: '5564999351616',
    delivery: {
      enabled: true,
      label: 'Entrega local',
      serviceAreas: ['Mineiros - GO'],
      feeMinor: 0,
    },
    pickup: {
      enabled: true,
      label: 'Retirada na loja',
      address: '',
    },
  },
  assistant: {
    enabled: true,
    displayName: 'Conflora AI',
    welcomeMessage: 'Olá! Conte o que você procura. Vamos encontrar a melhor opção para você?',
    suggestedQuestions: [
      'Plantas que gostam de sol pleno',
      'Mudas de árvores frutíferas',
      'Temperos e hortaliças para cultivar em casa',
      'Substratos e adubos recomendados',
    ],
  },

  setTenantConfig: (config) => {
    if (!config) {
      return;
    }
    set((state) => ({
      tenantId: config.tenantId || state.tenantId,
      slug: config.slug || state.slug,
      identity: { ...state.identity, ...(config.identity || {}) },
      branding: { ...state.branding, ...(config.branding || {}) },
      checkout: { ...state.checkout, ...(config.checkout || {}) },
      assistant: { ...state.assistant, ...(config.assistant || {}) },
    }));
  },
}));
