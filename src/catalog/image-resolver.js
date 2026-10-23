/** Missing photos stay visibly empty instead of borrowing another product's picture. */
function resolveHdProductImage() { return '/store-assets/placeholder.svg'; }

function isKgProduct(name = '', unit = '') {
  return /(?:\bKG\b|\bQUILO\b|\bKILO\b)/i.test(`${name} ${unit}`);
}

module.exports = { resolveHdProductImage, isKgProduct };
