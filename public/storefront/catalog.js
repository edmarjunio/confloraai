import {
  $,
  element,
  money,
  normalize,
  quantityControl,
  storageGet,
  storageSet,
} from "./ui.js";
import { icon } from "./icons.js";

export function createCatalog(state, add, navigate) {
  let category = "";
  let pageSize = 24;
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
    });
    return button;
  }
  const categoryLabel = (product) =>
    product.categories
      .map((id) => state.config.categories.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(" · ");
  function card(product, compact = false) {
    const photo = element("img", {
      src: product.imageUrl || "/store-assets/placeholder.svg",
      alt: product.name,
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
    const unavailable =
      product.stock.tracked &&
      product.stock.quantity < product.saleUnit.minimum;
    const button = element("button", {
      class: "primary",
      text: unavailable ? "Indisponível" : "Adicionar",
      onclick: () => add(product, product.saleUnit.minimum),
    });
    button.disabled = unavailable;
    button.prepend(icon("cart"));
    return element(
      "article",
      { class: compact ? "recommendation" : "product-card" },
      [
        ...(!compact ? [favorite(product)] : []),
        element(
          "button",
          {
            class: "product-photo",
            "aria-label": `Ver ${product.name}`,
            onclick: open,
          },
          [photo],
        ),
        element("div", { class: "product-content" }, [
          element("button", {
            class: "product-name",
            text: product.name,
            onclick: open,
          }),
          element("small", {
            class: "muted",
            text:
              categoryLabel(product) || product.tags.slice(0, 2).join(" · "),
          }),
          element("strong", {
            text: `${money(product.price.amountMinor)}${product.saleUnit.code === "UN" ? "" : " / " + product.saleUnit.label}`,
          }),
          button,
        ]),
      ],
    );
  }
  function render() {
    const query = normalize($("#search").value);
    const list = state.products.filter(
      (p) =>
        (!category || p.categories.includes(category)) &&
        normalize([p.name, p.description, ...p.tags].join(" ")).includes(query),
    );
    const sort = $("#sort").value;
    list.sort(
      (a, b) =>
        (sort === "sales"
          ? (b.salesCount || 0) - (a.salesCount || 0)
          : sort === "price"
            ? a.price.amountMinor - b.price.amountMinor
            : sort === "priceDesc"
              ? b.price.amountMinor - a.price.amountMinor
              : 0) || a.name.localeCompare(b.name, "pt-BR"),
    );
    $("#products").replaceChildren(
      ...list.slice(0, pageSize).map((p) => card(p)),
    );
    if (!list.length) {
      $("#products").append(
        element("p", {
          class: "empty",
          text: "Nenhum produto encontrado. Tente outra busca ou categoria.",
        }),
      );
    }
    $("#resultCount").textContent = `${list.length} produtos`;
    $("#loadMore").hidden = list.length <= pageSize;
  }
  function categories() {
    const items = [
      { id: "", name: "Todas" },
      ...state.config.categories
        .filter((c) => c.isActive)
        .sort((a, b) => a.order - b.order),
    ];
    $("#categories").replaceChildren(
      ...items.map((c) =>
        element("button", {
          text: c.name,
          class: c.id === category ? "pill active" : "pill",
          "aria-pressed": String(c.id === category),
          onclick: () => {
            category = c.id;
            pageSize = 24;
            categories();
            render();
          },
        }),
      ),
    );
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
    const images = [
      {
        url: product.imageUrl || "/store-assets/placeholder.svg",
        alt: product.name,
      },
      ...product.images,
    ].filter(
      (image, index, all) =>
        all.findIndex((i) => i.url === image.url) === index,
    );
    const mainPhoto = element("img", {
      class: "detail-photo",
      src: images[0].url,
      alt: images[0].alt,
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
      value: product.saleUnit.minimum,
      min: product.saleUnit.minimum,
      step: product.saleUnit.increment,
      "aria-label": "Quantidade",
    });
    if (product.stock.tracked) {
      quantity.max = product.stock.quantity;
    }
    const specs = element("dl", { class: "specifications" });
    for (const attribute of Object.values(product.specifications)) {
      specs.append(
        element("dt", { text: attribute.label }),
        element("dd", { text: `${attribute.value} ${attribute.unit || ""}` }),
      );
    }
    view.append(
      element("div", { class: "detail-grid" }, [
        element("div", { class: "detail-gallery" }, [
          element("div", { class: "detail-hero" }, [
            mainPhoto,
            favorite(product),
          ]),
          element(
            "div",
            { class: "thumbnails", ...(images.length < 2 ? { hidden: '' } : {}) },
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
            element(
              "button",
              {
                class: "primary",
                text:
                  product.stock.tracked &&
                  product.stock.quantity < product.saleUnit.minimum
                    ? "Indisponível"
                    : "Adicionar à sacola",
                onclick: () => add(product, Number(quantity.value)),
                ...(product.stock.tracked &&
                product.stock.quantity < product.saleUnit.minimum
                  ? { disabled: "" }
                  : {}),
              },
              [icon("cart")],
            ),
          ]),
          element(
            "div",
            { class: "quick-specs" },
            Object.values(product.specifications)
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
      ...product.contentSections.map((section) => ({
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
        nodes: Object.keys(product.specifications).length
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
  $("#sort").addEventListener("change", render);
  $("#loadMore").addEventListener("click", () => {
    pageSize += 24;
    render();
  });
  return { render, categories, details, card };
}
