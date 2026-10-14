import { useState } from 'react';
import { basePath } from '../api/store.mjs';
import { money } from '../i18n/runtime.mjs';
import { Modal, EmptyState } from '../shared/ui.jsx';
export function ProductDetails({ product, onAdd }) {
  const [zoom, setZoom] = useState('');
  if (!product) return <EmptyState />;
  const images = [...new Set([product.imageUrl, ...(product.images || []).map(item => item.url)].filter(Boolean))];
  return <article className="panel product-details"><a href={basePath || '/'}>{'common.back'.tr}</a><h1>{product.name}</h1>
    <div className="gallery">{images.map(url => <button key={url} onClick={() => setZoom(url)}><img src={url} alt={product.name} /></button>)}</div>
    {product.imageIsIllustrative && <small>{'catalog.illustrative'.tr}</small>}
    <h2>{money(product.price?.amountMinor)}</h2><button className="primary" onClick={() => onAdd(product)} disabled={product.isAvailable === false}>{'common.add'.tr}</button>
    <h2>{'catalog.description'.tr}</h2><p>{product.description}</p>
    {Object.entries(product.specifications || {}).map(([key, value]) => <p key={key}><strong>{value.label}</strong>{value.value}</p>)}
    {(product.contentSections || []).map((section, index) => <section key={index}><h3>{section.title}</h3><p>{section.body}</p></section>)}
    {zoom && <Modal title={product.name} onClose={() => setZoom('')}><img className="zoom-image" src={zoom} alt={product.name} /></Modal>}
  </article>;
}
