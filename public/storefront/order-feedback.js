import { element, openDialog, notify } from "./ui.js";

const RATING_LABELS = {
  1: 'needs_improvement'.tr,
  2: 'fair'.tr,
  3: 'good'.tr,
  4: 'very_good'.tr,
  5: 'excellent'.tr,
};

const FEEDBACK_TYPES = [
  { id: "ELOGIO", label: 'praise_compliment'.tr },
  { id: "SUGESTAO", label: 'suggestion'.tr },
  { id: "RECLAMACAO", label: 'complaint_issue'.tr },
  { id: "DUVIDA", label: 'other'.tr },
];

const FEEDBACK_HIGHLIGHTS = [
  'flawless_well_protected_plants'.tr,
  'on_time_delivery'.tr,
  'careful_transport'.tr,
  'attentive_customer_care'.tr,
  'healthy_vibrant_plants'.tr,
  'easy_to_buy_on_the_website'.tr,
];

export function isOrderDelivered(order) {
  if (!order || order.status === "CANCELLED") return false;
  return order.deliveryStatus === "DELIVERED" || order.status === "DELIVERED";
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
        "aria-label": `${label}: ${i} ${i === 1 ? 'star'.tr : 'stars'.tr} (${(RATING_LABELS[i] || "").tr})`,
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
      placeholder: 'your_name_optional'.tr,
      "aria-label": 'your_name'.tr,
    });
    nameInput.value = state.user?.name || "";

    const contactInput = element("input", {
      type: "text",
      class: "cf-feedback-input",
      placeholder: 'whatsapp_or_contact_email_optional'.tr,
      "aria-label": 'whatsapp_or_email'.tr,
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
      placeholder: 'tell_us_about_your_experience_praise_suggestion_or_complaint_for_conflora_s_owner'.tr,
      "aria-label": 'message_or_complaint_e2a096d90d'.tr,
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
      text: 'submit_review'.tr,
    });

    const cancelButton = element("button", {
      type: "button",
      class: "quiet",
      text: 'not_now'.tr,
      onclick: () => dialog.close(),
    });

    const form = element("form", { class: "cf-feedback-form" }, [
      element("div", { class: "cf-feedback-field" }, [
        element("strong", { text: 'feedback_type'.tr }),
        typeContainer,
      ]),
      renderStarSelector({
        label: 'overall_rating_for_site_service'.tr,
        subtitle: 'your_rating_helps_us_continually_improve_your_shopping_experience'.tr,
        initialValue: rating,
        onChange: (val) => {
          rating = val;
        },
      }),
      element("div", { class: "cf-feedback-field" }, [
        element("strong", { text: 'your_details_optional'.tr }),
        nameInput,
        contactInput,
      ]),
      element("div", { class: "cf-feedback-field" }, [
        element("strong", { text: 'what_stood_out_most_optional'.tr }),
        element("div", { class: "cf-feedback-highlights", role: "group", "aria-label": 'highlights'.tr }, highlightButtons),
      ]),
      element("label", { class: "cf-feedback-field" }, [
        element("strong", { text: 'message_or_complaint'.tr }),
        commentInput,
      ]),
      errorBanner,
      element("div", { class: "cf-feedback-actions" }, [cancelButton, submitButton]),
    ]);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBanner.hidden = true;
      submitButton.disabled = true;
      submitButton.textContent = 'sending'.tr;

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
        notify('thank_you_your_feedback_has_been_sent_directly_to_conflora_s_owner'.tr);

        // Se houver link direto do WhatsApp do proprietário, abre no WhatsApp
        if (response?.ownerWhatsappUrl) {
          try {
            window.open(response.ownerWhatsappUrl, "_blank", "noopener,noreferrer");
          } catch {}
        }
      } catch (err) {
        errorBanner.textContent = err.message || 'could_not_submit_your_feedback'.tr;
        errorBanner.hidden = false;
        submitButton.disabled = false;
        submitButton.textContent = 'submit_review'.tr;
      }
    });

    dialog.replaceChildren(
      element("div", { class: "dialog-header cf-feedback-dialog-header" }, [
        element("div", {}, [
          element("span", { class: "product-info-eyebrow", text: 'conflora_garden_nursery'.tr }),
          element("h2", { id: "orderFeedbackTitle", text: 'how_was_your_experience_with_conflora'.tr }),
          element("p", {
            class: "muted",
            text: 'your_feedback_goes_directly_to_the_owner_s_whatsapp_send_compliments_suggestions_or_c'.tr,
          }),
        ]),
        element("button", {
          type: "button",
          class: "product-info-close",
          "aria-label": 'common_close'.tr,
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
        "aria-label": 'review_our_site'.tr,
        title: 'review_our_site'.tr,
        onclick: () => openSiteFeedbackModal(),
      },
      [
        element("span", { class: "site-feedback-star", "aria-hidden": "true", text: "⭐" }),
        element("span", { class: "site-feedback-text", text: 'review_our_site'.tr }),
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
      "aria-label": 'site_customer_service_review'.tr,
    });

    const paint = () => {
      container.replaceChildren();
      container.append(
        element("div", { class: "cf-order-feedback-prompt" }, [
          element("div", { class: "cf-order-feedback-prompt-copy" }, [
            element("strong", { text: 'how_was_your_experience_with_this_order_and_service'.tr }),
            element("p", {
              class: "muted",
              text: 'rate_our_service_send_praise_or_file_a_direct_complaint_to_the_owner'.tr,
            }),
          ]),
          element("div", { class: "cf-order-feedback-prompt-controls" }, [
            element("button", {
              type: "button",
              class: "primary cf-feedback-open-btn",
              text: 'review_experience'.tr,
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
