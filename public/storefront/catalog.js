import {
  $,
  element,
  money,
  quantityControl,
} from "./ui.js";
import { icon } from "./icons.js";
import { searchProducts, normalize as normalizeProductText } from "./guided-search.mjs";
import { buildProductInfoContent } from "./product-info-content.js";

export function createCatalog(state, add, navigate) {
  let pageSize = 24;
  let renderedItems = [];
  let loadingNextPage = false;
  let selectedCategories = [];
  let selectedSubcategories = [];
  let showingFavorites = false;
  let purchaseQuantities = new Map();
  let purchaseLoading = false;
  let purchaseError = '';
  let purchaseRevision = 0;
  let searchEventTimer;
  const loadMoreButton = $("#loadMore");

  function isSoldByKg(product) {
    return String(product?.saleUnit?.code || product?.unit || product?.unidade || "").trim().toUpperCase() === "KG";
  }

  function nextValidWeight(minimum, increment, target = 1) {
    const steps = Math.max(0, Math.ceil((target - minimum) / increment - 0.0000001));
    return Number((minimum + steps * increment).toFixed(3));
  }

  function highestValidWeight(maximum, minimum, increment) {
    if (!Number.isFinite(maximum)) return nextValidWeight(minimum, increment);
    const steps = Math.floor((maximum - minimum) / increment + 0.0000001);
    return Number((minimum + Math.max(0, steps) * increment).toFixed(3));
  }

  function openWeightQuantityDialog(product, onAdded) {
    const minimum = Number(product.saleUnit?.minimum) || 0.1;
    const increment = Number(product.saleUnit?.increment) || 0.1;
    const maxStock = product.stock?.tracked ? Number(product.stock.quantity) : Infinity;
    const initialTarget = nextValidWeight(minimum, increment);
    const initialQuantity = initialTarget <= maxStock ? initialTarget : highestValidWeight(maxStock, minimum, increment);
    const dialog = element("dialog", { class: "product-weight-dialog" });
    const title = element("h2", { text: `Quantos quilos de ${product.name}?` });
    const price = element("p", { class: "product-weight-price", text: `${money(product.price.amountMinor)} / kg` });
    const input = element("input", {
      type: "text",
      inputmode: "decimal",
      autocomplete: "off",
      min: String(minimum),
      step: String(increment),
      value: String(Number(initialQuantity.toFixed(3))),
      "aria-label": `Quantidade em quilos de ${product.name}`,
      required: "",
    });
    input.addEventListener("input", () => { input.value = input.value.replace(/[^\d.,]/g, "").replace(/(.*[.,].*)[.,]/g, "$1"); });
    if (Number.isFinite(maxStock)) input.max = String(maxStock);
    const total = element("strong", { class: "product-weight-total" });
    const cancel = element("button", { type: "button", class: "quiet", text: "Cancelar".tr, onclick: () => dialog.close() });
    const confirm = element("button", { type: "button", class: "cf-button", text: "Adicionar ao carrinho".tr });
    const updateTotal = () => {
      const quantity = Number(String(input.value).replace(",", "."));
      const valid = Number.isFinite(quantity)
        && quantity >= minimum
        && quantity <= maxStock
        && Math.abs(quantity / increment - Math.round(quantity / increment)) < 0.00001;
      total.textContent = `Total: ${money(Math.round(product.price.amountMinor * (Number.isFinite(quantity) ? quantity : 0)))}`;
      confirm.disabled = !valid;
    };
    input.addEventListener("input", updateTotal);
    confirm.addEventListener("click", () => {
      if (!input.reportValidity()) return;
      const quantity = Number(String(input.value).replace(",", "."));
      if (!Number.isFinite(quantity) || quantity < minimum || quantity > maxStock) return;
      add(product, quantity);
      dialog.close();
      onAdded?.();
    });
    dialog.append(
      element("div", { class: "product-weight-content" }, [
        element("header", { class: "product-weight-header" }, [title, element("button", { type: "button", class: "product-info-close", "aria-label": "Fechar".tr, text: "×", onclick: () => dialog.close() })]),
        price,
        element("label", { class: "product-weight-label", text: "Peso para adicionar".tr }, [input, element("span", { text: "kg" })]),
        total,
        element("div", { class: "product-weight-actions" }, [cancel, confirm]),
      ]),
    );
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    document.body.append(dialog);
    updateTotal();
    dialog.showModal();
    input.focus();
  }

  function addFromCard(product, defaultQuantity = product.saleUnit?.minimum || 1, onAdded) {
    if (isSoldByKg(product)) {
      openWeightQuantityDialog(product, onAdded);
      return;
    }
    add(product, defaultQuantity);
    onAdded?.();
  }
  const pageObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || loadingNextPage) return;
        if (renderedItems.length <= pageSize) return;
        loadingNextPage = true;
        pageSize += 24;
        render();
        loadingNextPage = false;
      }, { rootMargin: "700px 0px" })
    : null;

  async function refreshPurchases() {
    const revision = ++purchaseRevision;
    const owner = state.user?.id;
    purchaseQuantities = new Map();
    purchaseError = '';
    purchaseLoading = Boolean(owner && showingFavorites);
    render();
    if (!purchaseLoading) return;
    try {
      const insights = await state.purchaseInsights.load();
      if (revision !== purchaseRevision || state.user?.id !== owner) return;
      purchaseQuantities = insights.quantities;
    } catch (error) {
      if (revision !== purchaseRevision || state.user?.id !== owner) return;
      purchaseError = error.message;
    } finally {
      if (revision === purchaseRevision && state.user?.id === owner) {
        purchaseLoading = false;
        render();
      }
    }
  }

  function openProductInformation(product) {
    state.trackEvent?.("view_item", {
      productId: product.id,
      productName: product.name,
      category: product.categoryName,
      value: Number(product.price?.amountMinor || 0) / 100,
    });
    const normalizeName = (value) => normalizeProductText(value);
    const relatedProducts = state.products.filter((candidate) => {
      if (candidate.id === product.id) return true;
      if (product.canonicalName && candidate.canonicalName) {
        return normalizeName(candidate.canonicalName) === normalizeName(product.canonicalName);
      }
      return normalizeName(candidate.name) === normalizeName(product.name);
    });
    let dialog = document.querySelector("#productInfoDialog");
    if (!dialog) {
      dialog = element("dialog", { id: "productInfoDialog", class: "product-info-dialog" });
      document.body.append(dialog);
    }
    if (dialog.open) dialog.close();
    const closeButton = element("button", {
      type: "button",
      class: "product-info-close",
      "aria-label": "Fechar".tr,
      title: "Fechar",
      onclick: () => dialog.close(),
    }, [icon("x")]);
    const title = element("h2", { text: product.name, title: product.name });
    const info = buildProductInfoContent(product, categoryLabel(product));
    const specificationEntries = Object.entries(product.specifications || {}).filter(([, value]) => value?.value || typeof value === "string");
    const contentSections = (Array.isArray(product.contentSections) ? product.contentSections : [])
      .filter((section) => section?.title && section?.body);
    const content = [
      element("header", { class: "product-info-header" }, [
        element("div", { class: "product-info-heading" }, [
          categoryTag(categoryLabel(product) || "Produto", "product-info-category"),
          title,
          element("div", { class: "product-info-price-row" }, [
            element("strong", { class: "product-info-price", text: money(product.price.amountMinor) }),
            element("span", { class: "product-info-unit", text: product.saleUnit?.label ? `${"por".tr} ${product.saleUnit.label.tr}` : "preço atual".tr }),
          ]),
        ]),
        closeButton,
      ]),
      element("div", { class: "product-info-body" }, [
        element("section", { class: "product-info-intro" }, [
          element("span", { class: "product-info-eyebrow", text: "ESCOLHA COM CONFIANÇA".tr }),
          element("p", { text: info.summary }),
        ]),
        element("div", { class: "product-info-facts" }, info.facts.map(({ label, value, icon: iconName, tone }) => element("section", { class: `product-info-fact ${tone}` }, [
          element("span", { class: "product-info-fact-icon", "aria-hidden": "true" }, [icon(iconName)]),
          element("div", {}, [
            element("h3", { text: label }),
            element("p", { text: value }),
          ]),
        ]))),
        element("section", { class: "product-info-preferences" }, [
          element("h3", { text: info.pairTitle }),
          element("div", { class: "product-info-preference-grid" }, [
            element("article", { class: "product-info-preference positive" }, [
              element("h4", { text: info.likesTitle }),
              element("p", { text: info.likes }),
            ]),
            element("article", { class: "product-info-preference caution" }, [
              element("h4", { text: info.avoidTitle }),
              element("p", { text: info.avoid }),
            ]),
          ]),
        ]),
        element("section", { class: "product-info-tips" }, [
          element("h3", { text: info.tipsTitle }),
          element("ul", {}, info.tips.map((tip) => element("li", { text: tip }))),
        ]),
        ...(contentSections.length ? [element("details", { class: "product-info-extra-details" }, [
          element("summary", { text: "Mais detalhes do produto" }),
          ...contentSections.map((section) => element("section", { class: "product-info-extra" }, [
            element("h3", { text: section.title }),
            element("p", { text: section.body }),
          ])),
        ])] : []),
        ...(specificationEntries.length ? [element("details", { class: "product-info-specifications" }, [
          element("summary", { text: "Ver especificações" }),
          element("dl", {}, specificationEntries.flatMap(([label, value]) => [
            element("dt", { text: value.label || label }),
            element("dd", { text: `${value.value || value}${value.unit ? ` ${value.unit}` : ""}` }),
          ])),
        ])] : []),
      ]),
    ];
    if (relatedProducts.length > 1) {
      content[1].prepend(element("section", { class: "product-info-variants" }, [
        element("h3", { text: "Outras opções disponíveis" }),
        ...relatedProducts.filter((variant) => variant.id !== product.id).map((variant) => element("div", { class: "product-info-variant" }, [
          element("span", { text: [variant.name, variant.variation].filter(Boolean).join(" · ") }),
          element("strong", { text: money(variant.price.amountMinor) }),
        ])),
      ]));
    }
    const minimumQuantity = product.saleUnit?.minimum || 1;
    const unavailable = product.status === "INATIVO" || product.isAvailable === false
      || (product.stock?.tracked && product.stock.quantity < minimumQuantity);
    const addButton = element("button", { type: "button", class: "cf-button product-info-add", text: unavailable ? "Indisponível".tr : isSoldByKg(product) ? "Escolher peso".tr : "Adicionar".tr, disabled: unavailable, onclick: () => {
      dialog.close();
      addFromCard(product, minimumQuantity);
    } }, unavailable ? [] : [icon("cart")]);
    const footerActions = [addButton];
    const contactPhone = String(state.config?.checkout?.contactPhone || "").replace(/\D/g, "");
    if (contactPhone.length >= 10 && contactPhone.length <= 15) {
      const message = encodeURIComponent(`Olá! Gostaria de saber mais sobre ${product.name}.`);
      footerActions.push(element("a", {
        class: "cf-button product-info-whatsapp",
        href: `https://wa.me/${contactPhone}?text=${message}`,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": `Perguntar pelo WhatsApp sobre ${product.name}`,
      }, [icon("send"), element("span", { text: "Tirar dúvida no WhatsApp" })]));
    }
    content.push(element("footer", { class: "product-info-footer" }, [
      element("div", { class: "product-info-footer-actions" }, footerActions),
    ]));
    dialog.replaceChildren(...content);
    dialog.onclick = (event) => {
      if (event.target === dialog) dialog.close();
    };
    dialog.showModal();
  }

  function categoryTag(category, className = "") {
    return element("render-category-tag", {
      category,
      class: className,
    });
  }

  const categoryLabel = (product) => {
    const names = (Array.isArray(product.categories) ? product.categories : [])
      .map((id) => state.config?.categories?.find((c) => c.id === id)?.name)
      .filter(Boolean);
    const canonicalNames = ["Frutífera", "Horta", "Hortifrutti", "Outros", "Pets", "Plantas / Mudas"];
    const isCanonical = (value) => canonicalNames.find(
      (item) => normalizeProductText(item) === normalizeProductText(value),
    );
    const configuredCategory = names.map(isCanonical).find(Boolean);
    if (configuredCategory) return configuredCategory;

    const sharedCategory = window.ConfloraProductCard?.getCategory({
      ...product,
      // Category IDs resolved from the active store configuration are more
      // authoritative than legacy display fields on older product records.
      categoryName: product.categoryName,
      category: product.category,
      categoria: product.categoria,
      categories: names,
    });
    if (sharedCategory) return sharedCategory;

    return names.map(isCanonical).find(Boolean) || "";
  };
  const productSubcategory = (product) => {
    return String(
      product?.subcategory ||
      product?.subcategoria ||
      product?.subcategoryName ||
      product?.SUBCATEGORIA ||
      ""
    ).trim();
  };

  const productMatchesCategory = (product, catId) => {
    if (!catId) return true;
    const ids = Array.isArray(product.categories) ? product.categories : [];
    if (ids.includes(catId)) return true;
    const fallbackName = categoryLabel(product);
    if (catId === `name:${normalizeProductText(fallbackName)}`) return true;
    const configured = state.config?.categories?.find((c) => c.id === catId);
    if (configured && normalizeProductText(configured.name) === normalizeProductText(fallbackName)) return true;
    return false;
  };

  function getSubcategoryOptions(products, catId) {
    if (!catId) return [];
    const categoryProducts = products.filter((p) => productMatchesCategory(p, catId));
    const subMap = new Map();
    for (const p of categoryProducts) {
      const sub = productSubcategory(p);
      if (!sub) continue;
      const key = normalizeProductText(sub);
      if (!subMap.has(key)) {
        subMap.set(key, sub);
      }
    }
    return [...subMap.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function categoryOptions(products) {
    const categories = new Map();
    const configured = state.config?.categories || [];
    for (const product of products) {
      const ids = Array.isArray(product.categories) ? product.categories : [];
      if (ids.length) {
        for (const id of ids) {
          const category = configured.find((item) => item.id === id);
          const name = category?.name || categoryLabel(product);
          if (name && category?.isActive !== false) {
            categories.set(id, { id, name });
          }
        }
      } else {
        const name = categoryLabel(product);
        const id = name ? `name:${normalizeProductText(name)}` : "";
        if (id && !categories.has(id)) {
          categories.set(id, { id, name });
        }
      }
    }
    return [...categories.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }

  function renderCard(product, { compact = false, chat = false } = {}) {
    const open = () =>
      navigate(
        `${state.basePath ?? `/shop/${state.slug}`}/products/${encodeURIComponent(product.id)}`,
      );

    const isInactive =
      product.status === "INATIVO" || product.isAvailable === false;
    const outOfStock =
      product.stock?.tracked &&
      product.stock.quantity < (product.saleUnit?.minimum || 1);
    const unavailable = isInactive || outOfStock;
    const category = categoryLabel(product);
    const cardProduct = {
      ...product,
      categoryName: category,
      unavailable,
    };
    const card = element("render-product-card", {
      variant: chat ? "cashier" : compact ? "recommendation" : "storefront",
      "product-data": JSON.stringify(cardProduct),
    });
    card.addEventListener("cf-product-card-action", (event) => {
      const { action } = event.detail || {};
      if (action === "open") open();
      if (action === "add" && !unavailable) addFromCard(product, product.saleUnit?.minimum || 1, chat ? () => card.dispatchEvent(new CustomEvent('chat-product-added', { bubbles: true, detail: { product } })) : null);
      if (action === "info") openProductInformation(product);
    });
    return card;
  }

  function render() {
    let rawQuery = $("#search") ? $("#search").value.trim() : "";
    if (/@/.test(rawQuery)) {
      if ($("#search")) $("#search").value = "";
      rawQuery = "";
    }
    const activeProducts = state.products.filter(
      (product) => product.status !== "INATIVO" && product.isAvailable !== false,
    );
    let baseList = activeProducts;
    if (showingFavorites) {
      baseList = baseList.filter((product) => purchaseQuantities.has(String(product.id)));
    }
    const categories = categoryOptions(activeProducts);
    $("#categoryFilterControl").hidden = false;
    selectedCategories = selectedCategories.filter(id => categories.some(category => category.id === id));

    // Garante que nenhum botão 'Voltar' apareça na vitrine / home
    if (!$("#productView") || $("#productView").hidden) {
      document.querySelectorAll(".cf-back-button, [data-site-back]").forEach((btn) => {
        if (!btn.closest("#productView") && !btn.closest("#adminView")) {
          btn.remove();
        }
      });
    }

    const categoryFilter = (name, selected, onclick, kind = "", colorCategory = "") => element("render-category-tag", {
      category: name, variant: "filter", selected: String(selected), kind, "color-category": colorCategory, onclick,
    });
    const updateFilters = () => {
      selectedSubcategories = [];
      pageSize = 24;
      render();
    };
    $("#categoryFilterControl").replaceChildren(
      categoryFilter("Mais comprados".tr, showingFavorites, () => {
        showingFavorites = !showingFavorites;
        updateFilters();
        refreshPurchases();
      }, "purchases"),
      categoryFilter("Todas", !showingFavorites && selectedCategories.length === 0, () => {
        showingFavorites = false;
        selectedCategories = [];
        updateFilters();
      }, "all"),
      ...categories.map(category => categoryFilter(category.name, selectedCategories.includes(category.id), () => {
        selectedCategories = window.ConfloraCategoryUi.toggleSelection(selectedCategories, category.id);
        state.trackEvent?.("category_filter", { category: category.name, categories: selectedCategories });
        updateFilters();
      })),
      ...(selectedCategories.length ? [element("render-category-tag", {
        category: "Limpar categorias", variant: "action", kind: "all", onclick: () => {
          selectedCategories = []; updateFilters();
        },
      })] : []),
    );

    const subcatContainer = $("#subcategoryFilterControl");
    if (subcatContainer) {
      const options = new Map();
      for (const category of categories.filter(category => selectedCategories.includes(category.id))) {
        for (const name of getSubcategoryOptions(activeProducts, category.id)) {
          const key = normalizeProductText(name);
          if (!options.has(key)) options.set(key, { name, parent: category.name });
        }
      }
      selectedSubcategories = selectedSubcategories.filter(key => options.has(key));
      subcatContainer.hidden = options.size === 0;
      subcatContainer.replaceChildren(...(options.size ? [
        element("span", { class: "subcategory-header-badge", text: "Subcategorias:".tr }),
        ...[...options.entries()].map(([key, sub]) => categoryFilter(sub.name,
          selectedSubcategories.includes(key), () => {
            selectedSubcategories = window.ConfloraCategoryUi.toggleSelection(selectedSubcategories, key);
            pageSize = 24; render();
          }, "", sub.parent)),
        ...(selectedSubcategories.length ? [element("render-category-tag", {
          category: "Limpar subcategorias", variant: "action", kind: "all", onclick: () => {
            selectedSubcategories = []; pageSize = 24; render();
          },
        })] : []),
      ] : []));
    }
    baseList = baseList.filter(product => window.ConfloraCategoryUi.matchesAny(
      selectedCategories, id => productMatchesCategory(product, id),
    ) && window.ConfloraCategoryUi.matchesAny(
      selectedSubcategories, name => normalizeProductText(productSubcategory(product)) === name,
    ));

    const list = rawQuery
      ? searchProducts(
          baseList,
          rawQuery,
          state.config?.assistant?.synonyms || [],
        ).map((result) => result.product)
      : [...baseList];
    const sortOrder = $("#sortOrder").value;
    $("#sortOrder").disabled = showingFavorites;
    if (showingFavorites) {
      list.sort((a, b) => (purchaseQuantities.get(String(b.id)) || 0) - (purchaseQuantities.get(String(a.id)) || 0) || a.name.localeCompare(b.name, "pt-BR"));
    } else if (!rawQuery || sortOrder !== "az") {
      list.sort((a, b) => {
        if (sortOrder === "price-asc" || sortOrder === "price-desc") {
          const priceDifference =
            (a.price?.amountMinor || 0) - (b.price?.amountMinor || 0);
          if (priceDifference) {
            return sortOrder === "price-asc" ? priceDifference : -priceDifference;
          }
        } else if (sortOrder === "za") {
          return b.name.localeCompare(a.name, "pt-BR");
        }
        return a.name.localeCompare(b.name, "pt-BR");
      });
    }

    renderedItems = list;
    $("#products").replaceChildren(...list.slice(0, pageSize).map((product) => renderCard(product)));
    if (!list.length) {
      const emptyElements = [
        element("p", {
          class: "empty",
          text: showingFavorites ? (purchaseLoading ? "Carregando suas compras..." : purchaseError || (state.user ? "Seus produtos comprados aparecerão aqui, dos mais comprados para os menos comprados." : "Entre na sua conta para ver os produtos que você mais compra.")).tr : "Nenhum produto encontrado. Tente outra busca.".tr,
        }),
      ];
      if (showingFavorites && purchaseError) emptyElements.push(element('button', { type: 'button', class: 'quiet', text: 'Tentar novamente'.tr, onclick: refreshPurchases }));
      if (rawQuery) {
        emptyElements.push(
          element("button", {
            type: "button",
            class: "quiet",
            style: "margin: 0.5rem auto; display: block; text-decoration: underline; cursor: pointer;",
            text: "Limpar busca e ver produtos".tr,
            onclick: () => {
              if ($("#search")) $("#search").value = "";
              render();
            },
          }),
        );
      }
      $("#products").append(...emptyElements);
    }
    $("#resultCount").textContent = list.length === 1 ? `1 ${"produto".tr}` : `${list.length} ${"produtos".tr}`;
    $("#catalogTitle").textContent = showingFavorites ? "Produtos que mais comprei".tr : "Explore o catálogo".tr;
    loadMoreButton.textContent = "catalog.load_more".tr;
    loadMoreButton.hidden = list.length <= pageSize;
    if (pageObserver && !loadMoreButton.hidden) {
      pageObserver.observe(loadMoreButton);
    } else {
      pageObserver?.unobserve(loadMoreButton);
    }
  }

  function setFavoritesView(show) {
    showingFavorites = show;
    refreshPurchases();
    selectedCategories = [];
    selectedSubcategories = [];
    pageSize = 24;
    render();
  }

  function details(id) {
    const product = state.products.find((p) => p.id === id);
    const view = $("#productView");
    view.replaceChildren(
      element("button", {
        class: "quiet",
        text: "← Voltar ao catálogo".tr,
        onclick: () => navigate(state.basePath || "/"),
      }),
    );
    if (!product) {
      view.append(
        element("h1", { text: "Produto não encontrado ou indisponível.".tr }),
      );
      return;
    }
    state.trackEvent?.("view_item", {
      productId: product.id,
      productName: product.name,
      category: product.categoryName,
      value: Number(product.price?.amountMinor || 0) / 100,
    });
    document.title = `${product.name} · ${state.config.identity.name}`;

    const isInactive =
      product.status === "INATIVO" || product.isAvailable === false;
    const outOfStock =
      product.stock?.tracked &&
      product.stock.quantity < (product.saleUnit?.minimum || 1);
    const unavailable = isInactive || outOfStock;

    if (isInactive) {
      view.append(
        element("div", {
          class: "inactive-banner",
          text: "⚠️ AVISO: Este produto está INATIVO no sistema e não está disponível para compra.".tr,
        }),
      );
    }

    const images = [
      {
        url: product.imageUrl || "/store-assets/placeholder.svg",
        alt: product.name,
      },
      ...(product.images || []),
    ].filter(
      (image, index, all) =>
        all.findIndex((i) => i.url === image.url) === index,
    );
    const mainPhoto = element("render-image", {
      class: "detail-photo",
      src: images[0].url,
      "image-candidates": JSON.stringify(images.slice(1)),
      "fallback-src": "/store-assets/placeholder.svg",
      alt: product.imageIsIllustrative
        ? `Imagem ilustrativa de ${product.name}`
        : images[0].alt,
    });
    const quantity = element("input", {
      type: "number",
      value: product.saleUnit?.minimum || 1,
      min: product.saleUnit?.minimum || 1,
      step: product.saleUnit?.increment || 1,
      "aria-label": "Quantidade".tr,
    });
    if (product.stock?.tracked) {
      quantity.max = product.stock.quantity;
    }
    const specs = element("dl", { class: "specifications" });
    for (const attribute of Object.values(product.specifications || {})) {
      specs.append(
        element("dt", { text: attribute.label }),
        element("dd", { text: `${attribute.value} ${attribute.unit || ""}` }),
      );
    }

    const buyButton = element(
      "button",
      {
        class: "primary",
        text: isInactive ? "Item Inativo".tr : unavailable ? "Indisponível".tr : "Adicionar".tr,
        onclick: () => addFromCard(product, Number(quantity.value)),
        ...(unavailable ? { disabled: "" } : {}),
      },
      [!isInactive ? icon("cart") : null].filter(Boolean),
    );

    const editDetailBtn = element("button", {
      type: "button",
      class: "quiet",
      text: "catalog.edit_product".tr,
      onclick: () => {
        if (state.productEntry) {state.productEntry.open(product);}
      },
    });

    view.append(
      element("div", { class: "detail-grid" }, [
        element("div", { class: "detail-gallery" }, [
          element("div", { class: "detail-hero" }, [
            mainPhoto,
          ]),
          element(
            "div",
            { class: "thumbnails", ...(images.length < 2 ? { hidden: "" } : {}) },
            images.map((image, index) =>
              element(
                "button",
                {
                  "aria-label": `Foto ${index + 1}`,
                  onclick: () => {
                    mainPhoto.setAttribute("src", image.url);
                    mainPhoto.setAttribute("alt", image.alt);
                    mainPhoto.setAttribute("image-candidates", JSON.stringify(images.filter((candidate) => candidate.url !== image.url)));
                  },
                },
                [element("render-image", {
                  src: image.url,
                  "image-candidates": JSON.stringify(images.filter((candidate) => candidate.url !== image.url)),
                  "fallback-src": "/store-assets/placeholder.svg",
                  alt: "",
                  loading: "lazy",
                })],
              ),
            ),
          ),
        ]),
        element("div", { class: "detail-copy" }, [
          categoryTag(categoryLabel(product), "detail-category"),
          element("h1", { text: product.name, title: product.name }),
          element("strong", {
            class: "detail-price",
            text: money(product.price.amountMinor),
          }),
          element("p", { text: product.description }),
          element("div", { class: "purchase-row" }, [
            quantityControl(quantity),
            buyButton,
          ]),
          element("div", { style: "margin-top:10px;" }, [editDetailBtn]),
          element(
            "div",
            { class: "quick-specs" },
            Object.values(product.specifications || {})
              .slice(0, 3)
              .map((attribute) =>
                element("div", {}, [
                  icon(
                    /luz|\bsol\b|ambiente/i.test(attribute.label)
                      ? "sun"
                      : /rega|agua|água/i.test(attribute.label)
                        ? "drop"
                        : "leaf",
                  ),
                  element("span", {}, [
                    element("strong", { text: attribute.label }),
                    element("small", {
                      text: `${attribute.value} ${attribute.unit || ""}`,
                    }),
                  ]),
                ]),
              ),
          ),
        ]),
      ]),
    );

    const panels = [
      {
        id: "about",
        label: "Sobre o produto",
        nodes: [
          element("h2", { text: product.name, title: product.name }),
          element("p", {
            text:
              product.description ||
              "Consulte nossa equipe para saber mais sobre este produto.",
          }),
        ],
      },
      ...(product.contentSections || []).map((section) => ({
        id: section.id,
        label: section.title,
        nodes: [
          element("h2", { text: section.title }),
          element("p", { text: section.body }),
        ],
      })),
      {
        id: "specifications",
        label: "Especificações",
        nodes: Object.keys(product.specifications || {}).length
          ? [specs]
          : [
              element("p", {
                text: "Consulte nossa equipe para confirmar os detalhes deste produto.",
              }),
            ],
      },
    ];
    const tabs = element("div", {
      class: "detail-tabs",
      role: "tablist",
      "aria-label": "Informações do produto",
    });
    const content = element("section", {
      class: "detail-information",
      role: "tabpanel",
      id: "detailPanel",
      tabindex: "0",
    });
    const select = (index) => {
      for (const [position, button] of [...tabs.children].entries()) {
        button.setAttribute("aria-selected", String(position === index));
        button.tabIndex = position === index ? 0 : -1;
      }
      content.setAttribute("aria-labelledby", `detailTab${index}`);
      content.replaceChildren(...panels[index].nodes);
    };
    panels.forEach((panel, index) =>
      tabs.append(
        element("button", {
          role: "tab",
          id: `detailTab${index}`,
          "aria-controls": "detailPanel",
          text: panel.label,
          onclick: () => select(index),
          onkeydown: (event) => {
            if (
              !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
            ) {
              return;
            }
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? panels.length - 1
                  : (index +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      panels.length) %
                    panels.length;
            select(next);
            tabs.children[next].focus();
          },
        }),
      ),
    );
    select(0);
    view.append(tabs, content);
  }

  $("#search").addEventListener("input", () => {
    if ($("#catalogView").hidden) {
      navigate(state.basePath || "/");
    }
    pageSize = 24;
    render();
    const searchLength = $("#search").value.trim().length;
    clearTimeout(searchEventTimer);
    if (searchLength >= 2) {
      searchEventTimer = setTimeout(() => state.trackEvent?.("search", { searchLength, resultCount: renderedItems.length }), 650);
    }
  });
  $("#sortOrder").addEventListener("change", () => {
    pageSize = 24;
    render();
  });
  loadMoreButton.addEventListener("click", () => {
    pageSize += 24;
    render();
  });
  window.addEventListener("conflora-lang-change", () => {
    render();
  });


  return { render, details, card: renderCard, setFavoritesView, refreshPurchases };
}
