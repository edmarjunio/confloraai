// Utilitário de Geração de Código PIX Padrão BR Code (Banco Central / EMV)

function crc16(str) {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function formatField(id, val) {
  const len = String(val.length).padStart(2, "0");
  return `${id}${len}${val}`;
}

function generatePixCode({
  key = "64999351616",
  name = "Conflora Horta e Viveiro",
  city = "Mineiros",
  amount = 0,
  txid = "***",
}) {
  const cleanKey = String(key || "64999351616").trim();
  const gui = formatField("00", "BR.GOV.BCB.PIX");
  const keyField = formatField("01", cleanKey);
  const merchantAcc = formatField("26", gui + keyField);
  const mcc = formatField("52", "0000");
  const currency = formatField("53", "986");
  const amountStr = Number(amount || 0).toFixed(2);
  const amountField = formatField("54", amountStr);
  const country = formatField("58", "BR");
  const cleanName = String(name || "Conflora")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .slice(0, 25);
  const nameField = formatField("59", cleanName);
  const cleanCity = String(city || "Mineiros")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .slice(0, 15);
  const cityField = formatField("60", cleanCity);
  const ref = formatField("05", String(txid || "***").slice(0, 25));
  const addField = formatField("62", ref);

  const payloadWithoutCRC =
    formatField("00", "01") +
    merchantAcc +
    mcc +
    currency +
    amountField +
    country +
    nameField +
    cityField +
    addField +
    "6304";

  return payloadWithoutCRC + crc16(payloadWithoutCRC);
}

module.exports = {
  crc16,
  generatePixCode,
};
