import { $, element, notify } from "./ui.js";

export function createProductEntry(state, onSaved) {
  const dialog = $("#productEntryDialog");
  const content = $("#productEntryContent");
  let currentTab = "product"; // "product" | "stock"
  let editingProduct = null;

  function render() {
    if (!dialog || !content) {return;}
    content.replaceChildren();

    // Tabs
    const tabsContainer = element("div", { class: "pe-tabs" }, [
      element("button", {
        type: "button",
        class: `pe-tab-btn ${currentTab === "product" ? "active" : ""}`,
        text: editingProduct ? "✏️ Editar Produto" : "+ Novo Produto",
        onclick: () => {
          currentTab = "product";
          render();
        },
      }),
      element("button", {
        type: "button",
        class: `pe-tab-btn ${currentTab === "stock" ? "active" : ""}`,
        text: "⚡ Entrada Rápida de Estoque",
        onclick: () => {
          currentTab = "stock";
          render();
        },
      }),
    ]);

    content.append(tabsContainer);

    if (currentTab === "product") {
      renderProductForm();
    } else {
      renderQuickStockForm();
    }
  }

  function renderProductForm() {
    const existingCategories = [
      ...new Set(
        state.products
          .map((p) => p.categoryName || p.category)
          .filter(Boolean),
      ),
    ];

    const form = element("form", { class: "pe-form" });

    // Datalist for categories
    const datalist = element(
      "datalist",
      { id: "categorySuggestions" },
      existingCategories.map((cat) => element("option", { value: cat })),
    );
    form.append(datalist);

    // Name field
    const nameInput = element("input", {
      type: "text",
      name: "name",
      required: "",
      placeholder: "Ex: Ração Golden 15kg, Vaso Cerâmica, Camiseta Polo...",
      value: editingProduct?.name || "",
    });
    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: "Nome do Produto *" }),
        nameInput,
      ]),
    );

    // Category and Subcategory row
    const catInput = element("input", {
      type: "text",
      name: "category",
      list: "categorySuggestions",
      placeholder: "Selecione ou digite nova categoria",
      value: editingProduct?.categoryName || editingProduct?.category || "",
    });
    const subcatInput = element("input", {
      type: "text",
      name: "subcategory",
      placeholder: "Subcategoria (opcional)",
      value: editingProduct?.subcategoryName || editingProduct?.subcategory || "",
    });

    form.append(
      element("div", { class: "pe-row" }, [
        element("label", { class: "pe-label" }, [
          element("span", { text: "Categoria *" }),
          catInput,
        ]),
        element("label", { class: "pe-label" }, [
          element("span", { text: "Subcategoria" }),
          subcatInput,
        ]),
      ]),
    );

    // Price, Stock, Unit row
    const priceVal = editingProduct
      ? (editingProduct.price?.amountMinor ? editingProduct.price.amountMinor / 100 : (editingProduct.price || 0))
      : "";
    const priceInput = element("input", {
      type: "number",
      name: "price",
      step: "0.01",
      min: "0",
      required: "",
      placeholder: "0,00",
      value: String(priceVal),
    });
    const stockVal = editingProduct?.stock?.quantity ?? editingProduct?.stockQuantity ?? 0;
    const stockInput = element("input", {
      type: "number",
      name: "stockQuantity",
      min: "0",
      placeholder: "0",
      value: String(stockVal),
    });
    const unitSelect = element("select", { name: "unit" }, [
      element("option", { value: "UN", text: "UN (Unidade)" }),
      element("option", { value: "KG", text: "KG (Quilo)" }),
      element("option", { value: "L", text: "L (Litro)" }),
      element("option", { value: "PCT", text: "PCT (Pacote)" }),
      element("option", { value: "CX", text: "CX (Caixa)" }),
      element("option", { value: "M", text: "M (Metro)" }),
      element("option", { value: "FD", text: "FD (Fardo)" }),
    ]);
    if (editingProduct?.saleUnit?.code || editingProduct?.unit) {
      unitSelect.value = editingProduct.saleUnit?.code || editingProduct.unit;
    }

    form.append(
      element("div", { class: "pe-row pe-row-3" }, [
        element("label", { class: "pe-label" }, [
          element("span", { text: "Preço de Venda (R$) *" }),
          priceInput,
        ]),
        element("label", { class: "pe-label" }, [
          element("span", { text: "Estoque Inicial" }),
          stockInput,
        ]),
        element("label", { class: "pe-label" }, [
          element("span", { text: "Unidade" }),
          unitSelect,
        ]),
      ]),
    );

    // Status selector
    const statusSelect = element("select", { name: "status" }, [
      element("option", { value: "ATIVO", text: "🟢 ATIVO (Visível e liberado para venda)" }),
      element("option", { value: "INATIVO", text: "🔴 INATIVO (Oculto / Bloqueado para venda)" }),
    ]);
    if (editingProduct?.status) {
      statusSelect.value = editingProduct.status;
    }
    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: "Status do Produto" }),
        statusSelect,
      ]),
    );

    // Image URL with live preview
    const imageInput = element("input", {
      type: "url",
      name: "imageUrl",
      placeholder: "https://... (URL da foto do produto)",
      value: editingProduct?.imageUrl || "",
    });
    const previewImg = element("img", {
      class: "pe-preview-img",
      src: editingProduct?.imageUrl || "/store-assets/placeholder.svg",
      alt: "Prévia da foto",
    });
    imageInput.addEventListener("input", () => {
      previewImg.src = imageInput.value.trim() || "/store-assets/placeholder.svg";
    });

    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: "Foto do Produto (URL)" }),
        element("div", { class: "pe-img-row" }, [imageInput, previewImg]),
      ]),
    );

    // Description
    const descTextarea = element("textarea", {
      name: "description",
      rows: "2",
      placeholder: "Breve descrição ou características do item...",
      value: editingProduct?.description || "",
    });
    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: "Descrição" }),
        descTextarea,
      ]),
    );

    // Tags
    const tagsVal = Array.isArray(editingProduct?.tags)
      ? editingProduct.tags.join(", ")
      : "";
    const tagsInput = element("input", {
      type: "text",
      name: "tags",
      placeholder: "palavras-chave separadas por vírgula (ex: premium, promoção)",
      value: tagsVal,
    });
    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: "Tags de busca" }),
        tagsInput,
      ]),
    );

    // Actions
    const submitBtn = element("button", {
      type: "submit",
      class: "primary pe-submit-btn",
      text: editingProduct ? "💾 Salvar Alterações" : "✅ Cadastrar Produto",
    });

    const buttonsRow = element("div", { class: "pe-actions-row" }, [submitBtn]);

    if (editingProduct) {
      const toggleStatusBtn = element("button", {
        type: "button",
        class: "quiet pe-toggle-btn",
        text:
          editingProduct.status === "INATIVO"
            ? "🟢 Reativar Produto"
            : "🔴 Desativar Produto",
        onclick: async () => {
          try {
            toggleStatusBtn.disabled = true;
            const target =
              editingProduct.status === "INATIVO" ? "ATIVO" : "INATIVO";
            await state.api(`/products/${editingProduct.id}/status`, {
              method: "PUT",
              body: { status: target },
            });
            notify(`Produto alterado para ${target}!`);
            dialog.close();
            if (onSaved) {await onSaved();}
          } catch (err) {
            notify("Erro: " + err.message);
          } finally {
            toggleStatusBtn.disabled = false;
          }
        },
      });
      buttonsRow.append(toggleStatusBtn);
    }

    form.append(buttonsRow);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = "Salvando...";

      try {
        const payload = {
          id: editingProduct?.id || undefined,
          name: nameInput.value.trim(),
          category: catInput.value.trim() || "Geral",
          subcategory: subcatInput.value.trim(),
          price: parseFloat(priceInput.value) || 0,
          stockQuantity: parseFloat(stockInput.value) || 0,
          unit: unitSelect.value,
          status: statusSelect.value,
          imageUrl: imageInput.value.trim(),
          description: descTextarea.value.trim(),
          tags: tagsInput.value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        };

        await state.api("/products", {
          method: "POST",
          body: payload,
        });

        notify("Produto salvo com sucesso no catálogo!");
        dialog.close();
        if (onSaved) {await onSaved();}
      } catch (err) {
        notify("Erro ao salvar produto: " + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingProduct
          ? "💾 Salvar Alterações"
          : "✅ Cadastrar Produto";
      }
    });

    content.append(form);
  }

  function renderQuickStockForm() {
    const form = element("form", { class: "pe-form" });

    const prodSelect = element("select", {
      name: "productId",
      required: "",
      class: "pe-select",
    });

    prodSelect.append(
      element("option", { value: "", text: "-- Selecione um produto --" }),
    );

    for (const p of state.products) {
      const stock = p.stock?.quantity ?? p.stockQuantity ?? 0;
      const unit = p.saleUnit?.code || p.unit || "UN";
      const statusNote = p.status === "INATIVO" ? " [INATIVO]" : "";
      prodSelect.append(
        element("option", {
          value: p.id,
          text: `${p.name} (Atual: ${stock} ${unit})${statusNote}`,
        }),
      );
    }

    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: "Produto para entrada *" }),
        prodSelect,
      ]),
    );

    const qtyInput = element("input", {
      type: "number",
      name: "quantityAdded",
      min: "1",
      step: "1",
      required: "",
      placeholder: "Ex: 10, 50, 100",
      value: "10",
    });

    // Preset buttons
    const presets = element("div", { class: "pe-presets" }, [
      ...[5, 10, 20, 50, 100].map((val) =>
        element("button", {
          type: "button",
          class: "pe-preset-btn",
          text: `+${val}`,
          onclick: () => {
            qtyInput.value = String((Number(qtyInput.value) || 0) + val);
          },
        }),
      ),
    ]);

    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: "Quantidade a Adicionar ao Estoque *" }),
        qtyInput,
        presets,
      ]),
    );

    const submitBtn = element("button", {
      type: "submit",
      class: "primary pe-submit-btn",
      text: "⚡ Confirmar Entrada de Estoque",
    });

    form.append(submitBtn);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!prodSelect.value) {
        notify("Selecione um produto.");
        return;
      }
      const qty = parseFloat(qtyInput.value) || 0;
      if (qty <= 0) {
        notify("Informe uma quantidade válida.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Atualizando estoque...";

      try {
        await state.api("/stock/quick-entry", {
          method: "POST",
          body: {
            productId: prodSelect.value,
            quantityAdded: qty,
          },
        });

        notify(`Entrada de +${qty} unidades realizada com sucesso!`);
        dialog.close();
        if (onSaved) {await onSaved();}
      } catch (err) {
        notify("Erro ao dar entrada no estoque: " + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "⚡ Confirmar Entrada de Estoque";
      }
    });

    content.append(form);
  }

  function open(product = null) {
    editingProduct = product;
    currentTab = "product";
    render();
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  // Bind trigger buttons if they exist
  const headerBtn = $("#openProductEntry");
  if (headerBtn) {
    headerBtn.addEventListener("click", () => open(null));
  }
  return { open, render };
}
