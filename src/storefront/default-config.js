function defaultStoreConfig(slug, name = "Minha Loja") {
  return {
    tenantId: slug,
    slug,
    version: 1,
    identity: {
      name,
      subtitle: "Produtos para o seu dia a dia",
      niche: "Varejo",
      city: "",
      region: "",
      locale: "pt-BR",
      currency: "BRL",
    },
    branding: {
      logoUrl: "",
      iconUrl: "",
      colors: {
        primary: "#2E9348",
        accent: "#F5C518",
        text: "#1A1A1A",
        background: "#F8F9FA",
      },
    },
    categories: [],
    checkout: {
      enabledPayments: ["CARD", "CASH"],
      pix: { key: "", recipientName: "" },
      contactPhone: "",
      completionMode: "IN_APP",
      delivery: {
        enabled: false,
        label: "Entrega",
        serviceAreas: [],
        feeMinor: 0,
      },
      pickup: { enabled: true, label: "Retirada no local", address: "" },
    },
    assistant: {
      enabled: true,
      displayName: "Assistente da loja",
      welcomeMessage: "Conte o que você procura. Vamos encontrar uma opção?",
      suggestedQuestions: [
        "Preciso de ajuda para escolher",
        "Quais são os mais vendidos?",
      ],
    },
  };
}
module.exports = { defaultStoreConfig };
