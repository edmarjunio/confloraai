<<<<<<< HEAD
import { createChat as createAiChat } from "./ai-chat.js";
import { createGuidedChat } from "./guided-chat.js";
export function createChat(state, catalog) {
  return state.config.assistant.mode === "GUIDED"
    ? createGuidedChat(state, catalog)
    : createAiChat(state, catalog);
=======
import { $, element, notify, openDialog, money } from "./ui.js";
import {
  normalize,
  searchProducts,
  buildNavigationTree,
  findCategoryNode,
  isFuzzyMatch,
} from "./guided-search.js";

export function createChat(state, catalog) {
  let busy = false;
  const history = [];
  const messages = $("#chatMessages");
  const form = $("#chatForm");
  let navigationTree = null;
  let currentGuidedPath = [];

  function getTree() {
    if (!navigationTree) {
      navigationTree = buildNavigationTree(
        state.products,
        state.config?.navigation || {},
      );
    }
    return navigationTree;
  }

  function bubble(text, role) {
    const node = element("p", { class: `bubble ${role}`, text });
    messages.append(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  function showPills(items, onSelect) {
    const container = element("div", { class: "suggestions" }, [
      ...items.map((item) => {
        const label = typeof item === "string" ? item : item.label;
        const val = typeof item === "string" ? item : item.value;
        return element("button", {
          type: "button",
          text: label,
          onclick: () => {
            container.querySelectorAll("button").forEach((btn) => {
              btn.disabled = true;
            });
            onSelect(val, label);
          },
        });
      }),
    ]);
    messages.append(container);
    messages.scrollTop = messages.scrollHeight;
    return container;
  }

  function getRootCategoryList() {
    const tree = getTree();
    const categoriesFromTree = Array.from(tree.children.keys());
    const preferredOrder = ["Plantas", "Pets", "Hortifrutti", "Insumos & Jardinagem"];
    const ordered = [];

    for (const pref of preferredOrder) {
      const match = categoriesFromTree.find((c) =>
        normalize(c).includes(normalize(pref)) || normalize(pref).includes(normalize(c)),
      );
      if (match && !ordered.includes(match)) {
        ordered.push(match);
      }
    }

    for (const c of categoriesFromTree) {
      if (!ordered.includes(c)) {
        ordered.push(c);
      }
    }

    return ordered.length ? ordered : ["Plantas", "Pets", "Hortifrutti"];
  }

  function startGuidedFlow() {
    currentGuidedPath = [];
    bubble("Olá! Do que você precisa hoje?", "assistant");
    const roots = getRootCategoryList();
    showPills(roots, (cat) => {
      handleCategorySelection(cat);
    });
  }

  function handleCategorySelection(categoryName) {
    bubble(categoryName, "user");
    currentGuidedPath = [categoryName];

    const tree = getTree();
    const node = findCategoryNode(tree, [categoryName]);

    if (!node || node.children.size === 0) {
      const prods = (node?.products || []).filter((p) => p.isAvailable);
      renderProductResults(prods, categoryName);
      return;
    }

    const subcats = Array.from(node.children.keys());
    bubble(`Excelente! Em ${categoryName}, qual categoria você procura?`, "assistant");

    const pillItems = subcats.map((s) => ({ label: s, value: s }));
    pillItems.push({ label: `Ver todos de ${categoryName}`, value: "__ALL__" });
    pillItems.push({ label: "↩ Voltar", value: "__BACK__" });

    showPills(pillItems, (selectedSub) => {
      if (selectedSub === "__BACK__") {
        startGuidedFlow();
      } else if (selectedSub === "__ALL__") {
        bubble(`Ver todos de ${categoryName}`, "user");
        const allProds = node.products.filter((p) => p.isAvailable);
        renderProductResults(allProds, categoryName);
      } else {
        handleSubcategorySelection(categoryName, selectedSub);
      }
    });
  }

  function handleSubcategorySelection(categoryName, subcategoryName) {
    bubble(subcategoryName, "user");
    currentGuidedPath = [categoryName, subcategoryName];

    const tree = getTree();
    const node = findCategoryNode(tree, [categoryName, subcategoryName]);

    if (!node) {
      const prods = searchProducts(state.products, `${categoryName} ${subcategoryName}`, {
        synonyms: state.config?.assistant?.synonyms,
      });
      renderProductResults(prods, `${categoryName} > ${subcategoryName}`);
      return;
    }

    if (node.children.size > 0) {
      const deeperGroups = Array.from(node.children.keys());
      bubble(`Ótimo! Em ${subcategoryName}, escolha uma opção:`, "assistant");

      const pillItems = deeperGroups.map((g) => ({ label: g, value: g }));
      pillItems.push({ label: `Ver todos em ${subcategoryName}`, value: "__ALL__" });
      pillItems.push({ label: "↩ Voltar", value: "__BACK__" });

      showPills(pillItems, (selectedDeep) => {
        if (selectedDeep === "__BACK__") {
          handleCategorySelection(categoryName);
        } else if (selectedDeep === "__ALL__") {
          bubble(`Ver todos em ${subcategoryName}`, "user");
          const prods = node.products.filter((p) => p.isAvailable);
          renderProductResults(prods, `${categoryName} > ${subcategoryName}`);
        } else {
          handleDeepGroupSelection(categoryName, subcategoryName, selectedDeep);
        }
      });
      return;
    }

    const prods = node.products.filter((p) => p.isAvailable);
    renderProductResults(prods, `${categoryName} > ${subcategoryName}`);
  }

  function handleDeepGroupSelection(categoryName, subcategoryName, groupName) {
    bubble(groupName, "user");
    currentGuidedPath = [categoryName, subcategoryName, groupName];

    const tree = getTree();
    const node = findCategoryNode(tree, [categoryName, subcategoryName, groupName]);
    const prods = node
      ? node.products.filter((p) => p.isAvailable)
      : searchProducts(state.products, `${categoryName} ${subcategoryName} ${groupName}`, {
          synonyms: state.config?.assistant?.synonyms,
        });

    renderProductResults(prods, `${categoryName} > ${subcategoryName} > ${groupName}`);
  }

  function renderProductResults(products, contextLabel) {
    if (!products || products.length === 0) {
      bubble(`No momento não encontrei itens disponíveis em ${contextLabel}.`, "assistant");
      showPills(["Buscar outro produto", "Começar de novo"], (choice) => {
        if (choice === "Começar de novo") {
          startGuidedFlow();
        } else {
          $("#chatInput").focus();
        }
      });
      return;
    }

    bubble(`Encontrei estes produtos em ${contextLabel}:`, "assistant");

    const displayProducts = products.slice(0, 6);
    for (const product of displayProducts) {
      if (!state.products.some((p) => p.id === product.id)) {
        state.products.push(product);
      }
      messages.append(catalog.card(product, true));
    }

    bubble("Você pode adicionar à sacola acima ou me fazer uma pergunta sobre algum produto específico!", "assistant");

    const actionPills = [
      { label: "🛒 Ver todos no catálogo", value: "VIEW_CATALOG" },
      { label: "🔍 Buscar outro produto", value: "SEARCH_ANOTHER" },
      { label: "🔄 Começar de novo", value: "RESTART" },
    ];

    showPills(actionPills, (action) => {
      if (action === "VIEW_CATALOG") {
        const searchInput = $("#search");
        if (searchInput) {
          const mainTerm = currentGuidedPath[currentGuidedPath.length - 1] || contextLabel;
          searchInput.value = mainTerm;
          searchInput.dispatchEvent(new window.Event("input"));
        }
        $("#chatDialog")?.close();
      } else if (action === "RESTART") {
        startGuidedFlow();
      } else {
        bubble("Digite o nome do produto ou sua dúvida na barra abaixo!", "assistant");
        $("#chatInput").focus();
      }
    });

    messages.scrollTop = messages.scrollHeight;
  }

  function handleGuidedUserText(message) {
    const rawNormalized = normalize(message);
    const tree = getTree();
    const synonyms = state.config?.assistant?.synonyms || {};

    // 1. Check if user typed a category or subcategory name (with typos & synonyms)
    for (const [catName, catNode] of tree.children.entries()) {
      if (isFuzzyMatch(rawNormalized, catName) || (synonyms[normalize(catName)] || []).some((s) => isFuzzyMatch(rawNormalized, s))) {
        handleCategorySelection(catName);
        return;
      }
      for (const [subName, subNode] of catNode.children.entries()) {
        if (isFuzzyMatch(rawNormalized, subName) || (synonyms[normalize(subName)] || []).some((s) => isFuzzyMatch(rawNormalized, s))) {
          handleSubcategorySelection(catName, subName);
          return;
        }
        for (const [deepName] of subNode.children.entries()) {
          if (isFuzzyMatch(rawNormalized, deepName) || (synonyms[normalize(deepName)] || []).some((s) => isFuzzyMatch(rawNormalized, s))) {
            handleDeepGroupSelection(catName, subName, deepName);
            return;
          }
        }
      }
    }

    // 2. Check if user asked about delivery / general service
    if (/(entrega|frete|entregam|retirada|onde fica|localizacao|endereco)/i.test(message)) {
      bubble(
        "Fazemos entregas em Mineiros - GO e você também pode optar por retirada no nosso viveiro! Adicione seus produtos à sacola para conferir e concluir seu pedido com facilidade.",
        "assistant",
      );
      showPills(["Ver produtos", "Começar de novo"], (action) => {
        if (action === "Começar de novo") {
          startGuidedFlow();
        } else {
          $("#chatInput").focus();
        }
      });
      return;
    }

    // 3. Search products by typo-tolerant query & synonyms
    const searchScope = currentGuidedPath.length
      ? findCategoryNode(tree, currentGuidedPath)?.products || state.products
      : state.products;

    let matched = searchProducts(searchScope, message, { synonyms, limit: 10 });
    if (!matched.length && searchScope !== state.products) {
      matched = searchProducts(state.products, message, { synonyms, limit: 10 });
    }

    if (matched.length > 0) {
      const isPriceQuestion = /(quanto custa|valor|preco|preço|custa)/i.test(message);
      const first = matched[0];

      if (isPriceQuestion) {
        bubble(
          `O produto ${first.name} sai por ${money(first.price.amountMinor)}${first.saleUnit.code === "UN" ? "" : " / " + first.saleUnit.label}. Veja as opções disponíveis:`,
          "assistant",
        );
      } else {
        bubble("Encontrei estas opções para o que você procura:", "assistant");
      }

      for (const prod of matched.slice(0, 5)) {
        if (!state.products.some((p) => p.id === prod.id)) {
          state.products.push(prod);
        }
        messages.append(catalog.card(prod, true));
      }

      showPills([
        { label: "🛒 Ver no catálogo", value: "VIEW" },
        { label: "🔄 Começar de novo", value: "RESTART" },
      ], (act) => {
        if (act === "VIEW") {
          const searchInput = $("#search");
          if (searchInput) {
            searchInput.value = message;
            searchInput.dispatchEvent(new window.Event("input"));
          }
          $("#chatDialog")?.close();
        } else {
          startGuidedFlow();
        }
      });
    } else {
      bubble(
        `Não encontrei produtos para "${message}". Pode ter havido um pequeno erro de digitação ou o produto pode estar com outro nome. Vamos navegar pelas categorias?`,
        "assistant",
      );
      const roots = getRootCategoryList();
      showPills(roots, (cat) => {
        handleCategorySelection(cat);
      });
    }
  }

  function configure() {
    const config = state.config.assistant;
    const isAiMode = config.mode === "AI";

    $("#aiFab").hidden = !config.enabled;
    $("#aiName").textContent = $("#chatTitle").textContent = config.displayName;

    const fabCaption = document.querySelector(".fab-caption");
    if (fabCaption) {
      fabCaption.textContent = isAiMode ? "Converse com a IA" : (config.displayName || "Guia de compras");
    }

    if (!messages.children.length) {
      if (isAiMode) {
        bubble(config.welcomeMessage, "assistant");
        $("#chatSuggestions").replaceChildren(
          ...(config.suggestedQuestions || []).map((text) =>
            element("button", {
              text,
              onclick: () => {
                $("#chatInput").value = text;
                form.requestSubmit();
              },
            }),
          ),
        );
      } else {
        $("#chatSuggestions").replaceChildren();
        startGuidedFlow();
      }
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $("#chatInput").value.trim();
    if (!message || busy) {
      return;
    }

    $("#chatInput").value = "";
    bubble(message, "user");

    const isAiMode = state.config?.assistant?.mode === "AI";

    if (!isAiMode) {
      handleGuidedUserText(message);
      return;
    }

    // AI Mode execution (kept ready for future toggle)
    busy = true;
    form.querySelector("button").disabled = true;
    const pending = bubble(
      "Consultando as informações e o catálogo…",
      "assistant",
    );

    try {
      const response = await state.api("/assistant", {
        method: "POST",
        body: { message, history: history.slice(-6) },
      });
      pending.remove();
      bubble(response.message, "assistant");

      for (const product of response.products) {
        if (!state.products.some((p) => p.id === product.id)) {
          state.products.push(product);
        }
        messages.append(catalog.card(product, true));
      }

      if (response.mode === "CATALOG_SEARCH") {
        messages.append(
          element("small", {
            text: "Busca no catálogo · IA indisponível",
            class: "muted",
          }),
        );
      }

      for (const source of response.sources) {
        messages.append(
          element("a", {
            text: source.title,
            href: source.url,
            target: "_blank",
            rel: "noopener noreferrer",
            class: "source",
          }),
        );
      }

      if (response.searchSuggestions) {
        const frame = element("iframe", {
          title: "Sugestões de pesquisa do Google",
          class: "search-suggestions",
          sandbox: "allow-popups allow-popups-to-escape-sandbox",
          referrerpolicy: "no-referrer",
        });
        frame.srcdoc =
          "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src https: data:\">" +
          response.searchSuggestions;
        messages.append(frame);
      }

      if (
        response.needsConfirmation !== false &&
        response.products.length > 0
      ) {
        messages.append(
          element("p", {
            class: "bubble assistant",
            text: "É isso que você procura?",
          }),
          element("div", { class: "suggestions" }, [
            element("button", {
              text: "Sim, é isso",
              onclick: (e) => {
                e.target.disabled = true;
                bubble(
                  "Ótimo! Você pode adicionar o produto à sacola aqui mesmo.",
                  "assistant",
                );
              },
            }),
            element("button", {
              text: "Não, quero outra opção",
              onclick: () => {
                bubble(
                  "Me conte mais sobre o uso, o ambiente ou as características que você precisa.",
                  "assistant",
                );
                $("#chatInput").focus();
              },
            }),
          ]),
        );
      }

      history.push(
        { role: "user", text: message },
        { role: "assistant", text: response.message.slice(0, 1000) },
      );
      messages.scrollTop = messages.scrollHeight;
    } catch (error) {
      pending.textContent = error.message;
      $("#chatInput").value = message;
      notify("Você pode tentar enviar novamente.");
    } finally {
      busy = false;
      form.querySelector("button").disabled = false;
    }
  });

  $("#aiFab").addEventListener("click", () => {
    openDialog($("#chatDialog"));
    $("#chatInput").focus();
  });

  return { configure };
>>>>>>> 817c5b27f153d388a4f8d6ac776cfd9b5ca97325
}
