const { config } = require("../config/env");
const { onlyDigits, formatBRL } = require("../shared/text");

function requireWhatsappConfig() {
  if (!config.whatsapp.graphVersion) {
    throw new Error("WHATSAPP_GRAPH_VERSION não configurada.");
  }
  if (!config.whatsapp.phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID não configurado.");
  }
  if (!config.whatsapp.token) {
    throw new Error("WHATSAPP_TOKEN não configurado.");
  }
}

function graphBaseUrl() {
  requireWhatsappConfig();
  return `https://graph.facebook.com/${config.whatsapp.graphVersion}`;
}

async function graphRequest(path, options = {}) {
  const response = await fetch(`${graphBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.whatsapp.token}`,
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
  });

  const bodyText = await response.text();
  let data;
  try {
    data = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    data = { raw: bodyText };
  }

  if (!response.ok) {
    const error = new Error(`WhatsApp API HTTP ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

function sendMessage(payload) {
  return graphRequest(`/${config.whatsapp.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
}

function sendText(to, text) {
  const phone = onlyDigits(to);
  if (!phone || !text) {
    throw new Error("Destino ou texto inválido.");
  }

  return sendMessage({
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: { body: String(text), preview_url: false },
  });
}

function sendTemplate(to, templateName, components = []) {
  const phone = onlyDigits(to);
  if (!phone) {
    throw new Error("Destino inválido.");
  }
  if (!templateName) {
    throw new Error("Template não configurado.");
  }

  return sendMessage({
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: config.whatsapp.templateLanguage },
      components,
    },
  });
}

function textParameter(value) {
  return { type: "text", text: String(value ?? "") };
}

async function retrieveMediaUrl(mediaId) {
  const query = new URLSearchParams({
    phone_number_id: config.whatsapp.phoneNumberId,
  });
  return graphRequest(`/${mediaId}?${query.toString()}`, { method: "GET" });
}

async function downloadMedia(mediaId) {
  const metadata = await retrieveMediaUrl(mediaId);
  if (!metadata.url) {
    throw new Error("Meta não retornou URL da mídia.");
  }

  const response = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${config.whatsapp.token}` },
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar mídia: HTTP ${response.status}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType:
      metadata.mime_type ||
      response.headers.get("content-type") ||
      "application/octet-stream",
  };
}

async function uploadMedia(buffer, mimeType, filename = "arquivo") {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", new Blob([buffer], { type: mimeType }), filename);

  return graphRequest(`/${config.whatsapp.phoneNumberId}/media`, {
    method: "POST",
    body: form,
  });
}

async function cloneMedia(mediaId, mimeType, filename) {
  const downloaded = await downloadMedia(mediaId);
  const uploaded = await uploadMedia(
    downloaded.buffer,
    mimeType || downloaded.mimeType,
    filename || "arquivo",
  );

  if (!uploaded.id) {
    throw new Error("Upload de mídia não retornou ID.");
  }
  return uploaded.id;
}

async function notifyOwnerOrder(order) {
  if (!config.whatsapp.ownerNumber) {
    throw new Error("OWNER_WHATSAPP_NUMBER não configurado.");
  }

  const items = (order.items || [])
    .map(
      (item) =>
        `${item.quantity}x ${item.description} - ${formatBRL(item.subtotal)}`,
    )
    .join(" | ");

  const fulfillment =
    order.fulfillment === "entrega"
      ? `Entrega - ${order.address || "endereço não informado"}`
      : "Retirada";

  const parameters = [
    order.code,
    order.customerName || "Cliente",
    order.phone,
    items,
    formatBRL(order.total),
    fulfillment,
    String(order.paymentMethod || "").toUpperCase(),
  ].map(textParameter);

  return sendTemplate(
    config.whatsapp.ownerNumber,
    config.whatsapp.orderTemplate,
    [{ type: "body", parameters }],
  );
}

async function forwardReceiptToOwner({
  mediaType,
  mediaId,
  mimeType,
  filename,
  order,
}) {
  if (!config.whatsapp.ownerNumber) {
    throw new Error("OWNER_WHATSAPP_NUMBER não configurado.");
  }

  const templateName =
    mediaType === "image"
      ? config.whatsapp.receiptImageTemplate
      : config.whatsapp.receiptDocumentTemplate;

  let reusableMediaId = mediaId;
  try {
    const components = buildReceiptTemplateComponents(
      mediaType,
      reusableMediaId,
      filename,
      order,
    );
    return await sendTemplate(
      config.whatsapp.ownerNumber,
      templateName,
      components,
    );
  } catch {
    reusableMediaId = await cloneMedia(mediaId, mimeType, filename);
    const components = buildReceiptTemplateComponents(
      mediaType,
      reusableMediaId,
      filename,
      order,
    );
    return sendTemplate(config.whatsapp.ownerNumber, templateName, components);
  }
}

function buildReceiptTemplateComponents(mediaType, mediaId, filename, order) {
  const headerParameter =
    mediaType === "image"
      ? { type: "image", image: { id: mediaId } }
      : {
          type: "document",
          document: { id: mediaId, ...(filename ? { filename } : {}) },
        };

  return [
    { type: "header", parameters: [headerParameter] },
    {
      type: "body",
      parameters: [
        textParameter(order.code),
        textParameter(order.customerName || "Cliente"),
        textParameter(order.phone),
        textParameter(formatBRL(order.total)),
      ],
    },
  ];
}

module.exports = {
  sendText,
  notifyOwnerOrder,
  forwardReceiptToOwner,
};
