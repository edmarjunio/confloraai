import { element, openDialog, notify } from "./ui.js";

const RATING_LABELS = {
  1: "Precisa melhorar",
  2: "Regular",
  3: "Bom",
  4: "Muito bom",
  5: "Excelente",
};

const FEEDBACK_HIGHLIGHTS = [
  "Produtos impecáveis e bem protegidos",
  "Entrega pontual",
  "Cuidado no transporte",
  "Atendimento atencioso",
  "Pedido completo e conferido",
];

export function isOrderDelivered(order) {
  if (!order || order.status === "CANCELLED") return false;
  return order.deliveryStatus === "DELIVERED" || order.status === "DELIVERED";
}

function starString(score) {
  const n = Math.max(0, Math.min(5, Math.round(Number(score) || 0)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export function createOrderFeedback(state) {
  const dismissedKey = "conflora_dismissed_feedback_orders_v1";
  let bannerNode = null;
  let dialogNode = null;
  let activeOrder = null;

  function readDismissed() {
    try {
      return new Set(JSON.parse(window.sessionStorage.getItem(dismissedKey) || "[]"));
    } catch {
      return new Set();
    }
  }

  function markDismissed(orderId) {
    if (!orderId) return;
    try {
      const next = readDismissed();
      next.add(String(orderId));
      window.sessionStorage.setItem(dismissedKey, JSON.stringify([...next]));
    } catch {
      // session storage optional
    }
  }

  function ensureDialog() {
    if (dialogNode) return dialogNode;
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
      text: `${current}/5 · ${RATING_LABELS[current]}`,
    });
    const buttons = [];
    const updateStars = (nextValue) => {
      current = nextValue;
      statusText.textContent = `${current}/5 · ${RATING_LABELS[current]}`;
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
        "aria-label": `${label}: ${i} ${i === 1 ? "estrela" : "estrelas"} (${RATING_LABELS[i]})`,
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

  function openFeedbackModal(order, { initialServiceRating = 0, onSubmitted } = {}) {
    if (!order) return;
    activeOrder = order;
    const dialog = ensureDialog();
    const existing = order.feedback || {};
    let serviceRating = Number(initialServiceRating || existing.serviceRating || 5);
    let deliveryRating = Number(existing.deliveryRating || initialServiceRating || 5);
    const selectedHighlights = new Set(Array.isArray(existing.highlights) ? existing.highlights : []);

    const ticket = order.ticketNumber || String(order.id || "").slice(-6).toUpperCase();
    const deliveredMeta = [
      `Pedido #${ticket}`,
      "Entregue",
      order.deliveredBy?.name ? `Entregue por ${order.deliveredBy.name}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const errorBanner = element("p", {
      class: "cf-error-banner",
      role: "alert",
      hidden: true,
    });

    const commentInput = element("textarea", {
      class: "cf-feedback-textarea",
      rows: "3",
      maxlength: "500",
      placeholder: "Conte como chegaram suas plantas ou deixe uma sugestão para a equipe Conflora (opcional)...",
      "aria-label": "Comentário sobre o atendimento e a entrega",
    });
    commentInput.value = existing.comment || "";

    const highlightButtons = FEEDBACK_HIGHLIGHTS.map((item) => {
      const isSelected = selectedHighlights.has(item);
      const btn = element("button", {
        type: "button",
        class: `cf-feedback-highlight-btn ${isSelected ? "active" : ""}`,
        "aria-pressed": String(isSelected),
        text: item,
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
      text: existing.submittedAt ? "Atualizar avaliação" : "Enviar avaliação",
    });

    const cancelButton = element("button", {
      type: "button",
      class: "quiet",
      text: "Agora não",
      onclick: () => {
        markDismissed(order.id);
        dialog.close();
      },
    });

    const form = element("form", { class: "cf-feedback-form" }, [
      renderStarSelector({
        label: "Atendimento Conflora e qualidade das plantas",
        subtitle: "Cuidado com as mudas, orientação da equipe e preparo do pedido.",
        initialValue: serviceRating,
        onChange: (val) => {
          serviceRating = val;
        },
      }),
      renderStarSelector({
        label: "Experiência na entrega",
        subtitle: "Pontualidade, cordialidade e conservação até o seu endereço.",
        initialValue: deliveryRating,
        onChange: (val) => {
          deliveryRating = val;
        },
      }),
      element("div", { class: "cf-feedback-field" }, [
        element("strong", { text: "O que mais se destacou? (opcional)" }),
        element("div", { class: "cf-feedback-highlights", role: "group", "aria-label": "Destaques da entrega" }, highlightButtons),
      ]),
      element("label", { class: "cf-feedback-field" }, [
        element("strong", { text: "Comentário adicional (opcional)" }),
        commentInput,
      ]),
      errorBanner,
      element("div", { class: "cf-feedback-actions" }, [cancelButton, submitButton]),
    ]);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBanner.hidden = true;
      submitButton.disabled = true;
      submitButton.textContent = "Enviando…";
      try {
        const response = await state.api(`/customer/orders/${encodeURIComponent(order.id)}/feedback`, {
          method: "POST",
          body: {
            serviceRating,
            deliveryRating,
            highlights: [...selectedHighlights],
            comment: commentInput.value.trim(),
          },
        });
        const updatedOrder = response.order || {
          ...order,
          feedback: response.feedback || {
            serviceRating,
            deliveryRating,
            overallRating: Number(((serviceRating + deliveryRating) / 2).toFixed(1)),
            highlights: [...selectedHighlights],
            comment: commentInput.value.trim(),
            submittedAt: new Date().toISOString(),
          },
        };
        order.feedback = updatedOrder.feedback;
        markDismissed(order.id);
        hideFloatingPrompt();
        dialog.close();
        notify("Obrigado! Sua avaliação pós-entrega foi registrada.");
        state.trackEvent?.("order_feedback_submitted", {
          orderId: order.id,
          value: updatedOrder.feedback.overallRating,
        });
        onSubmitted?.(updatedOrder);
      } catch (err) {
        errorBanner.textContent = err.message || "Não foi possível registrar sua avaliação.";
        errorBanner.hidden = false;
        submitButton.disabled = false;
        submitButton.textContent = existing.submittedAt ? "Atualizar avaliação" : "Enviar avaliação";
      }
    });

    dialog.replaceChildren(
      element("div", { class: "dialog-header cf-feedback-dialog-header" }, [
        element("div", {}, [
          element("span", { class: "product-info-eyebrow", text: deliveredMeta }),
          element("h2", { id: "orderFeedbackTitle", text: "Como foi sua experiência com a Conflora?" }),
          element("p", {
            class: "muted",
            text: "Seu pedido foi entregue. Sua avaliação ajuda nossa equipe e entregadores a cuidarem cada vez melhor das suas plantas.",
          }),
        ]),
        element("button", {
          type: "button",
          class: "product-info-close",
          "aria-label": "Fechar avaliação",
          text: "×",
          onclick: () => {
            markDismissed(order.id);
            dialog.close();
          },
        }),
      ]),
      form,
    );

    openDialog(dialog);
  }

  function hideFloatingPrompt() {
    if (bannerNode) {
      bannerNode.remove();
      bannerNode = null;
    }
  }

  function showFloatingPrompt(order) {
    if (!order || !isOrderDelivered(order) || order.feedback?.submittedAt) return;
    if (readDismissed().has(String(order.id))) return;
    hideFloatingPrompt();
    const ticket = order.ticketNumber || String(order.id || "").slice(-6).toUpperCase();
    const quickStars = [];
    for (let i = 1; i <= 5; i += 1) {
      quickStars.push(
        element("button", {
          type: "button",
          class: "cf-feedback-banner-star",
          "aria-label": `Avaliar com ${i} ${i === 1 ? "estrela" : "estrelas"}`,
          text: "★",
          onclick: () => openFeedbackModal(order, { initialServiceRating: i }),
        }),
      );
    }

    bannerNode = element(
      "aside",
      {
        id: "postPurchaseFeedbackPrompt",
        class: "cf-feedback-banner",
        role: "region",
        "aria-label": "Avaliação pós-entrega Conflora",
      },
      [
        element("div", { class: "cf-feedback-banner-copy" }, [
          element("span", {
            class: "cf-feedback-banner-kicker",
            text: `Pedido #${ticket} entregue · Conflora Horta e Viveiro`,
          }),
          element("strong", {
            text: "Suas plantas chegaram bem? Avalie o atendimento e a entrega",
          }),
          element("div", { class: "cf-feedback-banner-quick-stars", role: "group", "aria-label": "Nota rápida de 1 a 5 estrelas" }, quickStars),
        ]),
        element("div", { class: "cf-feedback-banner-actions" }, [
          element("button", {
            type: "button",
            class: "primary cf-feedback-banner-cta",
            text: "Avaliar experiência",
            onclick: () => openFeedbackModal(order),
          }),
          element("button", {
            type: "button",
            class: "quiet cf-feedback-banner-dismiss",
            "aria-label": "Avaliar depois",
            text: "Depois",
            onclick: () => {
              markDismissed(order.id);
              hideFloatingPrompt();
            },
          }),
        ]),
      ],
    );
    document.body.append(bannerNode);
  }

  function renderOrderCardFeedback(order) {
    if (!isOrderDelivered(order)) return null;
    const container = element("section", {
      class: "cf-order-card-feedback",
      "aria-label": "Avaliação do atendimento e entrega",
    });

    const paint = () => {
      container.replaceChildren();
      if (order.feedback?.submittedAt) {
        const fb = order.feedback;
        const metaLine = [
          `Atendimento: ${starString(fb.serviceRating)} (${fb.serviceRating}/5)`,
          `Entrega: ${starString(fb.deliveryRating)} (${fb.deliveryRating}/5)`,
        ].join(" · ");
        container.append(
          element("div", { class: "cf-order-feedback-submitted" }, [
            element("div", { class: "cf-order-feedback-summary-row" }, [
              element("div", {}, [
                element("strong", { text: "Sua avaliação pós-entrega" }),
                element("p", { class: "cf-order-feedback-scores", text: metaLine }),
              ]),
              element("button", {
                type: "button",
                class: "quiet cf-feedback-edit-btn",
                text: "Editar avaliação",
                onclick: () => openFeedbackModal(order, { onSubmitted: paint }),
              }),
            ]),
            fb.highlights?.length
              ? element("p", {
                  class: "muted cf-order-feedback-highlights",
                  text: fb.highlights.join(" · "),
                })
              : null,
            fb.comment
              ? element("p", {
                  class: "cf-order-feedback-comment",
                  text: `“${fb.comment}”`,
                })
              : null,
          ]),
        );
        return;
      }

      const quickButtons = [];
      for (let i = 1; i <= 5; i += 1) {
        quickButtons.push(
          element("button", {
            type: "button",
            class: "cf-feedback-inline-star",
            "aria-label": `Dar ${i} ${i === 1 ? "estrela" : "estrelas"} para este pedido`,
            text: "☆",
            onclick: () => openFeedbackModal(order, { initialServiceRating: i, onSubmitted: paint }),
          }),
        );
      }

      container.append(
        element("div", { class: "cf-order-feedback-prompt" }, [
          element("div", { class: "cf-order-feedback-prompt-copy" }, [
            element("strong", { text: "Pedido entregue · Avalie o atendimento e a entrega" }),
            element("p", {
              class: "muted",
              text: "Conte como foi o atendimento da Conflora e o cuidado na entrega deste pedido.",
            }),
          ]),
          element("div", { class: "cf-order-feedback-prompt-controls" }, [
            element("div", { class: "cf-feedback-inline-stars", role: "group", "aria-label": "Avaliação rápida" }, quickButtons),
            element("button", {
              type: "button",
              class: "primary cf-feedback-open-btn",
              text: "Avaliar atendimento e entrega",
              onclick: () => openFeedbackModal(order, { onSubmitted: paint }),
            }),
          ]),
        ]),
      );
    };

    paint();
    return container;
  }

  async function checkPendingDeliveredOrder() {
    if (!state.existingStore || !state.user) {
      hideFloatingPrompt();
      return;
    }
    try {
      const result = await state.api("/customer/orders/pending-feedback");
      if (result?.order && isOrderDelivered(result.order) && !result.order.feedback?.submittedAt) {
        showFloatingPrompt(result.order);
      }
    } catch {
      // Do not interrupt browsing if pending feedback check fails
    }
  }

  function inspectLoadedOrders(orders = []) {
    const candidate = (orders || []).find(
      (order) => isOrderDelivered(order) && !order.feedback?.submittedAt && !readDismissed().has(String(order.id)),
    );
    if (candidate && !activeOrder) {
      showFloatingPrompt(candidate);
    }
  }

  const api = {
    open: openFeedbackModal,
    renderOrderCardFeedback,
    checkPendingDeliveredOrder,
    inspectLoadedOrders,
    hideFloatingPrompt,
  };
  window.ConfloraOrderFeedback = api;
  return api;
}
