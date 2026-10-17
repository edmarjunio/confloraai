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
      const reset = () => { if (busy) return; messages.replaceChildren(); history.length = 0; bubble('Qual produto você procura?', 'assistant'); $('#chatInput').focus(); };
      controls = element('div', { class: 'suggestions chat-ai-controls' }, [
        element('button', { type: 'button', class: 'chat-action-back', text: '← Voltar', onclick: () => { if (busy) return; history.splice(-2); const lastUser = [...messages.querySelectorAll('.bubble.user')].pop(); if (lastUser) { while (lastUser.nextSibling) lastUser.nextSibling.remove(); lastUser.remove(); } $('#chatInput').focus(); } }),
        element('button', { type: 'button', class: 'chat-action-restart', text: '↻ Começar de novo', onclick: reset }),
        element('button', { type: 'button', class: 'chat-action-clear', text: 'Limpar conversa', onclick: reset }),
      ]);
      form.before(controls);
    }
    $("#aiFab").hidden = !config.enabled;
    $("#aiName").textContent = $("#chatTitle").textContent = config.displayName || "assistant.drawer_title".tr;
    if (!messages.children.length) {
      bubble(config.welcomeMessage || "assistant.welcome_message".tr, "assistant");
    }
    const defaultSuggestions = [
      "assistant.chip_shade".tr,
      "assistant.chip_fruit".tr,
      "assistant.chip_pet".tr,
      "assistant.chip_herbs".tr,
      "assistant.chip_fertilizer".tr,
      "assistant.chip_sun".tr,
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
      "common.loading".tr,
      "assistant",
    );
    try {
      const response = await state.api("/assistant", {
        method: "POST",
        body: { message, history: history.slice(-6) },
      });
      pending.remove();
      bubble(response.message, "assistant");
      for (const product of response.products || []) {
        if (!state.products.some((p) => p.id === product.id)) {
          state.products.push(product);
        }
        messages.append(catalog.card(product, { chat: true }));
      }
      if (response.products?.length) bubble('Digite no campo abaixo o produto específico que procura para refinar a busca.', 'assistant');
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
    } catch (error) {
      pending.textContent = error.message;
      $("#chatInput").value = message;
      notify("common.retry".tr);
    } finally {
      busy = false;
      form.querySelector("button").disabled = false;
    }
  });

  messages.addEventListener('chat-product-added', (event) => {
    messages.querySelector('.chat-next-search')?.remove();
    const actions = element('div', { class: 'suggestions chat-next-search' }, [
      element('p', { text: `${event.detail.product.name} adicionado. Deseja pesquisar outro ou manter os produtos atuais?` }),
      element('button', { text: 'Limpar e pesquisar outro', onclick: () => { messages.replaceChildren(); history.length = 0; bubble('Qual produto você procura agora?', 'assistant'); $('#chatInput').focus(); } }),
      element('button', { text: 'Manter filtro atual', onclick: () => { actions.remove(); $('#chatInput').focus(); } }),
    ]);
    messages.append(actions);
    messages.scrollTop = messages.scrollHeight;
  });

  $("#aiFab").addEventListener("click", () => {
    openDialog($("#chatDialog"));
    $("#chatInput").focus();
  });

  return { configure };
}
