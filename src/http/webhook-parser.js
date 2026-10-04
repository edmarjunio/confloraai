const { onlyDigits } = require("../shared/text");

function extractInboundMessages(body) {
  const result = [];

  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") {
        continue;
      }

      const value = change.value || {};
      const namesByPhone = new Map(
        (value.contacts || []).map((contact) => [
          onlyDigits(contact.wa_id),
          contact.profile?.name || "Cliente",
        ]),
      );

      for (const message of value.messages || []) {
        const phone = onlyDigits(message.from);
        const profileName = namesByPhone.get(phone) || "Cliente";

        if (message.type === "text") {
          result.push({
            kind: "text",
            phone,
            profileName,
            messageId: message.id,
            message: message.text?.body || "",
          });
          continue;
        }

        if (message.type === "image") {
          result.push({
            kind: "media",
            phone,
            profileName,
            messageId: message.id,
            mediaType: "image",
            mediaId: message.image?.id,
            mimeType: message.image?.mime_type || "image/jpeg",
            filename: null,
          });
          continue;
        }

        if (message.type === "document") {
          result.push({
            kind: "media",
            phone,
            profileName,
            messageId: message.id,
            mediaType: "document",
            mediaId: message.document?.id,
            mimeType: message.document?.mime_type || "",
            filename: message.document?.filename || "arquivo.pdf",
          });
        }
      }
    }
  }

  return result;
}

module.exports = { extractInboundMessages };
