/* One product card renderer shared by the storefront and the cashier. */
(() => {
  // ============================================================================
  // 1. CONFIGURAÇÃO, CONSTANTES & FORMATADORES (SINGLETONS V8)
  // ============================================================================
  const DEFAULT_PROJECT_ID = "confloraai";
  const DEFAULT_PLACEHOLDER = "/store-assets/placeholder.svg";
  const MAX_URL_CACHE_SIZE = 500;

  // Instanciado uma única vez para evitar alocação repetida em listas grandes (PDV/Catálogo)
  const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const urlCache = new Map();

  const ICONS = Object.freeze({
    heart: (filled, extraClass = "") =>
      `<svg${extraClass ? ` class="${extraClass}"` : ""} viewBox="0 0 24 24" aria-hidden="true" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>`,
    info: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>`,
    cart: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>`,
  });

  // ============================================================================
  // 2. UTILITÁRIOS PUROS (SANITIZAÇÃO & FORMATAÇÃO)
  // ============================================================================
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatPrice = (price) =>
    BRL_FORMATTER.format(Number.isFinite(price) ? price : 0);

  const firstNonEmptyString = (...values) => {
    for (const val of values) {
      if (typeof val === "string" && val.trim()) return val.trim();
      if (typeof val === "number" && Number.isFinite(val)) return String(val);
    }
    return "";
  };

  // ============================================================================
  // 3. RESOLUÇÃO DE IMAGENS (FIREBASE STORAGE & FIRESTORE)
  // ============================================================================
  const resolveStorageBuckets = (product) => {
    const explicitBucket = firstNonEmptyString(
      product?.storageBucket,
      product?.bucket,
      window.CONFLORA_STORAGE_BUCKET,
      window.FIREBASE_CONFIG?.storageBucket,
      window.__FIREBASE_CONFIG__?.storageBucket,
    )
      .replace(/^gs:\/\//i, "")
      .replace(/\/+$/, "");

    const buckets = [
      explicitBucket,
      `${DEFAULT_PROJECT_ID}.firebasestorage.app`,
      `${DEFAULT_PROJECT_ID}.appspot.com`,
    ].filter(Boolean);

    return [...new Set(buckets)];
  };

  const buildFirebaseMediaUrl = (bucket, objectPath) => {
    const cleanBucket = String(bucket || "").trim();
    const cleanPath = String(objectPath || "").trim().replace(/^\/+/, "");
    if (!cleanBucket || !cleanPath) return "";
    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(cleanBucket)}/o/${encodeURIComponent(cleanPath)}?alt=media`;
  };

  const normalizeFirebaseRestUrl = (url) => {
    const match = url.match(
      /^(https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/)([^?]+)(\?.*)?$/i,
    );
    if (!match) return url;

    const [, prefix, rawObjectPath, query = ""] = match;
    let decodedPath = rawObjectPath;
    try {
      decodedPath = decodeURIComponent(rawObjectPath);
    } catch {
      // Mantém o caminho original caso contenha % isolado
    }
    const encodedPath = encodeURIComponent(decodedPath.replace(/^\/+/, ""));
    const finalQuery = query
      ? /[?&]alt=/i.test(query)
        ? query
        : `${query}&alt=media`
      : "?alt=media";

    return `${prefix}${encodedPath}${finalQuery}`;
  };

  /**
   * Converte qualquer entrada de imagem (URL, gs://, caminho do Storage, Base64)
   * em uma ou mais URLs prontas para renderização no navegador.
   */
  const expandImageSource = (rawSource, product) => {
    const source = String(rawSource || "").trim();
    if (!source || source === "null" || source === "undefined") return [];

    const cacheKey = `${product?.storageBucket || ""}::${source}`;
    if (urlCache.has(cacheKey)) return urlCache.get(cacheKey);

    let resolved = [];

    if (/^(?:data:image\/|blob:)/i.test(source)) {
      resolved = [source];
    } else if (/^gs:\/\/([^/]+)\/(.+)$/i.test(source)) {
      const [, bucket, objectPath] = source.match(/^gs:\/\/([^/]+)\/(.+)$/i);
      resolved = [buildFirebaseMediaUrl(bucket, objectPath)];
    } else if (/^https:\/\/firebasestorage\.googleapis\.com\//i.test(source)) {
      resolved = [normalizeFirebaseRestUrl(source)];
    } else if (/^https?:\/\//i.test(source) || source.startsWith("/")) {
      resolved = [source];
    } else if (!source.includes(" ")) {
      // Caminho relativo salvo no Firestore (ex: "produtos/orquidea.webp")
      resolved = resolveStorageBuckets(product)
        .map((bucket) => buildFirebaseMediaUrl(bucket, source))
        .filter(Boolean);
    }

    if (urlCache.size >= MAX_URL_CACHE_SIZE) urlCache.clear();
    urlCache.set(cacheKey, resolved);
    return resolved;
  };

  const normalizeImageSource = (rawSource, product) =>
    expandImageSource(rawSource, product)[0] || "";

  const isAllowedImageSource = (source) => {
    if (!source) return false;
    return (
      /^https:\/\//i.test(source)
      || /^\/(?:api\/images|store-assets|assets|uploads|images)\//i.test(source)
      || /^(?:data:image\/|blob:)/i.test(source)
    );
  };

  const extractRawImageValue = (entry) => {
    if (!entry) return "";
    if (typeof entry === "string") return entry.trim();
    if (typeof entry === "object") {
      return firstNonEmptyString(
        entry.url,
        entry.imageUrl,
        entry.image_url,
        entry.src,
        entry.downloadURL,
        entry.downloadUrl,
        entry.foto,
        entry.fotoUrl,
        entry.imagem,
        entry.imagemUrl,
        entry.storagePath,
        entry.imagePath,
        entry.fullPath,
        entry.path,
      );
    }
    return "";
  };

  const getImageCandidates = (product) => {
    const p = product && typeof product === "object" ? product : {};

    const arraySources = [
      ...(Array.isArray(p.images) ? p.images : []),
      ...(Array.isArray(p.fotos) ? p.fotos : []),
      ...(Array.isArray(p.imagens) ? p.imagens : []),
      ...(Array.isArray(p.imageCandidates) ? p.imageCandidates : []),
    ];

    const fieldSources = [
      p.image,
      p.imageUrl,
      p.imageurl,
      p.image_url,
      p.downloadURL,
      p.downloadUrl,
      p.foto,
      p.fotoUrl,
      p.foto_url,
      p.imagem,
      p.imagemUrl,
      p.imagem_url,
      p.urlImagem,
      p.url_imagem,
      p.photoUrl,
      p.photoURL,
      p.thumbnail,
      p.thumb,
      p.capa,
      p.imagePathCache,
      p.storagePath,
      p.imagePath,
      p.fullPath,
    ];

    const directCandidates = [...arraySources, ...fieldSources]
      .map(extractRawImageValue)
      .flatMap((raw) => expandImageSource(raw, p))
      .filter(isAllowedImageSource);

    const proxyId = firstNonEmptyString(
      p.imageFileId,
      p.image_file_id,
      p.id,
      p.productId,
      p.sku,
    );
    const proxyFallback = proxyId
      ? `/api/images/${encodeURIComponent(proxyId)}`
      : "";

    return [
      ...new Set(
        proxyFallback ? [...directCandidates, proxyFallback] : directCandidates,
      ),
    ];
  };

  // ============================================================================
  // 4. ADAPTER DE DOMÍNIO (NORMALIZAÇÃO CANÔNICA DO PRODUTO)
  // ============================================================================
  const getCategory = (product) =>
    firstNonEmptyString(
      product?.categoryName,
      product?.category,
      product?.categoria,
    );

  const getName = (product) =>
    firstNonEmptyString(
      product?.name,
      product?.nome,
      product?.descricao,
      "Produto",
    );

  const getPrice = (product) => {
    const rawPrice =
      product?.price?.amountMinor !== undefined
        ? Number(product.price.amountMinor) / 100
        : Number(
            product?.price
              ?? product?.preco
              ?? product?.valor_num
              ?? product?.valor
              ?? 0,
          );
    return Number.isFinite(rawPrice) ? rawPrice : 0;
  };

  /**
   * Converte qualquer documento do Firestore/API em um ViewModel padronizado.
   * Isola os templates HTML de diferenças de nomenclatura no banco.
   */
  const normalizeProduct = (rawProduct) => {
    const p = rawProduct && typeof rawProduct === "object" ? rawProduct : {};
    const id = firstNonEmptyString(p.id, p.productId, p.sku);
    const name = getName(p);
    const category = getCategory(p);
    const price = getPrice(p);
    const formattedPrice = formatPrice(price);
    const unit = firstNonEmptyString(p.unit, p.unidade).toUpperCase();
    const byKg = unit === "KG";
    const stock = p.stockQuantity ?? p.estoque ?? 30;
    const isInactive = p.status === "INATIVO";
    const isUnavailable =
      isInactive || p.isAvailable === false || p.unavailable === true;
    const isIllustrative = Boolean(p.imageIsIllustrative);
    const fallbackImage = firstNonEmptyString(
      p.imageFallbackUrl,
      DEFAULT_PLACEHOLDER,
    );
    const images = getImageCandidates(p);
    const realImagesCount = images.filter(
      (src) => !/^\/api\/images\//i.test(src),
    ).length;

    return {
      id,
      name,
      category,
      price,
      formattedPrice,
      byKg,
      stock,
      isInactive,
      isUnavailable,
      isIllustrative,
      imageAlt: isIllustrative ? `Imagem ilustrativa de ${name}` : name,
      saleUnitLabel: p.saleUnit?.label
        ? `por ${p.saleUnit.label}`
        : "preço atual",
      highlights: Array.isArray(p.productHighlights) ? p.productHighlights : [],
      cartControlsHtml: p.cartControlsHtml || "",
      images,
      primaryImage: images[0] || fallbackImage,
      fallbackImage,
      realImagesCount,
    };
  };

  // ============================================================================
  // 5. FALLBACK RESILIENTE PARA <render-image>
  // ============================================================================
  if (!customElements.get("render-image")) {
    class RenderImageFallback extends HTMLElement {
      static get observedAttributes() {
        return ["src", "image-candidates", "fallback-src", "alt", "class"];
      }

      connectedCallback() {
        this.mountImage();
      }

      attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue && this.isConnected) {
          this.mountImage();
        }
      }

      mountImage() {
        const primary = (this.getAttribute("src") || "").trim();
        const fallback = (
          this.getAttribute("fallback-src") || DEFAULT_PLACEHOLDER
        ).trim();
        let candidates = [];
        try {
          const parsed = JSON.parse(
            this.getAttribute("image-candidates") || "[]",
          );
          if (Array.isArray(parsed)) candidates = parsed.filter(Boolean);
        } catch {
          candidates = [];
        }

        const queue = [
          ...new Set([primary, ...candidates, fallback].filter(Boolean)),
        ];
        let index = 0;

        this.style.display = "contents";
        const img = document.createElement("img");
        img.className = this.getAttribute("class") || "";
        img.alt = this.getAttribute("alt") || "";
        img.loading = this.getAttribute("loading") || "lazy";
        img.decoding = this.getAttribute("decoding") || "async";
        img.src = queue[index] || DEFAULT_PLACEHOLDER;

        img.onerror = () => {
          index += 1;
          if (index < queue.length) {
            img.src = queue[index];
          } else {
            img.onerror = null;
          }
        };

        this.replaceChildren(img);
      }
    }

    customElements.define("render-image", RenderImageFallback);
  }

  // ============================================================================
  // 6. WEB COMPONENT <render-product-card>
  // ============================================================================
  class RenderProductCard extends HTMLElement {
    static get observedAttributes() {
      return ["variant", "product-data", "selected", "quantity", "favorite"];
    }

    constructor() {
      super();
      this._product = null;
      this._boundClick = this.handleClick.bind(this);
      this._boundKeydown = this.handleKeydown.bind(this);
    }

    connectedCallback() {
      this.addEventListener("click", this._boundClick);
      this.addEventListener("keydown", this._boundKeydown);
      this.render();
    }

    disconnectedCallback() {
      this.removeEventListener("click", this._boundClick);
      this.removeEventListener("keydown", this._boundKeydown);
    }

    set product(value) {
      this._product = value && typeof value === "object" ? value : null;
      if (this.isConnected) this.render();
    }

    get product() {
      return this.readProduct();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue !== newValue && this.isConnected) {
        this.render();
      }
    }

    readProduct() {
      if (this._product && Object.keys(this._product).length) {
        return this._product;
      }
      try {
        const parsed = JSON.parse(this.getAttribute("product-data") || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    }

    emit(action, event, extra = {}) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const rawProduct = this.readProduct();
      const productId = firstNonEmptyString(
        rawProduct.id,
        rawProduct.productId,
        rawProduct.sku,
      );
      this.dispatchEvent(
        new CustomEvent("cf-product-card-action", {
          bubbles: true,
          composed: true,
          detail: {
            action,
            productId,
            nativeEvent: event,
            ...extra,
          },
        }),
      );
    }

    handleClick(event) {
      const variant = this.getAttribute("variant");

      if (variant === "legacy-catalog") {
        if (event.target.closest("button")) return;
        if (event.target.closest('[data-action="open"]')) {
          this.emit("open", event);
        }
        return;
      }

      const actionTarget = event.target.closest("[data-action]");
      if (actionTarget) {
        this.emit(actionTarget.dataset.action, event);
        return;
      }

      if (variant === "cashier") {
        this.emit("add", event);
      }
    }

    handleKeydown(event) {
      if (this.getAttribute("variant") !== "cashier") return;
      if (event.target !== this || !["Enter", " "].includes(event.key)) return;
      this.emit("add", event);
    }

    buildImageHtml(vm, className, alt = vm.imageAlt) {
      const imageEl = document.createElement("render-image");
      imageEl.setAttribute("src", vm.primaryImage);
      imageEl.setAttribute(
        "image-candidates",
        JSON.stringify(vm.images.slice(1)),
      );
      imageEl.setAttribute("fallback-src", vm.fallbackImage);
      imageEl.setAttribute("alt", alt);
      imageEl.setAttribute("loading", "lazy");
      imageEl.setAttribute("decoding", "async");
      imageEl.setAttribute("class", className);
      return imageEl.outerHTML;
    }

    renderCashier(vm) {
      const quantity = Math.max(0, Number(this.getAttribute("quantity") || 0));
      const favorite = this.getAttribute("favorite") === "true";
      const isSelected =
        this.getAttribute("selected") === "true" || quantity > 0;
      const safeName = escapeHtml(vm.name);
      const favLabel = `${favorite ? "Remover dos" : "Adicionar aos"} favoritos`;

      this.className = `cf-pdv-product-card${isSelected ? " is-selected" : ""}`;
      this.removeAttribute("padding");
      this.setAttribute("role", "button");
      this.setAttribute("tabindex", "0");
      this.setAttribute("aria-label", `Adicionar ${vm.name} ao carrinho`);

      this.innerHTML = `
        ${quantity > 0 ? `<span aria-label="${quantity} no carrinho" class="cf-pdv-quantity-badge">${quantity}</span>` : ""}
        <div class="cf-shared-pdv-overlay">
          ${vm.category ? `<render-category-tag category="${escapeHtml(vm.category)}" class="cf-pdv-category-label"></render-category-tag>` : ""}
          <button type="button" data-action="info" class="cf-product-info-button cf-pdv-info-action" aria-label="Informações de ${safeName}" title="Informações de ${safeName}">INFO</button>
        </div>
        <div class="cf-shared-pdv-content">
          <div class="cf-shared-pdv-thumbnail">${this.buildImageHtml(vm, "cf-shared-pdv-image")}</div>
          <div class="cf-shared-pdv-details">
            <h3 title="${safeName}">${safeName}</h3>
            <div class="cf-shared-pdv-price-row">
              <strong>${vm.formattedPrice}</strong>
              <button type="button" data-action="favorite" aria-pressed="${favorite}" aria-label="${favLabel}: ${safeName}" title="${favLabel}" class="cf-shared-pdv-favorite ${favorite ? "is-favorite" : ""}">${ICONS.heart(favorite)}</button>
            </div>
          </div>
        </div>`;
    }

    renderLegacyCatalog(vm) {
      const safeName = escapeHtml(vm.name);
      const safeId = escapeHtml(vm.id);

      this.className = "cf-card--product prod-card";
      this.setAttribute("padding", "none");
      this.removeAttribute("role");
      this.removeAttribute("tabindex");
      this.removeAttribute("aria-label");

      this.innerHTML = `
        <div class="card-img-wrapper" data-action="open">
          ${this.buildImageHtml(vm, "prod-img", vm.name)}
          ${vm.category ? `<render-category-tag category="${escapeHtml(vm.category)}" class="category-photo-badge"></render-category-tag>` : ""}
          ${vm.realImagesCount > 1 ? `<span class="photo-count-badge">📷 ${vm.realImagesCount} fotos</span>` : ""}
          ${vm.byKg ? `<span class="unit-tag-badge">⚖️ POR KG</span>` : ""}
        </div>
        <div class="card-body">
          <div class="card-title" title="${safeName}" data-action="open">${safeName}</div>
          <div class="card-footer">
            <div>
              <div class="card-price">${vm.formattedPrice} <span class="cf-shared-unit">${vm.byKg ? "/kg" : ""}</span></div>
              <span class="card-stock">${escapeHtml(vm.stock)} ${vm.byKg ? "kg" : "un."} disp.</span>
            </div>
            <div class="card-btn-container" id="cardBtnContainer_${safeId}">${vm.cartControlsHtml}</div>
          </div>
        </div>`;
    }

    renderStorefront(vm, compact = false) {
      const favorite = this.getAttribute("favorite") === "true";
      const safeName = escapeHtml(vm.name);
      const variantClasses = compact
        ? "recommendation"
        : `product-card${vm.isUnavailable ? " is-inactive" : ""}`;

      this.className = `cf-card--product ${variantClasses}`;
      this.setAttribute("padding", "none");
      this.removeAttribute("role");
      this.removeAttribute("tabindex");
      this.removeAttribute("aria-label");

      const highlightsHtml = vm.highlights.length
        ? `<div class="product-feature-tags" aria-label="Características do produto">${vm.highlights
            .map(
              (h) =>
                `<span class="product-feature-tag ${escapeHtml(h.tone)}">${escapeHtml(h.icon)} ${escapeHtml(h.label)}</span>`,
            )
            .join("")}</div>`
        : "";

      this.innerHTML = `
        ${highlightsHtml}
        ${vm.isUnavailable && vm.isInactive ? `<span class="badge-inactive">⚠️ INATIVO - Indisponível</span>` : ""}
        <button type="button" class="product-photo" aria-label="Ver ${safeName}" data-action="open">
          ${this.buildImageHtml(vm, "product-card-image")}
          ${!compact && vm.category ? `<render-category-tag category="${escapeHtml(vm.category)}" class="product-category-tag"></render-category-tag>` : ""}
        </button>
        ${
          !compact
            ? `<div class="cf-product-actions product-card-actions">
          <button type="button" class="favorite" data-action="favorite" aria-label="Favoritar ${safeName}" aria-pressed="${favorite}">${ICONS.heart(favorite, "icon")}</button>
          <button type="button" class="cf-product-info-button product-information-button" data-action="info" aria-label="Informações de ${safeName}" title="Informações de ${safeName}">${ICONS.info}</button>
        </div>`
            : ""
        }
        <div class="product-content">
          <button type="button" class="product-name" title="${safeName}" data-action="open">${safeName}</button>
          <div class="cf-shared-store-price"><strong>${vm.formattedPrice}</strong><span>${escapeHtml(vm.saleUnitLabel)}</span></div>
          <button type="button" class="cf-button" data-action="add" ${vm.isUnavailable ? "disabled" : ""}>${ICONS.cart}<span>${vm.isUnavailable ? "Indisponível" : "Adicionar"}</span></button>
        </div>`;
    }

    render() {
      const rawProduct = this.readProduct();
      if (!rawProduct || !Object.keys(rawProduct).length) return;

      const vm = normalizeProduct(rawProduct);
      const variant = this.getAttribute("variant");

      if (variant === "cashier") {
        this.renderCashier(vm);
        return;
      }
      if (variant === "legacy-catalog") {
        this.renderLegacyCatalog(vm);
        return;
      }
      this.renderStorefront(vm, variant === "recommendation");
    }
  }

  if (!customElements.get("render-product-card")) {
    customElements.define("render-product-card", RenderProductCard);
  }

  // Expõe utilitários padronizados para reaproveitamento no Storefront, PDV e Admin
  window.ConfloraProductCard = Object.freeze({
    getImageCandidates,
    normalizeImageSource,
    normalizeProduct,
    formatPrice,
  });
})();