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
    view.replaceChildren(element("h1", { text: "Gerenciar loja" }));
    if (state.user?.role !== "ADMIN") {
      view.append(
        element("p", { text: "Entre com a conta administrativa desta loja." }),
      );
      return;
    }
    const tabs = element("nav", { class: "admin-tabs" });
    const panel = element("section", { class: "admin-panel" });
    for (const [label, action] of [
      ["Configurações", () => settings(panel)],
      ["Produtos", () => products(panel)],
      ["Pedidos", () => orders(panel)],
    ]) {
      tabs.append(
        element("button", {
          text: label,
          onclick: () => action().catch((error) => notify(error.message)),
        }),
      );
    }
    view.append(tabs, panel);
    await settings(panel);
  }
  async function settings(panel) {
    const response = await state.api("/admin/config");
    configDraft = response.config;
    const config = configDraft;
    const assistant = response.assistant;
    const form = element("form", { class: "admin-form" });
    const categories = element("div", { class: "category-editor" });
    const categoryRows = config.categories.map((category) => ({ ...category }));
    const drawCategories = () => {
      categories.replaceChildren(
        ...categoryRows.map((category) => {
          const name = element("input", {
            value: category.name,
            "aria-label": "Nome da categoria",
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
      element("h2", { text: "Identidade visual" }),
      field("Nome", "name", config.identity.name),
      field("Subtítulo", "subtitle", config.identity.subtitle),
      field("Nicho / segmento", "niche", config.identity.niche),
      field("Cidade", "city", config.identity.city),
      field("Estado / região", "region", config.identity.region),
      field("URL do logo (HTTPS)", "logo", config.branding.logoUrl),
      field("URL do ícone (HTTPS)", "icon", config.branding.iconUrl),
    );
    for (const [key, label] of [
      ["primary", "Cor das ações"],
      ["accent", "Cor dos destaques"],
      ["text", "Cor do texto"],
      ["background", "Cor de fundo"],
    ]) {
      form.append(inputField(label, key, config.branding.colors[key], "color"));
    }
    form.append(
      element("h2", { text: "Categorias" }),
      element("p", {
        class: "muted",
        text: "Renomeie sem perder os vínculos dos produtos. Desmarque para ocultar a categoria.",
      }),
      categories,
      element("button", {
        type: "button",
        text: "Adicionar categoria",
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
      element("h2", { text: "Checkout e logística" }),
      field(
        "WhatsApp da loja (país + DDD + número)",
        "phone",
        config.checkout.contactPhone,
      ),
      checkbox(
        "Habilitar entrega",
        "delivery",
        config.checkout.delivery.enabled,
      ),
      field(
        "Nome da opção de entrega",
        "deliveryLabel",
        config.checkout.delivery.label,
      ),
      textarea(
        "Regiões atendidas (uma por linha)",
        "areas",
        config.checkout.delivery.serviceAreas.join("\n"),
      ),
      inputField(
        "Taxa fixa de entrega (R$)",
        "fee",
        config.checkout.delivery.feeMinor / 100,
        "number",
      ),
      checkbox("Habilitar retirada", "pickup", config.checkout.pickup.enabled),
      field(
        "Nome da opção de retirada",
        "pickupLabel",
        config.checkout.pickup.label,
      ),
      field(
        "Endereço da retirada",
        "pickupAddress",
        config.checkout.pickup.address,
      ),
    );
    form.elements.fee.step = "0.01";
    form.elements.fee.min = "0";
    for (const [method, label] of [
      ["PIX", "PIX"],
      ["CARD", "Cartão"],
      ["CASH", "Dinheiro"],
    ]) {
      form.append(
        checkbox(
          label,
          method,
          config.checkout.enabledPayments.includes(method),
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
        "Oferecer envio ao WhatsApp após registrar pedido",
        "handoff",
        config.checkout.completionMode === "WHATSAPP_HANDOFF",
      ),
    );
    form.append(
      element("h2", { text: "Consultor de vendas IA" }),
      checkbox("Habilitar assistente", "aiEnabled", config.assistant.enabled),
      field("Nome do assistente", "aiName", config.assistant.displayName),
      textarea(
        "Mensagem de boas-vindas",
        "welcome",
        config.assistant.welcomeMessage,
      ),
      textarea(
        "Perguntas sugeridas (uma por linha)",
        "suggestions",
        config.assistant.suggestedQuestions.join("\n"),
      ),
      textarea("Persona", "persona", assistant.persona || ""),
      textarea(
        "Instruções para atendimento",
        "instructions",
        assistant.instructions || "",
      ),
      checkbox(
        "Permitir pesquisa externa com fontes",
        "webSearch",
        assistant.webSearchEnabled,
      ),
      element("button", {
        type: "submit",
        class: "primary",
        text: "Salvar configurações",
      }),
    );
    form.append(
      element("h2", { text: "Integração de pedidos" }),
      field(
        "URL HTTPS do webhook (opcional)",
        "webhookUrl",
        response.integrations?.orderWebhookUrl,
      ),
      field(
        "Referência do segredo fornecida pelo operador",
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
      next.branding.logoUrl = f.logo.value;
      next.branding.iconUrl = f.icon.value;
      for (const color of ["primary", "accent", "text", "background"]) {
        next.branding.colors[color] = f[color].value;
      }
      next.categories = categoryRows;
      next.checkout = {
        ...next.checkout,
        contactPhone: f.phone.value,
        enabledPayments: ["PIX", "CARD", "CASH"].filter(
          (method) => f[method].checked,
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
        await settings(panel);
        notify("Configurações salvas.");
      });
    });
    panel.replaceChildren(form);
  }
  async function products(panel) {
    const list = await state.api("/admin/products");
    const editor = element("section");
    const rows = element("div", { class: "admin-products" });
    panel.replaceChildren(
      element("h2", { text: "Produtos" }),
      element("button", {
        text: "Cadastrar produto",
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
            text: "Editar",
            onclick: () => editProduct(editor, product, () => products(panel)),
          }),
          element("button", {
            text: "Ocultar",
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
      element("h2", { text: product ? "Editar produto" : "Novo produto" }),
      field("Nome", "name", product?.name),
      textarea("Descrição", "description", product?.description),
      inputField(
        "Preço (R$)",
        "price",
        (product?.price.amountMinor || 0) / 100,
        "number",
      ),
      field("URL da foto principal", "image", product?.imageUrl),
      textarea(
        "Fotos adicionais (uma URL HTTPS por linha)",
        "images",
        product?.images.map((i) => i.url).join("\n") || "",
      ),
      textarea(
        "Tags (separadas por vírgula)",
        "tags",
        product?.tags.join(", ") || "",
      ),
      textarea(
        "Especificações (uma por linha: nome: valor)",
        "specs",
        Object.values(product?.specifications || {})
          .map((s) => `${s.label}: ${s.value} ${s.unit || ""}`.trim())
          .join("\n"),
      ),
      textarea(
        "Informações e cuidados (uma seção por linha: título: conteúdo)",
        "sections",
        product?.contentSections
          .map((s) => `${s.title}: ${s.body}`)
          .join("\n") || "",
      ),
      checkbox(
        "Produto disponível",
        "available",
        product?.isAvailable !== false,
      ),
      checkbox("Controlar estoque", "tracked", !!product?.stock.tracked),
      inputField("Estoque", "stock", product?.stock.quantity || 0, "number"),
      field(
        "Código da unidade (UN, KG, M...)",
        "unit",
        product?.saleUnit.code || "UN",
      ),
      field(
        "Nome da unidade",
        "unitLabel",
        product?.saleUnit.label || "unidade",
      ),
      inputField(
        "Quantidade mínima",
        "minimum",
        product?.saleUnit.minimum || 1,
        "number",
      ),
      inputField(
        "Incremento de quantidade",
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
      element("legend", { text: "Categorias" }),
    ]);
    for (const category of state.config.categories) {
      const label = checkbox(
        category.name,
        `cat-${category.id}`,
        product?.categories.includes(category.id),
      );
      categories.append(label);
    }
    form.append(
      categories,
      element("button", {
        class: "primary",
        type: "submit",
        text: "Salvar produto",
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
            throw new Error("Use título: conteúdo em cada linha.");
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
        notify("Produto salvo.");
      });
    });
    container.replaceChildren(form);
    container.scrollIntoView({ behavior: "smooth" });
  }
  async function orders(panel) {
    const list = await state.api("/admin/orders");
    panel.replaceChildren(element("h2", { text: "Pedidos" }));
    const transitions = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["DELIVERED", "CANCELLED"],
      DELIVERED: [],
      CANCELLED: [],
    };
    const labels = {
      PENDING: "Pendente",
      CONFIRMED: "Em separação",
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
          text: `${order.customer.phone} · ${order.address || "Retirada"} · ${money(order.totalMinor)}`,
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
      panel.append(element("p", { text: "Nenhum pedido recebido." }));
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
