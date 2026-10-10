import { $, element, notify, openDialog } from "./ui.js";
export function createChat(state, catalog) {
  let busy = false;
  const history = [];
  const messages = $("#chatMessages");
  const form = $("#chatForm");
  function bubble(text, role) {
    const node = element("p", { class: `bubble ${role}`, text });
    messages.append(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }
  function configure() {
    const config = state.config.assistant;
    $("#aiFab").hidden = !config.enabled;
    $("#aiName").textContent = $("#chatTitle").textContent = config.displayName;
    if (!messages.children.length) {
      bubble(config.welcomeMessage, "assistant");
    }
    $("#chatSuggestions").replaceChildren(
      ...config.suggestedQuestions.map((text) =>
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
              onclick: (event) => {
                event.target.disabled = true;
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
}
