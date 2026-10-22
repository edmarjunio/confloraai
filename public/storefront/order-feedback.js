import { element, openDialog, notify } from "./ui.js";

const RATING_LABELS = {
  1: "Precisa melhorar",
  2: "Regular",
  3: "Bom",
  4: "Muito bom",
  5: "Excelente",
};

const FEEDBACK_TYPES = [
  { id: "ELOGIO", label: "🌸 Elogio" },
  { id: "SUGESTAO", label: "💡 Sugestão" },
  { id: "RECLAMACAO", label: "⚠️ Reclamação" },
  { id: "DUVIDA", label: "💬 Outro" },
];

const FEEDBACK_HIGHLIGHTS = [
  "Produtos impecáveis e bem protegidos",
  "Entrega pontual",
  "Cuidado no transporte",
  "Atendimento atencioso",
  "Plantas saudáveis e viçosas",
  "Fácil de comprar no site",
];

export function isOrderDelivered(order) {
  if (!order || order.status === "CANCELLED") return false;
  return order.deliveryStatus === "DELIVERED" || order.status === "DELIVERED" || (order.orderType !== "DELIVERY" && order.fulfillment !== "delivery" && Boolean(order.completedAt));
}

export function createOrderFeedback(state) {
  let triggerNode = null;
  let dialogNode = null;

  function ensureDialog() {
    if (dialogNode && document.body.contains(dialogNode)) return dialogNode;
    dialogNode = document.getElementById("orderFeedbackDialog");
    if (!dialogNode) {
      dialogNode = element("dialog", {
        id: "orderFeedbackDialog",
        class: "order-feedback-dialog",
        "aria-labelledby": "orderFeedbackTitle",
      });
      document.body.append(dialogNode);
    }
    return dialogNode;
  }

  function renderStarSelector({ label, subtitle, initialValue = 5, onChange }) {
    let current = Math.max(1, Math.min(5, Number(initialValue) || 5));
    const statusText = element("span", {
      class: "cf-feedback-rating-caption",
      text: `${current}/5 · ${(RATING_LABELS[current] || "").tr}`,
    });
    const buttons = [];
    const updateStars = (nextValue) => {
      current = nextValue;
      statusText.textContent = `${current}/5 · ${(RATING_LABELS[current] || "").tr}`;
      buttons.forEach((btn, idx) => {
        const starIndex = idx + 1;
        const active = starIndex <= current;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(starIndex === current));
        btn.textContent = active ? "★" : "☆";
      });
      onChange(current);
    };

    for (let i = 1; i <= 5; i += 1) {
      const btn = element("button", {
        type: "button",
        class: `cf-feedback-star-btn ${i <= current ? "active" : ""}`,
        "aria-label": `${label}: ${i} ${i === 1 ? "estrela".tr : "estrelas".tr} (${(RATING_LABELS[i] || "").tr})`,
        "aria-pressed": String(i === current),
        text: i <= current ? "★" : "☆",
        onclick: () => updateStars(i),
      });
      buttons.push(btn);
    }

    return element("div", { class: "cf-feedback-field" }, [
      element("div", { class: "cf-feedback-field-header" }, [
        element("strong", { text: label }),
        statusText,
      ]),
      subtitle ? element("p", { class: "muted cf-feedback-field-sub", text: subtitle }) : null,
      element("div", { class: "cf-feedback-stars", role: "group", "aria-label": label }, buttons),
    ]);
  }

  function openSiteFeedbackModal() {
    const dialog = ensureDialog();
    let rating = 5;
    let selectedType = "ELOGIO";
    const selectedHighlights = new Set();

    const errorBanner = element("p", {
      class: "cf-error-banner",
      role: "alert",
      hidden: true,
    });

    const nameInput = element("input", {
      type: "text",
      class: "cf-feedback-input",
      placeholder: "Seu nome (opcional)".tr,
      "aria-label": "Seu nome".tr,
    });
    nameInput.value = state.user?.name || "";

    const contactInput = element("input", {
      type: "text",
      class: "cf-feedback-input",
      placeholder: "WhatsApp ou e-mail de contato (opcional)".tr,
      "aria-label": "WhatsApp ou e-mail".tr,
    });
    contactInput.value = state.user?.phone || state.user?.email || "";

    const typeButtons = FEEDBACK_TYPES.map((t) => {
      const btn = element("button", {
        type: "button",
        class: `cf-feedback-type-btn ${t.id === selectedType ? "active" : ""}`,
        text: t.label.tr,
        onclick: () => {
          selectedType = t.id;
          typeContainer.querySelectorAll(".cf-feedback-type-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
        },
      });
      return btn;
    });
    const typeContainer = element("div", { class: "cf-feedback-types-row" }, typeButtons);

    const commentInput = element("textarea", {
      class: "cf-feedback-textarea",
      rows: "3",
      maxlength: "600",
      placeholder: "Conte sua experiência com o site, elogio, sugestão ou reclamação para o dono da Conflora...".tr,
      "aria-label": "Mensagem ou reclamação".tr,
    });

    const highlightButtons = FEEDBACK_HIGHLIGHTS.map((item) => {
      const isSelected = selectedHighlights.has(item);
      const btn = element("button", {
        type: "button",
        class: `cf-feedback-highlight-btn ${isSelected ? "active" : ""}`,
        "aria-pressed": String(isSelected),
        text: item.tr,
        onclick: () => {
          if (selectedHighlights.has(item)) {
            selectedHighlights.delete(item);
            btn.classList.remove("active");
            btn.setAttribute("aria-pressed", "false");
          } else {
            selectedHighlights.add(item);
            btn.classList.add("active");
            btn.setAttribute("aria-pressed", "true");
          }
        },
      });
      return btn;
    });

    const submitButton = element("button", {
      type: "submit",
      class: "primary cf-feedback-submit-btn",
      text: "Enviar avaliação".tr,
    });

    const cancelButton = element("button", {
      type: "button",
      class: "quiet",
      text: "Agora não".tr,
      onclick: () => dialog.close(),
    });

    const form = element("form", { class: "cf-feedback-form" }, [
      element("div", { class: "cf-feedback-field" }, [
        element("strong", { text: "Tipo de avaliação".tr }),
        typeContainer,
      ]),
      renderStarSelector({
        label: "Avaliação geral do site e atendimento".tr,
        subtitle: "Sua nota nos ajuda a melhorar cada vez mais a experiência na Conflora.".tr,
        initialValue: rating,
        onChange: (val) => {
          rating = val;
        },
      }),
      element("div", { class: "cf-feedback-field" }, [
        element("strong", { text: "Sua identificação (opcional)".tr }),
        nameInput,
        contactInput,
      ]),
      element("div", { class: "cf-feedback-field" }, [
        element("strong", { text: "O que mais se destacou? (opcional)".tr }),
        element("div", { class: "cf-feedback-highlights", role: "group", "aria-label": "Destaques".tr }, highlightButtons),
      ]),
      element("label", { class: "cf-feedback-field" }, [
        element("strong", { text: "Mensagem ou Reclamação".tr }),
        commentInput,
      ]),
      errorBanner,
      element("div", { class: "cf-feedback-actions" }, [cancelButton, submitButton]),
    ]);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBanner.hidden = true;
      submitButton.disabled = true;
      submitButton.textContent = "Enviando…".tr;

      try {
        const typeObj = FEEDBACK_TYPES.find((t) => t.id === selectedType);
        const response = await state.api("/site-feedback", {
          method: "POST",
          body: {
            name: nameInput.value.trim(),
            phone: contactInput.value.trim(),
            rating,
            type: typeObj ? typeObj.label : "Geral",
            highlights: [...selectedHighlights],
            comment: commentInput.value.trim(),
          },
        });

        dialog.close();
        notify("Obrigado! Sua avaliação foi enviada diretamente para o responsável pela Conflora.".tr);

        // Se houver link direto do WhatsApp do proprietário, abre no WhatsApp
        if (response?.ownerWhatsappUrl) {
          try {
            window.open(response.ownerWhatsappUrl, "_blank", "noopener,noreferrer");
          } catch {}
        }
      } catch (err) {
        errorBanner.textContent = err.message || "Não foi possível enviar sua avaliação.".tr;
        errorBanner.hidden = false;
        submitButton.disabled = false;
        submitButton.textContent = "Enviar avaliação".tr;
      }
    });

    dialog.replaceChildren(
      element("div", { class: "dialog-header cf-feedback-dialog-header" }, [
        element("div", {}, [
          element("span", { class: "product-info-eyebrow", text: "Conflora Horta e Viveiro".tr }),
          element("h2", { id: "orderFeedbackTitle", text: "Como foi sua experiência com a Conflora?".tr }),
          element("p", {
            class: "muted",
            text: "Sua avaliação chega diretamente ao WhatsApp do proprietário. Envie elogios, sugestões ou sua reclamação.".tr,
          }),
        ]),
        element("button", {
          type: "button",
          class: "product-info-close",
          "aria-label": "Fechar".tr,
          text: "×",
          onclick: () => dialog.close(),
        }),
      ]),
      form,
    );

    openDialog(dialog);
  }

  function ensureSiteFeedbackButton() {
    if (triggerNode && document.body.contains(triggerNode)) return;
    const existing = document.getElementById("siteFeedbackFab");
    if (existing) {
      triggerNode = existing;
      return;
    }
    triggerNode = element(
      "button",
      {
        id: "siteFeedbackFab",
        type: "button",
        class: "site-feedback-fab",
        "aria-label": "Avaliar o site".tr,
        title: "Avaliar o site".tr,
        onclick: () => openSiteFeedbackModal(),
      },
      [
        element("span", { class: "site-feedback-star", "aria-hidden": "true", text: "⭐" }),
        element("span", { class: "site-feedback-text", text: "Avaliar o site".tr }),
      ],
    );
    document.body.append(triggerNode);
  }

  // Auto-inicializa o botão discreto no canto inferior esquerdo sem disparar popups invasivos
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", ensureSiteFeedbackButton);
    } else {
      ensureSiteFeedbackButton();
    }
  }

  // Notificações automáticas que incomodavam o cliente são desativadas
  function hideFloatingPrompt() {
    const banner = document.getElementById("postPurchaseFeedbackPrompt");
    if (banner) banner.remove();
  }

  function checkPendingDeliveredOrder() {
    // Intencionalmente sem pop-ups invasivos automáticos para não encher o saco do cliente
    ensureSiteFeedbackButton();
  }

  function inspectLoadedOrders() {
    // Intencionalmente sem pop-ups invasivos automáticos
    ensureSiteFeedbackButton();
  }

  function renderOrderCardFeedback(order) {
    if (!isOrderDelivered(order)) return null;
    const container = element("section", {
      class: "cf-order-card-feedback",
      "aria-label": "Avaliação do site e atendimento".tr,
    });

    const paint = () => {
      container.replaceChildren();
      container.append(
        element("div", { class: "cf-order-feedback-prompt" }, [
          element("div", { class: "cf-order-feedback-prompt-copy" }, [
            element("strong", { text: "Como foi sua experiência com este pedido e atendimento?".tr }),
            element("p", {
              class: "muted",
              text: "Avalie o atendimento, envie elogios ou faça uma reclamação direta ao proprietário.".tr,
            }),
          ]),
          element("div", { class: "cf-order-feedback-prompt-controls" }, [
            element("button", {
              type: "button",
              class: "primary cf-feedback-open-btn",
              text: "Avaliar experiência".tr,
              onclick: () => openSiteFeedbackModal(),
            }),
          ]),
        ]),
      );
    };

    paint();
    return container;
  }

  const api = {
    open: openSiteFeedbackModal,
    openSiteFeedback: openSiteFeedbackModal,
    renderOrderCardFeedback,
    checkPendingDeliveredOrder,
    inspectLoadedOrders,
    hideFloatingPrompt,
    ensureSiteFeedbackButton,
  };
  window.ConfloraOrderFeedback = api;
  return api;
}
