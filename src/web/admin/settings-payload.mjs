export function settingsPayload(current, values, categories) {
  const config = structuredClone(current.config);
  for (const key of [
    "name",
    "subtitle",
    "city",
    "region",
    "locale",
    "currency",
  ]) {
    config.identity[key] = values[key];
  }
  for (const key of ["primary", "accent", "text", "background"]) {
    config.branding.colors[key] = values[key];
  }
  config.branding.logoUrl = values.logoUrl;
  config.branding.iconUrl = values.iconUrl;
  config.categories = categories;
  config.checkout.contactPhone = values.contactPhone;
  config.checkout.pix = {
    key: values.pixKey,
    recipientName: values.recipientName,
  };
  config.checkout.enabledPayments = ["PIX", "CARD", "CASH"].filter(
    (method) => values[`payment_${method}`] === "on",
  );
  config.checkout.pickup = {
    ...config.checkout.pickup,
    enabled: values.pickup === "on",
    address: values.pickupAddress,
  };
  config.checkout.delivery = {
    ...config.checkout.delivery,
    enabled: values.delivery === "on",
    feeMinor: Math.round(Number(values.fee) * 100),
    serviceAreas: values.serviceAreas
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
  config.assistant = {
    ...config.assistant,
    enabled: values.assistantEnabled === "on",
    mode: values.assistantMode,
    displayName: values.displayName,
    welcomeMessage: values.welcomeMessage,
  };
  return {
    config,
    assistant: {
      ...current.assistant,
      persona: values.persona,
      instructions: values.instructions,
      webSearchEnabled: values.webSearchEnabled === "on",
    },
    ...(values.orderWebhookUrl !== undefined
      ? {
          integrations: {
            orderWebhookUrl: values.orderWebhookUrl,
            webhookSecretRef: values.webhookSecretRef,
          },
        }
      : {}),
  };
}
