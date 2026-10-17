import { $, element, openDialog } from "./ui.js";
import { icon } from "./icons.js";
import {
  scopedProducts,
  nextChoices,
  searchProducts,
} from "./guided-search.mjs";

export function createGuidedChat(state, catalog) {
  const messages = $("#chatMessages");
  let path = [];
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
  function clearResults() {
    activeResults?.remove();
    activeResults = null;
    $("#chatDialog").classList.remove("has-product-results");
  }
  function results(products, heading) {
    clearResults();
    $("#chatDialog").classList.add("has-product-results");

    const count = element("span", { class: "guided-results-count" });
    const toolbar = element("div", { class: "guided-results-toolbar" }, [
      element("div", { class: "guided-results-heading" }, [
        element("strong", {
          class: "guided-results-title",
          text: heading || (path.length ? path.join(" · ") : "Produtos encontrados"),
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
          messages.replaceChildren();
          clearResults();
          browse();
        },
      }, [icon("x")]),
    ]);
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
      element('p', { class: 'muted', text: 'Digite um nome no chat para buscar em todos os produtos da loja.' }),
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
      matchingProducts = availableProducts;
      visibleCount = Math.min(24, matchingProducts.length);
      grid.replaceChildren(
        ...matchingProducts.slice(0, visibleCount).map((product) => catalog.card(product, { chat: true })),
      );
      count.textContent = `${matchingProducts.length} ${matchingProducts.length === 1 ? "produto" : "produtos"}`;
      empty.hidden = matchingProducts.length > 0;
      more.hidden = matchingProducts.length <= visibleCount;
      more.textContent = `Mostrar mais produtos (${matchingProducts.length - visibleCount})`;
    };
    more.addEventListener("click", () => {
      const previousCount = visibleCount;
      visibleCount = Math.min(visibleCount + 24, matchingProducts.length);
      grid.append(
        ...matchingProducts.slice(previousCount, visibleCount).map((product) => catalog.card(product, { chat: true })),
      );
      more.hidden = matchingProducts.length <= visibleCount;
      more.textContent = `Mostrar mais produtos (${matchingProducts.length - visibleCount})`;
    });
    renderProducts();
    panel.scrollIntoView({ block: 'start' });
  }
  messages.addEventListener('chat-product-added', (event) => {
    messages.querySelector('.chat-next-search')?.remove();
    const actions = element('div', { class: 'suggestions chat-next-search' }, [
      element('p', { text: `${event.detail.product.name} adicionado. Quer pesquisar outro produto ou manter esta seleção?` }),
      element('button', { text: 'Limpar e pesquisar outro', onclick: () => {
        path = []; messages.replaceChildren(); clearResults(); browse(); $('#chatInput').focus();
      } }),
      element('button', { text: 'Manter filtro atual', onclick: () => { actions.remove(); $('#chatInput').focus(); } }),
    ]);
    messages.append(actions);
    messages.scrollTop = messages.scrollHeight;
  });
  function browse() {
    clearResults();
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
  function search(query) {
    path = [];
    const source = scopedProducts(state.products, state.config.categories, []);
    const matches = searchProducts(
      source,
      query,
      state.config.assistant.synonyms || [],
    );
    if (!matches.length) {
      say(
        "Não encontrei esse nome na loja. Tente uma palavra mais curta ou um nome alternativo.",
      );
      clearResults();
      return;
    }
    if (matches.some((match) => match.approximate)) {
      say("Encontrei nomes parecidos. Confira qual deles você procura:");
    }
    results(matches.map((match) => match.product), `Resultados para “${query}”`);
  }
  $("#chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = $("#chatInput").value.trim();
    if (!query) {
      return;
    }
    $("#chatInput").value = "";
    say(query, "user");
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
