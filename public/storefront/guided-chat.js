import { $, element, openDialog, money } from "./ui.js";
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
  function results(products) {
    selected = null;
    say(
      `${products.length} produto(s) encontrado(s). Toque em “Sobre este produto” para consultar os detalhes ou digite um nome para filtrar.`,
    );
    const list = element("div", { class: "guided-results" });
    let offset = 0;
    const more = element("button", { class: "guided-more" });
    function page() {
      for (const product of products.slice(offset, offset + 6)) {
        list.append(
          catalog.card(product, true),
          element("button", {
            class: "guided-detail",
            text: "Sobre este produto",
            "aria-label": `Sobre ${product.name}`,
            onclick: () => details(product),
          }),
        );
      }
      offset += 6;
      more.hidden = offset >= products.length;
      more.textContent = `Mostrar mais (${Math.max(0, products.length - offset)})`;
    }
    more.addEventListener("click", page);
    messages.append(list, more);
    page();
    buttons([
      [
        "Não, quero outra opção",
        () => {
          selected = null;
          say(
            "Me conte mais: digite outro nome ou use Voltar para escolher uma categoria.",
          );
          $("#chatInput").focus();
        },
      ],
    ]);
  }
  function browse() {
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
