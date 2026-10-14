import { useState } from 'react';
import { loadCatalog, tenant } from '../api/store.mjs';
import { useResource } from '../shared/hooks.mjs';
import { Modal, ResourceState } from '../shared/ui.jsx';
import { useCart } from '../cart/useCart.mjs';
import { Checkout } from '../cart/Checkout.jsx';
import { ProductGrid } from './ProductGrid.jsx';
import { ProductDetails } from './ProductDetails.jsx';
import { Assistant } from './Assistant.jsx';
export default function CatalogPage() {
  const resource = useResource(loadCatalog, []);
  const cart = useCart(`catalog-cart:${tenant}`);
  const [modal, setModal] = useState('');
  const productId = location.pathname.match(/\/products\/([^/]+)/)?.[1];
  const products = resource.data?.products || [];
  const config = resource.data?.config;
  return <ResourceState resource={resource}>{config && <>
    <section className="hero"><div><h1>{config.identity.name}</h1><p>{config.identity.subtitle}</p></div><div className="toolbar"><button className="primary" onClick={() => setModal('cart')}>{'nav.cart'.tr}{` (${cart.items.length})`}</button>{config.assistant.enabled && <button onClick={() => setModal('assistant')}>{'assistant.title'.tr}</button>}</div></section>
    {productId ? <ProductDetails product={products.find(product => product.id === decodeURIComponent(productId))} onAdd={cart.add} /> : <ProductGrid products={products} config={config} onAdd={cart.add} />}
    {modal === 'cart' && <Modal title={'nav.cart'.tr} onClose={() => setModal('')}><Checkout cart={cart} products={products} config={config} /></Modal>}
    {modal === 'assistant' && <Modal title={'assistant.title'.tr} onClose={() => setModal('')}><Assistant products={products} config={config} onAdd={cart.add} /></Modal>}
  </>}</ResourceState>;
}
