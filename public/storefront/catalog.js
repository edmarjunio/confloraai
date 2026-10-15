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
    product.subcategoryName,
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
  let selectedCategory = "";
  let showingFavorites = false;
  const favoriteKey = `store:${state.slug}:favorites`;
  const saved = storageGet(favoriteKey, []);
  const favorites = new Set(Array.isArray(saved) ? saved : []);

  function favorite(product) {
    const button = element(
      "button",
      {
        class: "favorite",
        "aria-label": `Favoritar ${product.name}`,
        "aria-pressed": String(favorites.has(product.id)),
      },
      [icon("heart")],
    );
    button.addEventListener("click", () => {
      if (favorites.has(product.id)) {
        favorites.delete(product.id);
      } else {
        favorites.add(product.id);
      }
      storageSet(favoriteKey, [...favorites]);
      button.setAttribute("aria-pressed", String(favorites.has(product.id)));
      if (showingFavorites) {
        render();
      }
    });
    return button;
  }

  const categoryLabel = (product) => {
    const names = product.categories
      ?.map((id) => state.config?.categories?.find((c) => c.id === id)?.name)
      .filter(Boolean);
    return names?.length ? names.join(" · ") : (product.categoryName || product.category || "");
  };

  function categoryOptions(products) {
    const categories = new Map();
    const configured = state.config?.categories || [];
    for (const product of products) {
      const ids = Array.isArray(product.categories) ? product.categories : [];
      if (ids.length) {
        for (const id of ids) {
          const category = configured.find((item) => item.id === id);
          const name = category?.name || product.categoryName || product.category;
          if (name && category?.isActive !== false) {
            categories.set(id, { id, name });
          }
        }
      } else {
        const name = product.categoryName || product.category;
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

  function card(product, compact = false) {
    const photo = element("img", {
      src: product.imageUrl || "/store-assets/placeholder.svg",
      alt: product.imageIsIllustrative
        ? `Imagem ilustrativa de ${product.name}`
        : product.name,
      loading: "lazy",
      decoding: "async",
    });
    photo.addEventListener(
      "error",
      () => {
        photo.src = "/store-assets/placeholder.svg";
      },
      { once: true },
    );
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

    const button = element("button", {
      class: "primary",
      text: isInactive
        ? "Item Inativo"
        : unavailable
          ? "Indisponível"
          : "Adicionar",
      onclick: () => add(product, product.saleUnit?.minimum || 1),
    });
    button.disabled = unavailable;
    if (!isInactive) {
      button.prepend(icon("cart"));
    }

    const editBtn = element("button", {
      type: "button",
      class: "card-quick-edit",
      title: "Editar produto",
      text: "✏️",
      onclick: (event) => {
        event.stopPropagation();
        state.productEntry?.open(product);
      },
    });

    return element(
      "article",
      { class: compact ? "recommendation" : `product-card ${isInactive ? "is-inactive" : ""}` },
      [
        ...(highlights.length
          ? [element("div", { class: "product-feature-tags", "aria-label": "Características do produto" }, highlights.map((highlight) => element("span", {
            class: `product-feature-tag ${highlight.tone}`,
            text: `${highlight.icon} ${highlight.label}`,
          })))]
          : []),
        ...(!compact ? [favorite(product), editBtn] : []),
        ...(isInactive
          ? [element("div", { class: "badge-inactive", text: "⚠️ INATIVO - Indisponível" })]
          : []),
        element("button", { class: "product-photo", "aria-label": `Ver ${product.name}`, onclick: open }, [photo]),
        element("div", { class: "product-content" }, [
          element("button", { class: "product-name", text: product.name, onclick: open }),
          element("small", {
            class: "muted",
            text: categoryLabel(product) || product.tags?.slice(0, 2).join(" · "),
          }),
          element("strong", {
            text: `${money(product.price.amountMinor)}${(product.saleUnit?.code || "UN") === "UN" ? "" : " / " + (product.saleUnit?.label || product.saleUnit?.code)}`,
          }),
          button,
        ]),
      ],
    );
  }

  function render() {
    const rawQuery = $("#search").value.trim();
    let baseList = state.products.filter(
      (product) => product.status !== "INATIVO" && product.isAvailable !== false,
    );
    if (showingFavorites) {
      baseList = baseList.filter((product) => favorites.has(product.id));
    }
    const categories = categoryOptions(baseList);
    $("#categoryFilterControl").hidden = categories.length === 0;
    if (!categories.some((category) => category.id === selectedCategory)) {
      selectedCategory = "";
    }
    $("#categoryFilterControl").replaceChildren(
      element("button", {
        type: "button",
        class: `category-chip${selectedCategory ? "" : " is-active"}`,
        text: "Todas",
        "aria-pressed": String(!selectedCategory),
        onclick: () => {
          selectedCategory = "";
          pageSize = 24;
          render();
        },
      }),
      ...categories.map((category) =>
        element("button", {
          type: "button",
          class: `category-chip${selectedCategory === category.id ? " is-active" : ""}`,
          text: category.name,
          "aria-pressed": String(selectedCategory === category.id),
          onclick: () => {
            selectedCategory = category.id;
            pageSize = 24;
            render();
          },
        }),
      ),
    );
    if (selectedCategory) {
      baseList = baseList.filter((product) => {
        const ids = Array.isArray(product.categories) ? product.categories : [];
        if (ids.includes(selectedCategory)) {
          return true;
        }
        const fallbackName = product.categoryName || product.category;
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

    $("#products").replaceChildren(
      ...list.slice(0, pageSize).map((p) => card(p)),
    );
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
    $("#loadMore").hidden = list.length <= pageSize;
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
    const mainPhoto = element("img", {
      class: "detail-photo",
      src: images[0].url,
      alt: product.imageIsIllustrative
        ? `Imagem ilustrativa de ${product.name}`
        : images[0].alt,
    });
    mainPhoto.addEventListener(
      "error",
      () => {
        mainPhoto.src = "/store-assets/placeholder.svg";
      },
      { once: true },
    );
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
                    mainPhoto.src = image.url;
                    mainPhoto.alt = image.alt;
                  },
                },
                [element("img", { src: image.url, alt: "", loading: "lazy" })],
              ),
            ),
          ),
        ]),
        element("div", { class: "detail-copy" }, [
          element("small", {
            class: "detail-category",
            text: categoryLabel(product),
          }),
          element("h1", { text: product.name }),
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
          element("h2", { text: product.name }),
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
  });
  $("#sortOrder").addEventListener("change", () => {
    pageSize = 24;
    render();
  });
  $("#loadMore").addEventListener("click", () => {
    pageSize += 24;
    render();
  });

  return { render, details, card, setFavoritesView };
}
