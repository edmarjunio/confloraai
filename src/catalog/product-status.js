// The editable status takes precedence over the legacy uppercase Firestore field.
function productStatus(product) {
  return String(product.status || product.STATUS || 'ATIVO').trim().toUpperCase();
}

module.exports = { productStatus };
