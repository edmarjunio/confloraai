function pixMode() { return process.env.PIX_MODE === 'SICREDI' ? 'SICREDI' : 'MANUAL'; }
function validCpf(value) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  return [9, 10].every(length => {
    const sum = [...value.slice(0, length)].reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = sum * 10 % 11;
    return Number(value[length]) === (remainder === 10 ? 0 : remainder);
  });
}
function manualPixSettings({ required = true } = {}) {
  const input = String(process.env.PIX_KEY || process.env.STORE_PIX_KEY || process.env.SICREDI_PIX_KEY || '').replace(/\s/g, '');
  const key = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(input) ? input.replace(/\D/g, '') : input;
  const recipientName = String(process.env.PIX_TITULAR || process.env.SICREDI_BENEFICIARIO || '').trim();
  const configured = Boolean(key && recipientName && (!/^\d{11}$/.test(key) || validCpf(key)));
  if (required && !configured) throw Object.assign(new Error('A loja precisa configurar uma chave Pix válida e o beneficiário antes de receber por Pix.'), { status: 503 });
  return { key: configured ? key : '', recipientName, mode: pixMode(), configured };
}
module.exports = { pixMode, manualPixSettings };
