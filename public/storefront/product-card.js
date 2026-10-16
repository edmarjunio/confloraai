/* One product card renderer shared by the storefront and the cashier. */
(() => {
  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const getImageCandidates = (product) => {
    product = product && typeof product === "object" ? product : {};
    const images = Array.isArray(product.images) ? product.images : [];
    const alternateImages = Array.isArray(product.imageCandidates) ? product.imageCandidates : [];
    const storedImageId = String(product.imageFileId || product.image_file_id || "").trim();
    const imageProxyId = storedImageId || String(product.id || product.productId || product.sku || "").trim();
    const candidates = [
      ...images,
      ...alternateImages,
      product.image,
      product.imageUrl,
      product.imageurl,
      product.imagePathCache,
      imageProxyId
        ? `/api/images/${encodeURIComponent(imageProxyId)}`
        : "",
    ].map((image) => typeof image === "string"
      ? image.trim()
      : String(image?.url || image?.imageUrl || image?.src || image?.downloadURL || "").trim());
    return [...new Set(candidates.filter((source) => /^https:\/\/(?:firebasestorage|storage)\.googleapis\.com\//i.test(source)
        || /^\/api\/images\//i.test(source)
        || /^\/store-assets\//i.test(source)
        || (product.imageIsIllustrative === true && /^https:\/\/images\.unsplash\.com\//i.test(source))))];
  };

  const getCategory = (product) => String(
    product.categoryName || product.category || product.categoria || "",
  ).trim();

  const getName = (product) => String(product.name || product.descricao || "Produto").trim();

  const getPrice = (product) => {
    const price = product.price?.amountMinor !== undefined
      ? Number(product.price.amountMinor) / 100
      : Number(product.price ?? product.valor_num ?? product.valor ?? 0);
    return Number.isFinite(price) ? price : 0;
  };

  const formatPrice = (price) => new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);

  const heartIcon = (filled) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>`;
  const infoIcon = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>`;
  const cartIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>`;

  class RenderProductCard extends HTMLElement {
    static get observedAttributes() {
      return ["variant", "product-data", "selected", "quantity", "favorite"];
    }

    connectedCallback() {
      this.render();
    }

    set product(value) {
      this._product = value && typeof value === "object" ? value : {};
      if (this.isConnected) this.render();
    }

    get product() {
      return this.readProduct();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    readProduct() {
      if (this._product) return this._product;
      try {
        const product = JSON.parse(this.getAttribute("product-data") || "{}");
        return product && typeof product === "object" ? product : {};
      } catch {
        return {};
      }
    }

    emit(action, event, extra = {}) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const product = this.readProduct();
      this.dispatchEvent(new CustomEvent("cf-product-card-action", {
        bubbles: true,
        composed: true,
        detail: {
          action,
          productId: String(product.id || product.productId || product.sku || ""),
          nativeEvent: event,
          ...extra,
        },
      }));
    }

    renderImage(product, className, alt = getName(product)) {
      const images = getImageCandidates(product);
      const image = document.createElement("render-image");
      image.setAttribute("src", images[0] || "/store-assets/placeholder.svg");
      image.setAttribute("image-candidates", JSON.stringify(images.slice(1)));
      image.setAttribute("fallback-src", product.imageFallbackUrl || "/store-assets/placeholder.svg");
      image.setAttribute("alt", alt);
      image.setAttribute("loading", "lazy");
      image.setAttribute("decoding", "async");
      image.setAttribute("class", className);
      return image.outerHTML;
    }

    renderCashier(product) {
      const id = escapeHtml(product.id || product.productId || product.sku || "");
      const name = getName(product);
      const category = getCategory(product);
      const quantity = Math.max(0, Number(this.getAttribute("quantity") || 0));
      const favorite = this.getAttribute("favorite") === "true";
      const image = this.renderImage(
        product,
        "cf-shared-pdv-image",
        product.imageIsIllustrative ? `Imagem ilustrativa de ${name}` : name,
      );
      this.classList.add("cf-pdv-product-card");
      this.classList.toggle("is-selected", this.getAttribute("selected") === "true" || quantity > 0);
      this.setAttribute("role", "button");
      this.setAttribute("tabindex", "0");
      this.setAttribute("aria-label", `Adicionar ${name} ao carrinho`);
      this.innerHTML = `
        ${quantity > 0 ? `<span aria-label="${quantity} no carrinho" class="cf-pdv-quantity-badge">${quantity}</span>` : ""}
        <div class="cf-shared-pdv-overlay">
          ${category ? `<render-category-tag category="${escapeHtml(category)}" class="cf-pdv-category-label"></render-category-tag>` : ""}
          <button type="button" data-action="info" class="cf-product-info-button cf-pdv-info-action" aria-label="Informações de ${escapeHtml(name)}" title="Informações de ${escapeHtml(name)}">INFO</button>
        </div>
        <div class="cf-shared-pdv-content">
          <div class="cf-shared-pdv-thumbnail">${image}</div>
          <div class="cf-shared-pdv-details">
            <h3 title="${escapeHtml(name)}">${escapeHtml(name)}</h3>
            <div class="cf-shared-pdv-price-row">
              <strong>${formatPrice(getPrice(product))}</strong>
              <button type="button" data-action="favorite" aria-pressed="${favorite}" aria-label="${favorite ? "Remover dos" : "Adicionar aos"} favoritos: ${escapeHtml(name)}" title="${favorite ? "Remover dos" : "Adicionar aos"} favoritos" class="cf-shared-pdv-favorite ${favorite ? "is-favorite" : ""}">${heartIcon(favorite)}</button>
            </div>
          </div>
        </div>`;

      this.onclick = (event) => {
        const actionButton = event.target.closest("[data-action]");
        if (actionButton) {
          this.emit(actionButton.dataset.action, event);
          return;
        }
        this.emit("add", event);
      };
      this.onkeydown = (event) => {
        if (event.target !== this || !["Enter", " "].includes(event.key)) return;
        this.emit("add", event);
      };
    }

    renderLegacyCatalog(product) {
      const id = String(product.id || product.productId || product.sku || "");
      const name = getName(product);
      const category = getCategory(product);
      const images = getImageCandidates(product);
      const byKg = String(product.unit || product.unidade || "").toUpperCase() === "KG";
      const stock = product.stockQuantity ?? product.estoque ?? 30;
      this.className = "cf-card--product prod-card";
      this.setAttribute("padding", "none");
      this.innerHTML = `
        <div class="card-img-wrapper" data-action="open">
          ${this.renderImage({ ...product, images }, "prod-img", name)}
          ${category ? `<render-category-tag category="${escapeHtml(category)}" class="category-photo-badge"></render-category-tag>` : ""}
          ${images.length > 1 ? `<span class="photo-count-badge">📷 ${images.length} fotos</span>` : ""}
          ${byKg ? `<span class="unit-tag-badge">⚖️ POR KG</span>` : ""}
        </div>
        <div class="card-body">
          <div class="card-title" title="${escapeHtml(name)}" data-action="open">${escapeHtml(name)}</div>
          <div class="card-footer">
            <div>
              <div class="card-price">${formatPrice(getPrice(product))} <span class="cf-shared-unit">${byKg ? "/kg" : ""}</span></div>
              <span class="card-stock">${escapeHtml(stock)} ${byKg ? "kg" : "un."} disp.</span>
            </div>
            <div class="card-btn-container" id="cardBtnContainer_${escapeHtml(id)}">${product.cartControlsHtml || ""}</div>
          </div>
        </div>`;
      this.onclick = (event) => {
        if (event.target.closest("button")) return;
        if (event.target.closest('[data-action="open"]')) this.emit("open", event);
      };
    }

    renderStorefront(product, compact = false) {
      const name = getName(product);
      const category = getCategory(product);
      const favorite = this.getAttribute("favorite") === "true";
      const unavailable = product.status === "INATIVO" || product.isAvailable === false || product.unavailable === true;
      const image = this.renderImage(product, "product-card-image", product.imageIsIllustrative ? `Imagem ilustrativa de ${name}` : name);
      const saleUnit = product.saleUnit?.label ? `por ${product.saleUnit.label}` : "preço atual";
      const highlights = Array.isArray(product.productHighlights) ? product.productHighlights : [];
      this.className = `cf-card--product ${compact ? "recommendation" : `product-card ${unavailable ? "is-inactive" : ""}`}`.trim();
      this.setAttribute("padding", "none");
      this.innerHTML = `
        ${highlights.length ? `<div class="product-feature-tags" aria-label="Características do produto">${highlights.map((highlight) => `<span class="product-feature-tag ${escapeHtml(highlight.tone)}">${escapeHtml(highlight.icon)} ${escapeHtml(highlight.label)}</span>`).join("")}</div>` : ""}
        ${unavailable && product.status === "INATIVO" ? `<span class="badge-inactive">⚠️ INATIVO - Indisponível</span>` : ""}
        <button type="button" class="product-photo" aria-label="Ver ${escapeHtml(name)}" data-action="open">
          ${image}
          ${!compact && category ? `<render-category-tag category="${escapeHtml(category)}" class="product-category-tag"></render-category-tag>` : ""}
        </button>
        ${!compact ? `<div class="cf-product-actions product-card-actions">
          <button type="button" class="favorite" data-action="favorite" aria-label="Favoritar ${escapeHtml(name)}" aria-pressed="${favorite}">${heartIcon(favorite).replace("<svg", '<svg class="icon"')}</button>
          <button type="button" class="cf-product-info-button product-information-button" data-action="info" aria-label="Informações de ${escapeHtml(name)}" title="Informações de ${escapeHtml(name)}">${infoIcon}</button>
        </div>` : ""}
        <div class="product-content">
          <button type="button" class="product-name" title="${escapeHtml(name)}" data-action="open">${escapeHtml(name)}</button>
          <div class="cf-shared-store-price"><strong>${formatPrice(getPrice(product))}</strong><span>${escapeHtml(saleUnit)}</span></div>
          <button type="button" class="cf-button" data-action="add" ${unavailable ? "disabled" : ""}>${cartIcon}<span>${unavailable ? "Indisponível" : "Adicionar"}</span></button>
        </div>`;
      this.onclick = (event) => {
        const actionButton = event.target.closest("[data-action]");
        if (actionButton) this.emit(actionButton.dataset.action, event);
      };
    }

    render() {
      const product = this.readProduct();
      if (!product || !Object.keys(product).length) return;
      if (this.getAttribute("variant") === "cashier") {
        this.renderCashier(product);
        return;
      }
      if (this.getAttribute("variant") === "legacy-catalog") {
        this.renderLegacyCatalog(product);
        return;
      }
      this.renderStorefront(product, this.getAttribute("variant") === "recommendation");
    }
  }

  if (!customElements.get("render-product-card")) {
    customElements.define("render-product-card", RenderProductCard);
  }
  window.ConfloraProductCard = Object.freeze({ getImageCandidates });
})();
