import { renderProcurements } from './procurement.js';
import { $, element, inputField, notify, money } from "./ui.js";
const field = (label, name, value) => inputField(label, name, value ?? "");
const textarea = (label, name, value = "") =>
  element("label", { text: label }, [
    element("textarea", { name, rows: "4", text: value }),
  ]);
const checkbox = (label, name, checked) => {
  const input = element("input", { type: "checkbox", name });
  input.checked = checked;
  return element("label", { class: "checkbox" }, [
    input,
    document.createTextNode(label),
  ]);
};

export function createAdmin(state) {
  const view = $("#adminView");
  let configDraft;
  async function render() {
    view.replaceChildren(element("h1", { text: 'manage_store'.tr }));
    if (state.existingStore && state.user?.role === 'CAIXA') {
      await orderRequests(view); return;
    }
    if (state.user?.role !== "ADMIN") {
      view.append(
        element("p", { text: 'log_in_with_this_store_s_admin_account'.tr }),
      );
      return;
    }
    const tabs = element("nav", { class: "admin-tabs" });
    const panel = element("section", { class: "admin-panel" });
    for (const [label, action] of state.existingStore
      ? [["Personalizar loja", () => settings(panel)], ["Encomendas", () => orderRequests(panel)]]
      : [
          ['settings'.tr, () => settings(panel)],
          ['products_595f74'.tr, () => products(panel)],
          ['orders'.tr, () => orders(panel)],
        ]) {
      const activate = () => {
        action().then(() => {
          for (const item of tabs.children) item.setAttribute('aria-pressed', String(item === control));
        }).catch((error) => notify(error.message));
      };
      const control = state.existingStore
        ? window.createButton3D({ text: label, variant: 'secondary', onClick: activate, attributes: { 'aria-pressed': String(!tabs.children.length) } })
        : element('button', { text: label, onclick: activate });
      tabs.append(control);
    }
    view.append(tabs, panel);
    if (state.existingStore) {
      view.append(
        element("a", {
          href: "/admin",
          text: 'manage_products_orders_and_stock'.tr,
        }),
      );
    }
    await settings(panel);
  }
  async function orderRequests(panel) {
    return renderProcurements(panel, state);
  }
  async function settings(panel) {
    panel.classList.remove('procurement-panel');
    const response = await state.api("/admin/config");
    configDraft = response.config;
    const config = configDraft;
    const assistant = response.assistant;
    const form = element("form", { class: "admin-form" });
    const preview = state.existingStore ? null : element("img", {
      src: config.branding.logoUrl || "/store-assets/placeholder.svg",
      alt: 'logo_preview'.tr,
      style: "max-width:220px;max-height:100px;object-fit:contain",
    });
    const upload = state.existingStore ? null : element("input", {
      type: "file",
      accept: "image/png,image/jpeg,image/webp",
      "aria-label": 'choose_logo_from_computer'.tr,
    });
    upload?.addEventListener("change", async () => {
      const file = upload.files[0];
      if (!file) {
        return;
      }
      try {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 10000000
        ) {
          throw new Error('choose_png_jpeg_or_webp_up_to_10_mb'.tr);
        }
        const bitmap = await window.createImageBitmap(file);
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas
          .getContext("2d")
          .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const url = canvas.toDataURL("image/webp", 0.85);
        if (url.length > 250000) {
          throw new Error('logo_too_detailed_choose_a_smaller_image'.tr);
        }
        form.elements.logo.value = url;
        preview.src = url;
      } catch (error) {
        notify(error.message);
      }
    });
    const categories = element("div", { class: "category-editor" });
    const categoryRows = config.categories.map((category) => ({ ...category }));
    const drawCategories = () => {
      categories.replaceChildren(
        ...categoryRows.map((category) => {
          const name = element("input", {
            value: category.name,
            "aria-label": 'category_name'.tr,
            required: "",
          });
          name.addEventListener("input", () => {
            category.name = name.value;
          });
          const enabled = element("input", {
            type: "checkbox",
            "aria-label": "Categoria ativa",
          });
          enabled.checked = category.isActive;
          enabled.addEventListener("change", () => {
            category.isActive = enabled.checked;
          });
          return element("div", { class: "category-row" }, [name, enabled]);
        }),
      );
    };
    drawCategories();
    form.append(
      element("h2", { text: 'visual_identity'.tr }),
      field('cart_name_label'.tr, "name", config.identity.name),
      field('subtitle'.tr, "subtitle", config.identity.subtitle),
      field("Nicho / segmento", "niche", config.identity.niche),
      field("Cidade", "city", config.identity.city),
      field('state_region'.tr, "region", config.identity.region),
    );
    if (!state.existingStore) {
      form.append(
        field('logo_url_https'.tr, "logo", config.branding.logoUrl),
        field('icon_url_https'.tr, "icon", config.branding.iconUrl),
      );
    }
    for (const [key, label] of [
      ["primary", 'action_color'.tr],
      ["accent", 'highlight_color'.tr],
      ["text", 'text_color'.tr],
      ["background", 'background_color'.tr],
    ]) {
      form.append(inputField(label, key, config.branding.colors[key], "color"));
    }
    if (!state.existingStore) {
      form.append(
        element("label", { text: 'choose_logo_from_computer'.tr }, [upload]),
        preview,
      );
      form.elements.logo.addEventListener("change", () => {
        preview.src = form.elements.logo.value || "/store-assets/placeholder.svg";
      });
    }
    const mode = element(
      "select",
      { name: "chatMode", "aria-label": 'assistant_mode'.tr },
      [
        element("option", {
          value: "GUIDED",
          text: 'category_guide_no_ai'.tr,
        }),
        element("option", { value: "AI", text: 'ai_consultancy'.tr }),
      ],
    );
    mode.value = config.assistant.mode || "GUIDED";
    form.append(
      element("label", { text: 'assistant_mode'.tr }, [mode]),
      textarea(
        'synonyms_one_group_per_line_separated_by_commas'.tr,
        "synonyms",
        (config.assistant.synonyms || [])
          .map((group) => group.join(", "))
          .join("\n"),
      ),
    );
    form.append(
      element("h2", { text: 'mobile_nav_categories'.tr }),
      element("p", {
        class: "muted",
        text: 'rename_without_losing_product_links_uncheck_to_hide_category'.tr,
      }),
      categories,
      element("button", {
        type: "button",
        text: 'add_category'.tr,
        onclick: () => {
          categoryRows.push({
            id: crypto.randomUUID(),
            name: "",
            order: categoryRows.length,
            isActive: true,
          });
          drawCategories();
        },
      }),
    );
    form.append(
      element("h2", { text: 'checkout_and_logistics'.tr }),
      field(
        'store_whatsapp_country_area_code_number'.tr,
        "phone",
        config.checkout.contactPhone,
      ),
      checkbox(
        'enable_delivery'.tr,
        "delivery",
        config.checkout.delivery.enabled,
      ),
      field(
        'delivery_option_name'.tr,
        "deliveryLabel",
        config.checkout.delivery.label,
      ),
      textarea(
        'serviced_regions_one_per_line'.tr,
        "areas",
        config.checkout.delivery.serviceAreas.join("\n"),
      ),
      inputField(
        'flat_delivery_fee_r'.tr,
        "fee",
        config.checkout.delivery.feeMinor / 100,
        "number",
      ),
      checkbox('enable_pickup'.tr, "pickup", config.checkout.pickup.enabled),
      field(
        'pickup_option_name'.tr,
        "pickupLabel",
        config.checkout.pickup.label,
      ),
      field(
        'pickup_address'.tr,
        "pickupAddress",
        config.checkout.pickup.address,
      ),
    );
    form.elements.fee.step = "0.01";
    form.elements.fee.min = "0";
    for (const [method, label] of [
      ["PIX", "PIX"],
      ["CASH", 'cart_cash_option'.tr],
      ["CREDITO", 'cart_card_option'.tr],
      ["DEBITO", 'cart_debit_option'.tr],
    ]) {
      form.append(
        checkbox(
          label,
          method,
          config.checkout.enabledPayments.includes(method) ||
            ((method === "CREDITO" || method === "DEBITO") && config.checkout.enabledPayments.includes("CARD")),
        ),
      );
    }
    form.append(
      field("Chave PIX", "pixKey", config.checkout.pix.key),
      field(
        "Favorecido PIX",
        "pixRecipient",
        config.checkout.pix.recipientName,
      ),
      checkbox(
        'offer_whatsapp_checkout_after_placing_order'.tr,
        "handoff",
        config.checkout.completionMode === "WHATSAPP_HANDOFF",
      ),
    );
    form.append(
      element("h2", { text: 'ai_sales_consultant'.tr }),
      checkbox("Habilitar assistente", "aiEnabled", config.assistant.enabled),
      field('assistant_name'.tr, "aiName", config.assistant.displayName),
      textarea(
        'welcome_message'.tr,
        "welcome",
        config.assistant.welcomeMessage,
      ),
      textarea(
        'suggested_questions_one_per_line'.tr,
        "suggestions",
        config.assistant.suggestedQuestions.join("\n"),
      ),
      textarea("Persona", "persona", assistant.persona || ""),
      textarea(
        'service_instructions'.tr,
        "instructions",
        assistant.instructions || "",
      ),
      checkbox(
        'allow_external_search_with_sources'.tr,
        "webSearch",
        assistant.webSearchEnabled,
      ),
      element("button", {
        type: "submit",
        class: "primary",
        text: 'save_settings'.tr,
      }),
    );
    form.append(
      element("h2", { text: 'order_integration'.tr }),
      field(
        'webhook_https_url_optional'.tr,
        "webhookUrl",
        response.integrations?.orderWebhookUrl,
      ),
      field(
        'secret_reference_provided_by_operator'.tr,
        "webhookSecretRef",
        response.integrations?.webhookSecretRef,
      ),
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const f = form.elements;
      const next = structuredClone(config);
      next.identity = {
        ...next.identity,
        name: f.name.value,
        subtitle: f.subtitle.value,
        niche: f.niche.value,
        city: f.city.value,
        region: f.region.value,
      };
      if (!state.existingStore) {
        next.branding.logoUrl = f.logo.value;
        next.branding.iconUrl = f.icon.value;
      }
      for (const color of ["primary", "accent", "text", "background"]) {
        next.branding.colors[color] = f[color].value;
      }
      next.categories = categoryRows;
      next.checkout = {
        ...next.checkout,
        contactPhone: f.phone.value,
        enabledPayments: ["PIX", "CASH", "CREDITO", "DEBITO"].filter(
          (method) => f[method]?.checked,
        ),
        pix: { key: f.pixKey.value, recipientName: f.pixRecipient.value },
        completionMode: f.handoff.checked ? "WHATSAPP_HANDOFF" : "IN_APP",
        delivery: {
          enabled: f.delivery.checked,
          label: f.deliveryLabel.value,
          serviceAreas: f.areas.value
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
          feeMinor: Math.round(Number(f.fee.value) * 100),
        },
        pickup: {
          enabled: f.pickup.checked,
          label: f.pickupLabel.value,
          address: f.pickupAddress.value,
        },
      };
      next.assistant = {
        mode: f.chatMode.value,
        synonyms: f.synonyms.value
          .split("\n")
          .map((line) =>
            line
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          )
          .filter((group) => group.length),
        enabled: f.aiEnabled.checked,
        displayName: f.aiName.value,
        welcomeMessage: f.welcome.value,
        suggestedQuestions: f.suggestions.value.split("\n").filter(Boolean),
      };
      await submit(form, async () => {
        state.config = await state.api("/admin/config", {
          method: "PUT",
          body: {
            config: next,
            integrations: {
              orderWebhookUrl: f.webhookUrl.value,
              webhookSecretRef: f.webhookSecretRef.value,
            },
            assistant: {
              persona: f.persona.value,
              instructions: f.instructions.value,
              webSearchEnabled: f.webSearch.checked,
            },
          },
        });
        state.applyConfig();

        if (next.assistant.mode !== config.assistant.mode) {
          window.location.reload();
          return;
        }
        await settings(panel);
        notify('settings_saved'.tr);
      });
    });
    panel.replaceChildren(form);
  }
  async function products(panel) {
    const list = await state.api("/admin/products");
    const editor = element("section");
    const rows = element("div", { class: "admin-products" });
    panel.replaceChildren(
      element("h2", { text: 'products_595f74'.tr }),
      element("button", {
        text: 'register_product'.tr,
        onclick: () => editProduct(editor, null, () => products(panel)),
      }),
      rows,
      editor,
    );
    for (const product of list) {
      rows.append(
        element("div", { class: "admin-product-row" }, [
          element("span", {
            text: `${product.name} · ${money(product.price.amountMinor)} · ${product.isAvailable ? "Ativo" : "Oculto"}`,
          }),
          element("button", {
            text: 'common_edit'.tr,
            onclick: () => editProduct(editor, product, () => products(panel)),
          }),
          element("button", {
            text: 'hide'.tr,
            onclick: async () => {
              try {
                await state.api(`/admin/products/${product.id}`, {
                  method: "DELETE",
                });
                await products(panel);
                await state.reloadProducts();
              } catch (error) {
                notify(error.message);
              }
            },
          }),
        ]),
      );
    }
  }
  function editProduct(container, product, reload) {
    const form = element("form", { class: "admin-form" });
    form.append(
      element("h2", { text: product ? 'edit_product'.tr : 'new_product'.tr }),
      field('cart_name_label'.tr, "name", product?.name),
      field("Subcategoria", "subcategoryName", product?.subcategoryName),
      textarea('description'.tr, "description", product?.description),
      inputField(
        'price_r'.tr,
        "price",
        (product?.price.amountMinor || 0) / 100,
        "number",
      ),
      field('main_photo_url'.tr, "image", product?.imageUrl),
      textarea(
        'additional_photos_one_https_url_per_line'.tr,
        "images",
        product?.images.map((i) => i.url).join("\n") || "",
      ),
      textarea(
        'tags_comma_separated'.tr,
        "tags",
        product?.tags.join(", ") || "",
      ),
      textarea(
        'specifications_one_per_line_name_value'.tr,
        "specs",
        Object.values(product?.specifications || {})
          .map((s) => `${s.label}: ${s.value} ${s.unit || ""}`.trim())
          .join("\n"),
      ),
      textarea(
        'information_and_care_one_section_per_line_title_content'.tr,
        "sections",
        product?.contentSections
          .map((s) => `${s.title}: ${s.body}`)
          .join("\n") || "",
      ),
      checkbox(
        'product_available'.tr,
        "available",
        product?.isAvailable !== false,
      ),
      checkbox('manage_inventory'.tr, "tracked", !!product?.stock.tracked),
      inputField('stock'.tr, "stock", product?.stock.quantity || 0, "number"),
      field(
        'unit_code_un_kg_m'.tr,
        "unit",
        product?.saleUnit.code || "UN",
      ),
      field(
        'unit_name'.tr,
        "unitLabel",
        product?.saleUnit.label || 'unit_a9959d28d9'.tr,
      ),
      inputField(
        'minimum_quantity'.tr,
        "minimum",
        product?.saleUnit.minimum || 1,
        "number",
      ),
      inputField(
        'quantity_increment'.tr,
        "increment",
        product?.saleUnit.increment || 1,
        "number",
      ),
    );
    for (const name of ["price", "stock", "minimum", "increment"]) {
      form.elements[name].step = name === "price" ? "0.01" : "0.001";
      form.elements[name].min = "0";
    }
    const categories = element("fieldset", {}, [
      element("legend", { text: 'mobile_nav_categories'.tr }),
    ]);
    for (const category of state.config.categories) {
      const label = checkbox(
        category.name,
        `cat-${category.id}`,
        product?.categories.includes(category.id),
      );
      label.lastChild.replaceWith(element("render-category-tag", { category: category.name }));
      categories.append(label);
    }
    form.append(
      categories,
      element("button", {
        class: "primary",
        type: "submit",
        text: 'save_product'.tr,
      }),
    );
    form.elements.name.required = true;
    const parseLines = (value) =>
      value
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf(":");
          if (separator < 1) {
            throw new Error('use_title_content_on_each_line'.tr);
          }
          return [
            line.slice(0, separator).trim(),
            line.slice(separator + 1).trim(),
          ];
        });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await submit(form, async () => {
        const f = form.elements;
        const id = product?.id || crypto.randomUUID();
        const data = {
          id,
          slug: product?.slug || id,
          updatedAt: product?.updatedAt,
          revision: product?.revision,
          name: f.name.value,
          description: f.description.value,
          price: { amountMinor: Math.round(Number(f.price.value) * 100) },
          imageUrl: f.image.value,
          images: f.images.value
            .split("\n")
            .filter(Boolean)
            .map((url) => ({ url, alt: f.name.value })),
          tags: f.tags.value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          subcategoryName: f.subcategoryName.value,
          categories: state.config.categories
            .filter((c) => f[`cat-${c.id}`].checked)
            .map((c) => c.id),
          specifications: Object.fromEntries(
            parseLines(f.specs.value).map(([label, value], index) => [
              `attribute-${index}`,
              { label, value },
            ]),
          ),
          contentSections: parseLines(f.sections.value).map(
            ([title, body], index) => ({ id: `section-${index}`, title, body }),
          ),
          isAvailable: f.available.checked,
          stock: {
            tracked: f.tracked.checked,
            quantity: Number(f.stock.value),
          },
          saleUnit: {
            code: f.unit.value,
            label: f.unitLabel.value,
            minimum: Number(f.minimum.value),
            increment: Number(f.increment.value),
          },
        };
        await state.api(`/admin/products/${id}`, { method: "PUT", body: data });
        await state.reloadProducts();
        await reload();
        notify('product_saved'.tr);
      });
    });
    container.replaceChildren(form);
    container.scrollIntoView({ behavior: "smooth" });
  }
  async function orders(panel) {
    const list = await state.api("/admin/orders");
    panel.replaceChildren(element("h2", { text: 'orders'.tr }));
    const transitions = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["DELIVERED", "CANCELLED"],
      DELIVERED: [],
      CANCELLED: [],
    };
    const labels = {
      PENDING: "Pendente",
      CONFIRMED: 'being_prepared'.tr,
      DELIVERED: "Entregue",
      CANCELLED: "Cancelado",
    };
    for (const order of list.sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )) {
      const row = element("article", { class: "order-card" }, [
        element("h3", {
          text: `#${order.id.slice(0, 8)} · ${order.customer.name}`,
        }),
        element("p", {
          text: `${order.customer.phone} · ${order.address || 'cart_pickup_option'.tr} · ${money(order.totalMinor)}`,
        }),
        element("span", { class: "badge", text: labels[order.status] }),
        ...order.items.map((i) =>
          element("p", { text: `${i.quantity} × ${i.name}` }),
        ),
      ]);
      for (const status of transitions[order.status] || []) {
        row.append(
          element("button", {
            text: labels[status],
            onclick: async () => {
              try {
                await state.api(`/admin/orders/${order.id}`, {
                  method: "PATCH",
                  body: { status },
                });
                await orders(panel);
                await state.reloadProducts();
              } catch (error) {
                notify(error.message);
              }
            },
          }),
        );
      }
      panel.append(row);
    }
    if (!list.length) {
      panel.append(element("p", { text: 'no_orders_received'.tr }));
    }
  }
  async function submit(form, operation) {
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      await operation();
    } catch (error) {
      notify(error.message);
    } finally {
      button.disabled = false;
    }
  }
  return { render };
}
