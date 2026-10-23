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
          text: heading || (path.length ? path.join(" · ") : 'products_found'.tr),
        }),
        count,
      ]),
      element("button", {
        type: "button",
        class: "guided-clear-filters",
        "aria-label": "Limpar filtros e escolher outra categoria",
        title: 'clear_filters'.tr,
        onclick: () => {
          path = [];
          messages.replaceChildren();
          clearResults();
          browse();
        },
      }, [icon("x")]),
    ]);
    const grid = element("div", { class: "guided-results-grid chat-product-grid" });
    const empty = element("p", {
      class: "guided-results-empty",
      text: 'no_products_found_in_this_selection'.tr,
      hidden: "",
    });
    const more = element("button", {
      type: "button",
      class: "guided-more",
      hidden: "",
    });
    const panel = element("section", { class: "guided-results" }, [
      toolbar,
      element('p', { class: 'muted', text: 'type_a_name_in_the_chat_to_search_across_all_store_products'.tr }),
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
      visibleCount = Math.min(typeof window !== "undefined" && window.innerWidth >= 768 ? 12 : 9, matchingProducts.length);
      grid.replaceChildren(
        ...matchingProducts.slice(0, visibleCount).map((product) => catalog.card(product, { chat: true })),
      );
      count.textContent = `${matchingProducts.length} ${matchingProducts.length === 1 ? 'catalog_product_singular'.tr : 'catalog_products'.tr}`;
      empty.hidden = matchingProducts.length > 0;
      more.hidden = matchingProducts.length <= visibleCount;
      more.textContent = `${'show_more_products'.tr}${matchingProducts.length - visibleCount})`;
    };
    more.addEventListener("click", () => {
      const previousCount = visibleCount;
      const step = typeof window !== "undefined" && window.innerWidth >= 768 ? 12 : 9;
      visibleCount = Math.min(visibleCount + step, matchingProducts.length);
      grid.append(
        ...matchingProducts.slice(previousCount, visibleCount).map((product) => catalog.card(product, { chat: true })),
      );
      more.hidden = matchingProducts.length <= visibleCount;
      more.textContent = `${'show_more_products'.tr}${matchingProducts.length - visibleCount})`;
    });
    renderProducts();
    panel.scrollIntoView({ block: 'start' });
  }
  messages.addEventListener('chat-product-added', (event) => {
    const prevScrollTop = messages.scrollTop;
    messages.querySelector('.chat-next-search')?.remove();
    const actions = element('div', { class: 'suggestions chat-next-search' }, [
      element('p', { text: `${event.detail.product.name} ${'added_do_you_want_to_search_for_another_product_or_keep_this_selection'.tr}` }),
      element('button', { text: 'clear_and_search_another'.tr, onclick: () => {
        path = []; messages.replaceChildren(); clearResults(); browse();
      } }),
      element('button', { text: 'keep_current_filter'.tr, onclick: () => { actions.remove(); } }),
    ]);
    messages.append(actions);
    // Mantém a tela 100% estática ao adicionar produto
    messages.scrollTop = prevScrollTop;
  });
  function browse() {
    clearResults();
    const currentPath = [...path];
    const choices = nextChoices(state.products, state.config.categories, currentPath);
    say(
      currentPath.length
        ? `${currentPath.join(" → ")}. Qual opção você procura?`
        : 'what_do_you_need'.tr,
    );
    if (choices.length) {
      const container = element(
        "div",
        { class: "suggestions guided-choices" },
        choices.map((choice) =>
          element("button", {
            text: choice.name,
            onclick: () => {
              while (container.nextSibling) {
                container.nextSibling.remove();
              }
              path = [...currentPath, choice.name];
              say(choice.name, "user");
              browse();
            },
          }),
        ),
      );
      messages.append(container);
      if (currentPath.length) {
        messages.append(
          element("div", { class: "suggestions guided-choices" }, [
            element("button", {
              text: 'view_all_in_this_category'.tr,
              onclick: () => results(pool()),
            }),
          ]),
        );
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
        'we_can_order_it_talk_to_conflora_via_whatsapp_to_register'.tr,
      );
      clearResults();
      const fallbackChoices = element("div", { class: "suggestions guided-choices" }, [
        element("button", { text: 'choose_category'.tr, onclick: () => { path = []; browse(); } }),
        element("button", { text: 'view_all_products'.tr, onclick: () => results(source, 'all_products'.tr) }),
      ]);
      messages.append(fallbackChoices);
      return;
    }
    if (matches.some((match) => match.approximate)) {
      say('i_found_similar_names_check_which_one_you_are_looking_for'.tr);
    }
    results(matches.map((match) => match.product), `${'results_for'.tr}${query}”`);
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
  $('#chatInput').maxLength = 800;
  $('#chatInput').addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); $('#chatInput').value = '';
    } else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault(); $('#chatForm').requestSubmit();
    }
  });
  $("#aiFab").addEventListener("click", () => {
    openDialog($("#chatDialog"));
  });
  function configure() {
    $("#aiFab").hidden = !state.config.assistant.enabled;
    $("#chatTitle").textContent = $("#aiName").textContent =
      'shopping_assistant'.tr;
    $(".chat-note").textContent =
      'answers_based_on_information_registered_by_the_store'.tr;
    $(".fab-caption").textContent = 'find_your_product'.tr;
    $("#chatInput").placeholder =
      'type_the_name_or_a_question_about_the_product'.tr;
    $("#chatSuggestions").replaceChildren(
      element("button", {
        text: "↻",
        class: "chat-action-restart cf-btn-3d cf-btn-3d--sm",
        "aria-label": 'start_over'.tr,
        title: 'start_over'.tr,
        onclick: () => {
          path = [];
          clearResults();
          messages.replaceChildren();
          browse();
        },
      }),
      element("button", {
        text: "🗑",
        class: "chat-action-clear cf-btn-3d cf-btn-3d--sm",
        "aria-label": "Limpar conversa",
        title: 'clear_chat'.tr,
        onclick: () => {
          path = [];
          clearResults();
          messages.replaceChildren();
          $("#chatInput").value = "";
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
