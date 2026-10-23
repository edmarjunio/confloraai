import { $, element, notify, openDialog } from "./ui.js";
import { onLanguageChange } from "./i18n/index.js";

export function createChat(state, catalog) {
  let busy = false;
  const history = [];
  const messages = $("#chatMessages");
  const form = $("#chatForm");

  onLanguageChange(() => {
    configure();
  });

  function bubble(text, role) {
    const node = element("p", { class: `bubble ${role}`, text });
    messages.append(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  function configure() {
    if (!state.config?.assistant) {
      return;
    }
    const config = state.config.assistant;
    let controls = document.querySelector('.chat-ai-controls');
    if (!controls) {
      const reset = () => { if (busy) return; messages.replaceChildren(); history.length = 0; bubble('what_product_are_you_looking_for'.tr, 'assistant'); };
      controls = element('div', { class: 'suggestions chat-ai-controls' }, [
        element('button', {
          type: 'button',
          class: 'chat-action-restart cf-btn-3d cf-btn-3d--sm',
          text: '↻',
          'aria-label': 'start_over'.tr,
          title: 'start_over'.tr,
          onclick: reset,
        }),
        element('button', {
          type: 'button',
          class: 'chat-action-clear cf-btn-3d cf-btn-3d--sm',
          text: '🗑',
          'aria-label': 'Limpar conversa',
          title: 'clear_chat'.tr,
          onclick: reset,
        }),
      ]);
      form.before(controls);
    }
    $("#aiFab").hidden = !config.enabled;
    $("#aiName").textContent = $("#chatTitle").textContent = config.displayName || 'assistant_drawer_title'.tr;
    if (!messages.children.length) {
      bubble(config.welcomeMessage || 'assistant_welcome_message'.tr, "assistant");
    }
    const defaultSuggestions = [
      'assistant_chip_shade'.tr,
      'assistant_chip_fruit'.tr,
      'assistant_chip_pet'.tr,
      'assistant_chip_herbs'.tr,
      'assistant_chip_fertilizer'.tr,
      'assistant_chip_sun'.tr,
    ];
    const questions = (config.suggestedQuestions && config.suggestedQuestions.length)
      ? config.suggestedQuestions
      : defaultSuggestions;

    $("#chatSuggestions").replaceChildren(
      ...questions.map((text) =>
        element("button", {
          text,
          onclick: () => {
            $("#chatInput").value = text;
            form.requestSubmit();
          },
        }),
      ),
    );
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $("#chatInput").value.trim();
    if (!message || busy) {
      return;
    }
    busy = true;
    form.querySelector("button").disabled = true;
    $("#chatInput").value = "";
    bubble(message, "user");
    const pending = bubble(
      'common_loading'.tr,
      "assistant",
    );
    try {
      const response = await state.api("/assistant", {
        method: "POST",
        body: { message, history: history.slice(-6) },
      });
      pending.remove();
      bubble(response.message, "assistant");
      const products = response.products || [];
      if (products.length) {
        const grid = element("div", { class: "guided-results-grid chat-product-grid" });
        const limit = typeof window !== "undefined" && window.innerWidth >= 768 ? 12 : 9;
        for (const product of products.slice(0, limit)) {
          if (!state.products.some((p) => p.id === product.id)) {
            state.products.push(product);
          }
          grid.append(catalog.card(product, { chat: true }));
        }
        messages.append(grid);
      }
      if (response.products?.length) bubble('type_the_specific_product_you_are_looking_for_in_the_field_below_to_refine_your_searc'.tr, 'assistant');
      for (const source of response.sources || []) {
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
      history.push(
        { role: "user", text: message },
        { role: "assistant", text: response.message.slice(0, 1000) },
      );
      messages.scrollTop = messages.scrollHeight;
    } catch {
      pending.remove();
      const publicMessage = 'the_service_is_temporarily_unavailable_please_try_again_shortly'.tr;
      bubble(publicMessage, 'assistant');
      if (!$('#chatInput').value) $('#chatInput').value = message;
      notify(publicMessage);
    } finally {
      busy = false;
      form.querySelector("button").disabled = false;
    }
  });

  $('#chatInput').maxLength = 500;
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

  return { configure };
}
