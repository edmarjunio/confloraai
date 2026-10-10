import { $, element, money, normalize } from "./ui.js";

export function createCatalog(state, add, navigate) {
  let category = "";
  let pageSize = 24;
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
        `/shop/${state.slug}/products/${encodeURIComponent(product.id)}`,
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
    return element(
      "article",
      { class: compact ? "recommendation" : "product-card" },
      [
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
            text: product.tags.slice(0, 2).join(" · "),
          }),
          element("strong", {
            text: `${money(product.price.amountMinor)} / ${product.saleUnit.label}`,
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
        onclick: () => navigate(`/shop/${state.slug}`),
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
    const specs = element("dl", { class: "specifications" });
    for (const attribute of Object.values(product.specifications)) {
      specs.append(
        element("dt", { text: attribute.label }),
        element("dd", { text: `${attribute.value} ${attribute.unit || ""}` }),
      );
    }
    view.append(
      element("div", { class: "detail-grid" }, [
        element("div", {}, [
          mainPhoto,
          element(
            "div",
            { class: "thumbnails" },
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
          element("h1", { text: product.name }),
          element("strong", {
            class: "detail-price",
            text: money(product.price.amountMinor),
          }),
          element("p", { text: product.description }),
          element("div", { class: "purchase-row" }, [
            quantity,
            element("button", {
              class: "primary",
              text: "Adicionar à sacola",
              onclick: () => add(product, Number(quantity.value)),
            }),
          ]),
          specs,
          ...product.contentSections.map((section) =>
            element("section", { class: "content-section" }, [
              element("h2", { text: section.title }),
              element("p", { text: section.body }),
            ]),
          ),
        ]),
      ]),
    );
  }
  $("#search").addEventListener("input", () => {
    if ($("#catalogView").hidden) {
      navigate(`/shop/${state.slug}`);
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
