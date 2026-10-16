import {
  $,
  element,
  money,
  quantityControl,
  storageGet,
  storageSet,
} from "./ui.js";
import { icon } from "./icons.js";
import { searchProducts } from "./guided-search.mjs";
import { buildProductInfoContent } from "./product-info-content.js";

const PRODUCT_HIGHLIGHTS = [
  { label: "Sol Pleno", icon: "☀", tone: "sun", terms: ["sol pleno", "pleno sol"] },
  { label: "Meia Sombra", icon: "◐", tone: "shade", terms: ["meia sombra", "luz indireta"] },
  { label: "Sombra", icon: "☾", tone: "shade", terms: ["sombra"] },
  { label: "Irrigado", icon: "💧", tone: "water", terms: ["irrigado", "solo umido", "solo humido"] },
  { label: "Aquático", icon: "💧", tone: "water", terms: ["aquatico", "aquatica"] },
  { label: "Ave Exótica", icon: "✦", tone: "pet", terms: ["ave exotica", "ave ornamental"] },
  { label: "Pet Friendly", icon: "🐾", tone: "pet", terms: ["pet friendly", "seguro para pets"] },
  { label: "Frutífera", icon: "●", tone: "fruit", terms: ["frutifera", "frutifero"] },
  { label: "Florífera", icon: "✿", tone: "flower", terms: ["florifera", "florifero", "flores ornamentais"] },
];

function normalizeProductText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getProductHighlights(product) {
  const specificationText = Object.values(product.specifications || {})
    .flatMap((specification) => [specification?.label, specification?.value])
    .filter(Boolean);
  const sourceText = normalizeProductText([
    product.name,
    product.categoryName,
    product.description,
    product.descriptionAi,
    product.descricao_ia,
    ...(Array.isArray(product.tags) ? product.tags : []),
    ...(Array.isArray(product.searchAliases) ? product.searchAliases : []),
    product.ambiente_ideal,
    product.cuidados_basicos,
    ...specificationText,
  ].join(" "));

  return PRODUCT_HIGHLIGHTS.filter((highlight) => {
    if (highlight.label === "Sombra" && sourceText.includes("meia sombra")) {
      return false;
    }
    return highlight.terms.some((term) => sourceText.includes(term));
  }).slice(0, 2);
}

export function createCatalog(state, add, navigate) {
  let pageSize = 24;
  let renderedItems = [];
  let loadingNextPage = false;
  let selectedCategory = "";
  let showingFavorites = false;
  const favoriteKey = () => `store:${state.slug}:user:${state.user?.id || "guest"}:favorites`;
  const favorites = new Set();
  let favoriteRevision = 0;
  let favoriteSaveQueue = Promise.resolve();
  let searchEventTimer;
  const loadMoreButton = $("#loadMore");
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

  function persistFavorites() {
    favoriteRevision += 1;
    storageSet(favoriteKey(), [...favorites]);
    if (state.user && state.existingStore) {
      const snapshot = [...favorites];
      favoriteSaveQueue = favoriteSaveQueue
        .then(() => state.api("/favorites", {
          method: "PUT",
          body: { favoriteProductIds: snapshot },
        }))
        .catch((error) => console.warn("Não foi possível sincronizar os favoritos.", error));
    }
  }

  async function refreshFavorites() {
    const revisionAtStart = favoriteRevision;
    const saved = storageGet(favoriteKey(), []);
    favorites.clear();
    for (const id of Array.isArray(saved) ? saved : []) favorites.add(id);
    if (state.user && state.existingStore) {
      try {
        const result = await state.api("/favorites");
        if (favoriteRevision === revisionAtStart) {
          favorites.clear();
          for (const id of result.favoriteProductIds || []) favorites.add(id);
          storageSet(favoriteKey(), [...favorites]);
        }
      } catch (error) {
        console.warn("Não foi possível carregar favoritos da conta.", error);
      }
    }
    render();
  }

  function toggleFavorite(product) {
    if (!state.user) {
      const accountDialog = $("#accountDialog");
      if (accountDialog && !accountDialog.open) accountDialog.showModal();
      return false;
    }
    if (favorites.has(product.id)) favorites.delete(product.id);
    else favorites.add(product.id);
    persistFavorites();
    if (showingFavorites) render();
    return true;
  }

  function favorite(product) {
    const isFavorite = favorites.has(product.id);
    const button = element("button", {
      type: "button",
      class: "favorite",
      "aria-label": isFavorite ? "Remover dos curtidos" : "Adicionar aos curtidos",
      "aria-pressed": String(isFavorite),
      onclick: () => {
        if (!toggleFavorite(product)) return;
        const nowFavorite = favorites.has(product.id);
        button.setAttribute("aria-pressed", String(nowFavorite));
        button.setAttribute("aria-label", nowFavorite ? "Remover dos curtidos" : "Adicionar aos curtidos");
      },
    }, [icon("heart")]);
    return button;
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
      "aria-label": "Fechar informações",
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
            element("span", { class: "product-info-unit", text: product.saleUnit?.label ? `por ${product.saleUnit.label}` : "preço atual" }),
          ]),
        ]),
        closeButton,
      ]),
      element("div", { class: "product-info-body" }, [
        element("section", { class: "product-info-intro" }, [
          element("span", { class: "product-info-eyebrow", text: "ESCOLHA COM CONFIANÇA" }),
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
    const addButton = element("button", { type: "button", class: "cf-button product-info-add", text: unavailable ? "Indisponível" : "Adicionar à sacola", disabled: unavailable, onclick: () => {
      add(product, minimumQuantity);
      dialog.close();
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
      icon: categoryIcon(category),
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
  const categoryIcon = (name) => {
    const value = normalizeProductText(name);
    const sharedIcon = window.ConfloraProductUi?.categoryIcon(name);
    if (["hortifrutti", "frutifera", "frutifero", "horta", "pet", "animal", "planta", "muda", "outro"].some((term) => value.includes(term))) {
      return sharedIcon || "🌿";
    }
    const configuredIcon = state.config?.categories?.find((category) =>
      normalizeProductText(category.name) === normalizeProductText(name),
    )?.icon;
    return configuredIcon || sharedIcon || "🌿";
  };

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

  function renderCard(product, { compact = false } = {}) {
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
    const highlights = !compact && !isInactive ? getProductHighlights(product) : [];
    const category = categoryLabel(product);
    const cardProduct = {
      ...product,
      categoryName: category,
      productHighlights: highlights,
      unavailable,
    };
    const card = element("render-product-card", {
      variant: compact ? "recommendation" : "storefront",
      "product-data": JSON.stringify(cardProduct),
      favorite: String(favorites.has(product.id)),
    });
    card.addEventListener("cf-product-card-action", (event) => {
      const { action } = event.detail || {};
      if (action === "open") open();
      if (action === "add") add(product, product.saleUnit?.minimum || 1);
      if (action === "favorite" && toggleFavorite(product) && !showingFavorites) render();
      if (action === "info") openProductInformation(product);
    });
    return card;
  }

  function render() {
    const rawQuery = $("#search").value.trim();
    const activeProducts = state.products.filter(
      (product) => product.status !== "INATIVO" && product.isAvailable !== false,
    );
    let baseList = activeProducts;
    if (showingFavorites) {
      baseList = baseList.filter((product) => favorites.has(product.id));
    }
    const categories = categoryOptions(activeProducts);
    $("#categoryFilterControl").hidden = false;
    if (!categories.some((category) => category.id === selectedCategory)) {
      selectedCategory = "";
    }
    $("#categoryFilterControl").replaceChildren(
      element("button", {
        type: "button",
        class: `category-chip${showingFavorites ? " is-active" : ""}`,
        "aria-pressed": String(showingFavorites),
        onclick: () => {
          showingFavorites = !showingFavorites;
          selectedCategory = "";
          pageSize = 24;
          state.trackEvent?.("category_filter", { category: showingFavorites ? "Curtidos" : "Todas" });
          render();
        },
      }, [icon("heart"), element("span", { text: "Curtidos" })]),
      element("button", {
        type: "button",
        class: `category-chip${!showingFavorites && !selectedCategory ? " is-active" : ""}`,
        "aria-pressed": String(!showingFavorites && !selectedCategory),
        onclick: () => {
          showingFavorites = false;
          selectedCategory = "";
          pageSize = 24;
          state.trackEvent?.("category_filter", { category: "Todas" });
          render();
        },
      }, [element("span", { text: "🌿", "aria-hidden": "true" }), element("span", { text: "Todas" })]),
      ...categories.map((category) =>
        element("button", {
          type: "button",
          class: `category-chip${!showingFavorites && selectedCategory === category.id ? " is-active" : ""}`,
          "aria-pressed": String(!showingFavorites && selectedCategory === category.id),
          onclick: () => {
            showingFavorites = false;
            selectedCategory = category.id;
            pageSize = 24;
            state.trackEvent?.("category_filter", { category: category.name });
            render();
          },
        }, [element("span", { text: categoryIcon(category.name), "aria-hidden": "true" }), element("span", { text: category.name })]),
      ),
    );
    if (selectedCategory) {
      baseList = baseList.filter((product) => {
        const ids = Array.isArray(product.categories) ? product.categories : [];
        if (ids.includes(selectedCategory)) {
          return true;
        }
        const fallbackName = categoryLabel(product);
        return (
          !ids.length &&
          selectedCategory === `name:${normalizeProductText(fallbackName)}`
        );
      });
    }

    const list = rawQuery
      ? searchProducts(
          baseList,
          rawQuery,
          state.config?.assistant?.synonyms || [],
        ).map((result) => result.product)
      : [...baseList];
    const sortOrder = $("#sortOrder").value;
    if (!rawQuery || sortOrder !== "az") {
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
      $("#products").append(
        element("p", {
          class: "empty",
          text: showingFavorites
            ? "Você ainda não salvou produtos. Toque no coração para guardá-los aqui."
            : "Nenhum produto encontrado. Tente outra busca.",
        }),
      );
    }
    $("#resultCount").textContent = `${list.length} produtos`;
    $("#catalogTitle").textContent = showingFavorites
      ? "Seus produtos salvos"
      : "Explore o catálogo";
    loadMoreButton.hidden = list.length <= pageSize;
    if (pageObserver && !loadMoreButton.hidden) {
      pageObserver.observe(loadMoreButton);
    } else {
      pageObserver?.unobserve(loadMoreButton);
    }
  }

  function setFavoritesView(show) {
    showingFavorites = show;
    selectedCategory = "";
    pageSize = 24;
    render();
  }

  function details(id) {
    const product = state.products.find((p) => p.id === id);
    const view = $("#productView");
    view.replaceChildren(
      element("button", {
        class: "quiet",
        text: "← Voltar ao catálogo",
        onclick: () => navigate(state.basePath || "/"),
      }),
    );
    if (!product) {
      view.append(
        element("h1", { text: "Produto não encontrado ou indisponível." }),
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
          text: "⚠️ AVISO: Este produto está INATIVO no sistema e não está disponível para compra.",
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
      "aria-label": "Quantidade",
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
        text: isInactive
          ? "Item Inativo"
          : unavailable
            ? "Indisponível"
            : "Adicionar à sacola",
        onclick: () => add(product, Number(quantity.value)),
        ...(unavailable ? { disabled: "" } : {}),
      },
      [!isInactive ? icon("cart") : null].filter(Boolean),
    );

    const editDetailBtn = element("button", {
      type: "button",
      class: "quiet",
      text: "✏️ Editar Cadastro do Produto",
      onclick: () => {
        if (state.productEntry) {state.productEntry.open(product);}
      },
    });

    view.append(
      element("div", { class: "detail-grid" }, [
        element("div", { class: "detail-gallery" }, [
          element("div", { class: "detail-hero" }, [
            mainPhoto,
            favorite(product),
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
          element("small", {
            class: "detail-category",
            text: categoryLabel(product),
          }),
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

  refreshFavorites().catch(() => {});
  return { render, details, card: renderCard, setFavoritesView, refreshFavorites };
}
