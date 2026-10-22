import {
  $,
  element,
  money,
  quantityControl,
  openDialog,
  notify,
} from "./ui.js";
import { icon } from "./icons.js";
import { searchProducts, normalize as normalizeProductText } from "./guided-search.mjs";
let productInfoModule;
const prepareProductInfo = () => productInfoModule ||= import('./product-info-content.js').catch(error => { productInfoModule = null; throw error; });
const canPrefetch = () => !navigator.connection?.saveData && !/^(slow-)?2g$/.test(navigator.connection?.effectiveType || '');

function triggerButtonKick(btn) {
  if (!btn) return;
  btn.classList.remove("cf-btn-kick");
  void btn.offsetWidth;
  btn.classList.add("cf-btn-kick");
  setTimeout(() => {
    btn?.classList?.remove("cf-btn-kick");
  }, 450);
}

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
  const cardCache = new Map();
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
      triggerButtonKick(confirm);
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

  async function openProductInformation(product) {
    let buildProductInfoContent;
    try { ({ buildProductInfoContent } = await prepareProductInfo()); }
    catch { notify('Não foi possível carregar os detalhes. Reabra a loja para atualizar a versão.'); return; }
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
      triggerButtonKick(addButton);
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

  function renderCard(product, { compact = false, chat = false, priority = false } = {}) {
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
      variant: chat ? "chat-mini" : compact ? "recommendation" : "storefront",
      "product-data": JSON.stringify(cardProduct),
      'image-loading': priority ? 'eager' : 'lazy',
      'image-priority': priority ? 'high' : 'auto',
    });
    let intentTimer;
    const prepare = () => {
      clearTimeout(intentTimer);
      if (canPrefetch()) intentTimer = setTimeout(() => prepareProductInfo().catch(() => {}), 120);
    };
    card.addEventListener('pointerenter', prepare);
    card.addEventListener('focusin', prepare);
    card.addEventListener('pointerleave', () => clearTimeout(intentTimer));
    card.addEventListener('focusout', () => clearTimeout(intentTimer));
    card.addEventListener("cf-product-card-action", (event) => {
      const { action, nativeEvent } = event.detail || {};
      if (action === "open") open();
      if (action === "add" && !unavailable) {
          const btn = nativeEvent?.target?.closest('button') || card.querySelector('.product-card-add-button') || card.querySelector('.chat-mini-add') || card.querySelector('.product-add-quick-button');
          if (btn) triggerButtonKick(btn);
          const addBtn = card.querySelector('.chat-mini-add');
          if (addBtn && !addBtn.dataset.animating) {
            addBtn.dataset.animating = 'true';
            const originalText = addBtn.innerHTML;
            addBtn.innerHTML = '<span>✓ Adicionado</span>';
            addBtn.style.backgroundColor = '#059669';
            addBtn.style.borderColor = '#047857';
            setTimeout(() => {
              addBtn.innerHTML = originalText;
              addBtn.style.backgroundColor = '';
              addBtn.style.borderColor = '';
              delete addBtn.dataset.animating;
            }, 1000);
          }
          addFromCard(product, product.saleUnit?.minimum || 1, chat ? () => card.dispatchEvent(new CustomEvent('chat-product-added', { bubbles: true, detail: { product, card } })) : null);
        }
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
    const updateFilters = (clearSubcats = false) => {
      if (clearSubcats) selectedSubcategories = [];
      pageSize = 24;
      render();
    };
    $("#categoryFilterControl").replaceChildren(
      categoryFilter("Mais comprados".tr, showingFavorites, () => {
        showingFavorites = !showingFavorites;
        updateFilters();
        refreshPurchases();
      }, "purchases"),
      categoryFilter("Todas as categorias".tr, !showingFavorites && selectedCategories.length === 0, () => {
        showingFavorites = false;
        selectedCategories = [];
        updateFilters(true);
      }, "all"),
      ...categories.map(category => categoryFilter(category.name, selectedCategories.includes(category.id), () => {
        selectedCategories = window.ConfloraCategoryUi.toggleSelection(selectedCategories, category.id);
        state.trackEvent?.("category_filter", { category: category.name, categories: selectedCategories });
        updateFilters(false);
      })),
      ...(selectedCategories.length ? [element("render-category-tag", {
        category: "Limpar categorias".tr, variant: "action", selected: "true", onclick: () => {
          selectedCategories = []; updateFilters(true);
        },
      })] : []),
    );

    const subcatContainer = $("#subcategoryFilterControl");
    const options = new Map();
    for (const category of categories.filter(category => selectedCategories.includes(category.id))) {
      for (const name of getSubcategoryOptions(activeProducts, category.id)) {
        const key = normalizeProductText(name);
        if (!options.has(key)) options.set(key, { name, parent: category.name, parentId: category.id });
      }
    }
    selectedSubcategories = selectedSubcategories.filter(key => options.has(key));
    if (subcatContainer) {
      subcatContainer.hidden = options.size === 0;
      subcatContainer.replaceChildren(...(options.size ? [
        element("span", { class: "subcategory-header-badge", text: "Subcategorias:".tr }),
        categoryFilter("Todas as subcategorias".tr, selectedSubcategories.length === 0, () => {
          selectedSubcategories = [];
          pageSize = 24;
          render();
        }, "all"),
        ...[...options.entries()].map(([key, sub]) => categoryFilter(sub.name,
          selectedSubcategories.includes(key), () => {
            selectedSubcategories = window.ConfloraCategoryUi.toggleSelection(selectedSubcategories, key);
            pageSize = 24; render();
          }, "", sub.parent)),
        ...(selectedSubcategories.length ? [element("render-category-tag", {
          category: "Limpar subcategorias".tr, variant: "action", selected: "true", onclick: () => {
            selectedSubcategories = []; pageSize = 24; render();
          },
        })] : []),
      ] : []));
    }
    renderMobileFilter(categories, activeProducts, updateFilters);
    const categoriesWithSelectedSub = new Set(
      selectedSubcategories.map(key => options.get(key)?.parentId).filter(Boolean),
    );
    baseList = baseList.filter(product => {
      if (!window.ConfloraCategoryUi.matchesAny(selectedCategories, id => productMatchesCategory(product, id))) {
        return false;
      }
      if (selectedSubcategories.length === 0) return true;
      const prodSub = normalizeProductText(productSubcategory(product));
      if (selectedSubcategories.includes(prodSub)) return true;
      const matchesCatWithSub = [...categoriesWithSelectedSub].some(catId => productMatchesCategory(product, catId));
      return !matchesCatWithSub;
    });

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
    const container = $('#products');
    container.removeAttribute('aria-busy');
    const visible = list.slice(0, pageSize);
    const desired = visible.map((product, index) => {
      const priority = index < (window.innerWidth < 768 ? 2 : 4);
      const signature = JSON.stringify([product, categoryLabel(product), priority]);
      let entry = cardCache.get(product.id);
      if (!entry || entry.signature !== signature) {
        entry = { signature, node: renderCard(product, { priority }) };
        cardCache.set(product.id, entry);
        window.ConfloraPerformance?.count('cardsCreated');
      } else { window.ConfloraPerformance?.count('cardsReused'); }
      return entry.node;
    });
    const keep = new Set(desired);
    for (const child of [...container.children]) if (!keep.has(child)) child.remove();
    desired.forEach((node, index) => {
      if (container.children[index] !== node) container.insertBefore(node, container.children[index] || null);
    });
    const visibleIds = new Set(visible.map(product => product.id));
    for (const id of cardCache.keys()) if (!visibleIds.has(id)) cardCache.delete(id);
    if (!list.length) {
      const emptyContainer = element("div", {
        class: "catalog-empty-state",
      }, [
        element("p", {
          class: "empty catalog-empty-text",
          text: showingFavorites ? (purchaseLoading ? "Carregando suas compras..." : purchaseError || (state.user ? "Seus produtos comprados aparecerão aqui, dos mais comprados para os menos comprados." : "Entre na sua conta para ver os produtos que você mais compra.")).tr : "Nenhum produto encontrado. Tente outra busca.".tr,
        }),
        ...(showingFavorites && purchaseError ? [
          element('button', { type: 'button', class: 'quiet catalog-empty-action', text: 'Tentar novamente'.tr, onclick: refreshPurchases })
        ] : []),
        ...(rawQuery ? [
          element("button", {
            type: "button",
            class: "quiet catalog-empty-action",
            style: "margin: 0.75rem auto 0; display: block; text-decoration: underline; cursor: pointer;",
            text: "Limpar busca e ver produtos".tr,
            onclick: () => {
              if ($("#search")) $("#search").value = "";
              render();
            },
          }),
        ] : []),
      ]);
      $("#products").replaceChildren(emptyContainer);
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
      loading: 'eager',
      fetchpriority: 'high',
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
        onclick: () => {
          triggerButtonKick(buyButton);
          addFromCard(product, Number(quantity.value));
        },
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

  function renderMobileFilter(categoriesList, currentActiveProducts, doUpdateFilters) {
    const container = $("#filterDialogBody");
    if (!container) return;

    const activeCatId = selectedCategories.length > 0 ? selectedCategories[0] : null;
    const activeCatObj = categoriesList.find((c) => c.id === activeCatId);

    // 1. Grupo de Categorias
    const catButtons = [
      element("button", {
        type: "button",
        class: `filter-choice-btn is-special${selectedCategories.length === 0 ? " is-active" : ""}`,
        text: "Todas as categorias",
        onclick: () => {
          selectedCategories = [];
          selectedSubcategories = [];
          doUpdateFilters(true);
          $("#filterDialog")?.close();
        },
      }),
      ...categoriesList.map((category) => {
        const isSelected = selectedCategories.includes(category.id);
        return element("button", {
          type: "button",
          class: `filter-choice-btn${isSelected ? " is-active" : ""}`,
          text: category.name,
          onclick: () => {
            selectedCategories = [category.id];
            selectedSubcategories = [];
            const subOpts = getSubcategoryOptions(currentActiveProducts, category.id);
            if (subOpts.length === 0) {
              doUpdateFilters(true);
              $("#filterDialog")?.close();
            } else {
              renderMobileFilter(categoriesList, currentActiveProducts, doUpdateFilters);
            }
          },
        });
      }),
    ];

    const catSection = element("section", { class: "filter-group" }, [
      element("h3", { class: "filter-group-title", text: "Categorias" }),
      element("div", { class: "filter-buttons-grid" }, catButtons),
    ]);

    // 2. Grupo de Subcategorias (da categoria ativa)
    const subSections = [];
    if (activeCatObj) {
      const subOpts = getSubcategoryOptions(currentActiveProducts, activeCatObj.id);
      if (subOpts.length > 0) {
        const subButtons = [
          element("button", {
            type: "button",
            class: `filter-choice-btn is-special${selectedSubcategories.length === 0 ? " is-active" : ""}`,
            text: "TODAS",
            onclick: () => {
              selectedSubcategories = [];
              doUpdateFilters(false);
              $("#filterDialog")?.close();
            },
          }),
          ...subOpts.map((name) => {
            const key = normalizeProductText(name);
            const isSelected = selectedSubcategories.includes(key);
            return element("button", {
              type: "button",
              class: `filter-choice-btn${isSelected ? " is-active" : ""}`,
              text: name,
              onclick: () => {
                selectedSubcategories = [key];
                doUpdateFilters(false);
                $("#filterDialog")?.close();
              },
            });
          }),
        ];

        subSections.push(
          element("section", { class: "filter-group" }, [
            element("h3", { class: "filter-group-title", text: `Subcategorias de ${activeCatObj.name}` }),
            element("div", { class: "filter-buttons-grid" }, subButtons),
          ]),
        );
      }
    }

    container.replaceChildren(catSection, ...subSections);

    // 3. Atualização de Badge e Pills na barra móvel
    const badge = $("#activeFilterBadge");
    const pillsContainer = $("#mobileActiveFilterPills");
    const totalActive = (selectedCategories.length > 0 ? 1 : 0) + selectedSubcategories.length;
    if (badge) {
      badge.textContent = String(totalActive);
      badge.hidden = totalActive === 0;
    }
    if (pillsContainer) {
      const pills = [];
      if (activeCatObj) {
        pills.push(
          element("button", {
            type: "button",
            class: "mobile-active-pill",
            title: "Remover filtro de categoria",
            onclick: () => {
              selectedCategories = [];
              selectedSubcategories = [];
              doUpdateFilters(true);
            },
          }, [
            element("span", { text: activeCatObj.name }),
            element("span", { class: "mobile-active-pill-remove", text: "✕" }),
          ]),
        );
      }
      if (selectedSubcategories.length > 0) {
        for (const subKey of selectedSubcategories) {
          pills.push(
            element("button", {
              type: "button",
              class: "mobile-active-pill",
              title: "Remover filtro de subcategoria",
              onclick: () => {
                selectedSubcategories = selectedSubcategories.filter((k) => k !== subKey);
                doUpdateFilters(false);
              },
            }, [
              element("span", { text: subKey }),
              element("span", { class: "mobile-active-pill-remove", text: "✕" }),
            ]),
          );
        }
      }
      pillsContainer.replaceChildren(...pills);
    }
  }

  $("#openFilterDialogBtn")?.addEventListener("click", () => {
    openDialog($("#filterDialog"));
  });
  $("#navCategoriesBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openDialog($("#filterDialog"));
  });

  return { render, details, card: renderCard, setFavoritesView, refreshPurchases };
}
