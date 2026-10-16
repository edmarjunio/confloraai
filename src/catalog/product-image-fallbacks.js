const PRODUCT_IMAGE_FALLBACKS = Object.freeze({
  Palmeiras: 'https://images.unsplash.com/photo-1596726596162-421712a433a0?w=800&auto=format&fit=crop&q=80',
  Hortifrutti: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=800&auto=format&fit=crop&q=80',
  Horta: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  Frutífera: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=800&auto=format&fit=crop&q=80',
  Frutíferas: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=800&auto=format&fit=crop&q=80',
  'Flores & Ornamentais': 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?w=800&auto=format&fit=crop&q=80',
  'Horta & Temperos': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  'Agromadeiras & Rurais': 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80',
  'Gramas & Insumos': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80',
  'Pets & Animais': 'https://images.unsplash.com/photo-1535083783855-76ae62b2914e?w=800&auto=format&fit=crop&q=80',
  Pets: 'https://images.unsplash.com/photo-1535083783855-76ae62b2914e?w=800&auto=format&fit=crop&q=80',
  'Plantas / Mudas': 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=800&auto=format&fit=crop&q=80',
  DEFAULT: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=800&auto=format&fit=crop&q=80',
});

function getProductImageFallback(category) {
  return PRODUCT_IMAGE_FALLBACKS[category] || PRODUCT_IMAGE_FALLBACKS.DEFAULT;
}

module.exports = { PRODUCT_IMAGE_FALLBACKS, getProductImageFallback };
