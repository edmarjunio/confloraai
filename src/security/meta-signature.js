const crypto = require("crypto");

function isValidMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!rawBody || !signatureHeader || !appSecret) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;

  const received = String(signatureHeader);
  if (received.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(received, "utf8"),
    Buffer.from(expected, "utf8"),
  );
}

module.exports = { isValidMetaSignature };
