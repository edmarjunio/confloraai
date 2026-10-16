import { $, element, openDialog, money } from "./ui.js";
import { icon } from "./icons.js";
import {
  normalize,
  scopedProducts,
  nextChoices,
  searchProducts,
} from "./guided-search.mjs";

export function createGuidedChat(state, catalog) {
  const messages = $("#chatMessages");
  let path = [];
  let selected = null;
  let activeResults = null;
  const pool = () =>
    scopedProducts(state.products, state.config.categories, path);
  const say = (text, role = "assistant") => {
    messages.append(element("p", { class: `bubble ${role}`, text }));
    messages.scrollTop = messages.scrollHeight;
  };
  const buttons = (choices) =>
    messages.append(
      element(
        "div",
        { class: "suggestions guided-choices" },
        choices.map(([text, action]) =>
          element("button", { text, onclick: action }),
        ),
      ),
    );
  function details(product) {
    selected = product;
    say(`Sobre ${product.name}`, "user");
    say(
      `${product.name} · ${money(product.price.amountMinor)} / ${product.saleUnit.label}`,
    );
    say(
      product.description ||
        "A loja ainda não cadastrou uma descrição para este produto.",
    );
    for (const attribute of Object.values(product.specifications || {})) {
      say(
        `${attribute.label}: ${attribute.value}${attribute.unit ? " " + attribute.unit : ""}`,
      );
    }
    for (const section of product.contentSections || []) {
      say(`${section.title}: ${section.body}`);
    }
    messages.append(catalog.card(product, true));
    say(
      "Essas são as informações cadastradas pela loja. Você pode adicionar à sacola ou buscar outro produto.",
    );
    messages.scrollTop = messages.scrollHeight;
  }
  function clearResults() {
    activeResults?.remove();
    activeResults = null;
    $("#chatDialog").classList.remove("has-product-results");
  }
  function results(products) {
    clearResults();
    selected = null;
    $("#chatDialog").classList.add("has-product-results");

    const count = element("span", { class: "guided-results-count" });
    const toolbar = element("div", { class: "guided-results-toolbar" }, [
      element("div", { class: "guided-results-heading" }, [
        element("strong", {
          class: "guided-results-title",
          text: path.length ? path.join(" · ") : "Produtos encontrados",
        }),
        count,
      ]),
      element("button", {
        type: "button",
        class: "guided-clear-filters",
        "aria-label": "Limpar filtros e escolher outra categoria",
        title: "Limpar filtros",
        onclick: () => {
          path = [];
          selected = null;
          messages.replaceChildren();
          clearResults();
          browse();
        },
      }, [icon("x")]),
    ]);
    const searchInput = element("input", {
      type: "search",
      class: "guided-results-search",
      placeholder: "Pesquisar produto nesta seleção…",
      "aria-label": "Pesquisar produto nesta seleção",
    });
    const grid = element("div", { class: "guided-results-grid" });
    const empty = element("p", {
      class: "guided-results-empty",
      text: "Nenhum produto encontrado nesta seleção.",
      hidden: "",
    });
    const more = element("button", {
      type: "button",
      class: "guided-more",
      hidden: "",
    });
    const panel = element("section", { class: "guided-results" }, [
      toolbar,
      searchInput,
      grid,
      empty,
      more,
    ]);
    activeResults = panel;
    messages.append(panel);

    const availableProducts = [...products].sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR"),
    );
    let matchingProducts = availableProducts;
    let visibleCount = 0;
    const renderProducts = () => {
      const query = normalize(searchInput.value);
      matchingProducts = availableProducts.filter((product) =>
        !query || normalize(product.name).includes(query),
      );
      visibleCount = Math.min(24, matchingProducts.length);
      grid.replaceChildren(
        ...matchingProducts.slice(0, visibleCount).map((product) => catalog.card(product)),
      );
      count.textContent = `${matchingProducts.length} ${matchingProducts.length === 1 ? "produto" : "produtos"}`;
      empty.hidden = matchingProducts.length > 0;
      more.hidden = matchingProducts.length <= visibleCount;
      more.textContent = `Mostrar mais produtos (${matchingProducts.length - visibleCount})`;
    };
    searchInput.addEventListener("input", renderProducts);
    more.addEventListener("click", () => {
      const previousCount = visibleCount;
      visibleCount = Math.min(visibleCount + 24, matchingProducts.length);
      grid.append(
        ...matchingProducts.slice(previousCount, visibleCount).map((product) => catalog.card(product)),
      );
      more.hidden = matchingProducts.length <= visibleCount;
      more.textContent = `Mostrar mais produtos (${matchingProducts.length - visibleCount})`;
    });
    renderProducts();
    messages.scrollTop = messages.scrollHeight;
  }
  function browse() {
    clearResults();
    selected = null;
    const choices = nextChoices(state.products, state.config.categories, path);
    say(
      path.length
        ? `${path.join(" → ")}. Qual opção você procura?`
        : "Do que você precisa?",
    );
    if (choices.length) {
      buttons(
        choices.map((choice) => [
          choice.name,
          () => {
            say(choice.name, "user");
            path.push(choice.name);
            browse();
          },
        ]),
      );
      if (path.length) {
        buttons([["Ver todos desta categoria", () => results(pool())]]);
      }
    } else {
      results(pool());
    }
    messages.scrollTop = messages.scrollHeight;
  }
  function search(query, all = false) {
    const source = all
      ? scopedProducts(state.products, state.config.categories, [])
      : pool();
    const matches = searchProducts(
      source,
      query,
      state.config.assistant.synonyms || [],
    );
    if (!matches.length) {
      say(
        "Não encontrei esse nome nesta seleção. Tente uma palavra mais curta ou um nome alternativo.",
      );
      if (path.length && !all) {
        buttons([
          [
            "Buscar em toda a loja",
            () => {
              path = [];
              search(query, true);
            },
          ],
        ]);
      }
      return;
    }
    if (matches.some((match) => match.approximate)) {
      say("Encontrei nomes parecidos. Confira qual deles você procura:");
    }
    results(matches.map((match) => match.product));
  }
  $("#chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = $("#chatInput").value.trim();
    if (!query) {
      return;
    }
    $("#chatInput").value = "";
    say(query, "user");
    const choice = nextChoices(
      state.products,
      state.config.categories,
      path,
    ).find((item) => normalize(item.name) === normalize(query));
    if (choice) {
      path.push(choice.name);
      browse();
      return;
    }
    if (
      selected &&
      /^(preco|valor|quanto custa|como cuidar|cuidados|detalhes|especificacoes|tamanho|ambiente)[ ?]*$/.test(
        normalize(query),
      )
    ) {
      details(selected);
      return;
    }
    search(query);
  });
  $("#aiFab").addEventListener("click", () => {
    openDialog($("#chatDialog"));
    $("#chatInput").focus();
  });
  function configure() {
    $("#aiFab").hidden = !state.config.assistant.enabled;
    $("#chatTitle").textContent = $("#aiName").textContent =
      state.config.assistant.displayName || "Guia de compras";
    $(".chat-note").textContent =
      "Respostas baseadas nas informações cadastradas pela loja.";
    $(".fab-caption").textContent = "Encontre seu produto";
    $("#chatInput").placeholder =
      "Digite o nome ou uma dúvida sobre o produto…";
    $("#chatSuggestions").replaceChildren(
      element("button", {
        text: "Voltar",
        onclick: () => {
          path.pop();
          browse();
        },
      }),
      element("button", {
        text: "Começar de novo",
        onclick: () => {
          path = [];
          messages.replaceChildren();
          browse();
        },
      }),
    );
    if (!messages.children.length) {
      browse();
    }
  }
  return { configure };
}
