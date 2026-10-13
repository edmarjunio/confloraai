// The editable status takes precedence over the legacy spreadsheet column.
function productStatus(product) {
  return String(product.status || product.STATUS || 'ATIVO').trim().toUpperCase();
}

module.exports = { productStatus };
