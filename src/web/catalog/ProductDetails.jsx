import { Fragment, useState } from "react";
import { basePath } from "../api/store.mjs";
import { money } from "../i18n/runtime.mjs";
import { Modal, EmptyState } from "../shared/ui.jsx";
export function ProductDetails({ product, onAdd }) {
  const [zoom, setZoom] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  if (!product) {
    return <EmptyState />;
  }
  const images = [
    ...new Set(
      [
        product.imageUrl || "/store-assets/placeholder.svg",
        ...(product.images || []).map((item) => item.url),
      ].filter(Boolean),
    ),
  ];
  return (
    <article className="product-details">
      <a href={basePath || "/"}>{"common.back".tr}</a>
      <div className="detail-grid">
        <div className="detail-gallery">
          <button
            className="detail-hero detail-zoom"
            onClick={() => setZoom(selectedImage || images[0])}
          >
            <img
              className="detail-photo"
              src={selectedImage || images[0]}
              alt={product.name}
            />
          </button>
          <div className="thumbnails" hidden={images.length < 2}>
            {images.map((url) => (
              <button
                key={url}
                onClick={() => setSelectedImage(url)}
                aria-pressed={(selectedImage || images[0]) === url}
              >
                <img src={url} alt={product.name} />
              </button>
            ))}
          </div>
          {product.imageIsIllustrative && (
            <small>{"catalog.illustrative".tr}</small>
          )}
        </div>
        <div className="detail-copy">
          <small className="detail-category">{product.categoryName}</small>
          <h1>{product.name}</h1>
          <strong className="detail-price">
            {money(product.price?.amountMinor)}
          </strong>
          <p>{product.description}</p>
          <div className="purchase-row">
            <button
              className="primary"
              onClick={() => onAdd(product)}
              disabled={
                product.isAvailable === false ||
                (product.stock?.tracked &&
                  product.stock.quantity < (product.saleUnit?.minimum || 1))
              }
            >
              {"common.add".tr}
            </button>
          </div>
          <dl
            className="specifications"
            hidden={!Object.keys(product.specifications || {}).length}
          >
            {Object.entries(product.specifications || {}).map(
              ([key, value]) => (
                <Fragment key={key}>
                  <dt>{value.label}</dt>
                  <dd>
                    {value.value} {value.unit || ""}
                  </dd>
                </Fragment>
              ),
            )}
          </dl>
        </div>
      </div>
      {(product.contentSections || []).map((section, index) => (
        <section className="content-section" key={index}>
          <h3>{section.title}</h3>
          <p>{section.body}</p>
        </section>
      ))}
      {zoom && (
        <Modal title={product.name} onClose={() => setZoom("")}>
          <img className="zoom-image" src={zoom} alt={product.name} />
        </Modal>
      )}
    </article>
  );
}
