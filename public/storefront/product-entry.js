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
        text: editingProduct ? 'edit_product_4c6c90'.tr : 'new_product_657bcd'.tr,
        onclick: () => {
          currentTab = "product";
          render();
        },
      }),
      element("button", {
        type: "button",
        class: `pe-tab-btn ${currentTab === "stock" ? "active" : ""}`,
        text: 'quick_stock_entry'.tr,
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
      placeholder: 'ex_golden_dog_food_15kg_ceramic_vase_polo_shirt'.tr,
      value: editingProduct?.name || "",
    });
    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: 'product_name'.tr }),
        nameInput,
      ]),
    );

    // Category and Subcategory row
    const catInput = element("input", {
      type: "text",
      name: "category",
      list: "categorySuggestions",
      placeholder: 'select_or_type_new_category'.tr,
      value: editingProduct?.categoryName || editingProduct?.category || "",
    });
    const subcatInput = element("input", {
      type: "text",
      name: "subcategory",
      placeholder: 'product_entry_subcategory'.tr,
      value: editingProduct?.subcategoryName || editingProduct?.subcategory || "",
    });

    form.append(
      element("div", { class: "pe-row" }, [
        element("label", { class: "pe-label" }, [
          element("span", { text: 'category'.tr }),
          catInput,
        ]),
        element("label", { class: "pe-label" }, [
          element("span", { text: 'subcategory'.tr }),
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
      element("option", { value: "UN", text: 'un_unit'.tr }),
      element("option", { value: "KG", text: 'kg_kilogram'.tr }),
      element("option", { value: "L", text: 'l_liter'.tr }),
      element("option", { value: "PCT", text: 'pkg_package'.tr }),
      element("option", { value: "CX", text: 'box_box'.tr }),
      element("option", { value: "M", text: 'm_meter'.tr }),
      element("option", { value: "FD", text: 'bale_bale'.tr }),
    ]);
    if (editingProduct?.saleUnit?.code || editingProduct?.unit) {
      unitSelect.value = editingProduct.saleUnit?.code || editingProduct.unit;
    }

    form.append(
      element("div", { class: "pe-row pe-row-3" }, [
        element("label", { class: "pe-label" }, [
          element("span", { text: 'selling_price'.tr }),
          priceInput,
        ]),
        element("label", { class: "pe-label" }, [
          element("span", { text: 'initial_stock'.tr }),
          stockInput,
        ]),
        element("label", { class: "pe-label" }, [
          element("span", { text: 'unit_208f2c'.tr }),
          unitSelect,
        ]),
      ]),
    );

    const advanced = element("details", { class: "pe-advanced" }, [element("summary", { text: "Mais opções: status, foto e descrição" })]);

    // Status selector
    const statusSelect = element("select", { name: "status" }, [
      element("option", { value: "ATIVO", text: 'active_visible_and_available_for_sale'.tr }),
      element("option", { value: "INATIVO", text: 'inactive_hidden_blocked_for_sale'.tr }),
    ]);
    if (editingProduct?.status) {
      statusSelect.value = editingProduct.status;
    }
    advanced.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: 'product_status'.tr }),
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
    const photoInput = element('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    const photoConfirmed = element('input', { type: 'checkbox' });
    if (state.existingStore) imageInput.hidden = true;
    const previewImg = element("img", {
      class: "pe-preview-img",
      src: editingProduct?.imageUrl || "/store-assets/placeholder.svg",
      alt: 'photo_preview'.tr,
    });
    imageInput.addEventListener("input", () => {
      previewImg.src = imageInput.value.trim() || "/store-assets/placeholder.svg";
    });

    advanced.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: 'product_photo_url'.tr }),
        element("div", { class: "pe-img-row" }, [state.existingStore ? photoInput : imageInput, previewImg]),
      ]),
    );
    if (state.existingStore) advanced.append(element('label', { class: 'pe-label' }, [photoConfirmed,
      document.createTextNode('Confirmo que esta é uma foto do produto real da Conflora, sem imagem de referência ou gerada.')]));

    // Description
    const descTextarea = element("textarea", {
      name: "description",
      rows: "2",
      placeholder: 'brief_description_or_item_features'.tr,
      value: editingProduct?.description || "",
    });
    advanced.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: 'description'.tr }),
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
      placeholder: 'keywords_separated_by_comma_e_g_premium_sale'.tr,
      value: tagsVal,
    });
    advanced.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: 'search_tags'.tr }),
        tagsInput,
      ]),
    );

    form.append(advanced);

    // Actions
    const submitBtn = element("button", {
      type: "submit",
      class: "primary pe-submit-btn",
      text: editingProduct ? 'save_changes'.tr : 'register_product_127061'.tr,
    });

    const buttonsRow = element("div", { class: "pe-actions-row" }, [submitBtn]);

    if (editingProduct) {
      const toggleStatusBtn = element("button", {
        type: "button",
        class: "quiet pe-toggle-btn",
        text:
          editingProduct.status === "INATIVO"
            ? 'reactivate_product'.tr
            : 'deactivate_product'.tr,
        onclick: async () => {
          try {
            toggleStatusBtn.disabled = true;
            const target =
              editingProduct.status === "INATIVO" ? "ATIVO" : "INATIVO";
            await state.api(`/products/${editingProduct.id}/status`, {
              method: "PUT",
              body: { status: target },
            });
            notify(`${'product_changed_to'.tr} ${target}!`);
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
      submitBtn.textContent = 'product_entry_saving'.tr;

      try {
        const photo = state.existingStore ? photoInput.files?.[0] : null;
        if (photo && !photoConfirmed.checked) throw new Error('Confirme a origem da foto real antes de enviar.');
        if (photo && photo.size > 20 * 1024 * 1024) throw new Error('A foto deve ter até 20 MB.');
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

        const saved = await state.api("/products", {
          method: "POST",
          body: payload,
        });
        // The Conflora upload endpoint stores bytes in Storage and references in
        // Firestore. Other tenants retain their own independent API contract.
        if (photo) {
          editingProduct = { ...payload, id: saved.id };
          const response = await window.ConfloraSession.apiFetch('/api/admin/products/' + encodeURIComponent(saved.id) + '/photo', {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Photo-Content-Type': photo.type,
              'X-Photo-Actual-Product': 'true' }, body: photo,
          });
          const result = await response.json();
          if (!response.ok) throw new Error('Produto salvo, mas a foto não foi enviada: ' + (result.error || 'tente novamente.'));
        }

        notify('product_successfully_saved_to_catalog'.tr);
        dialog.close();
        if (onSaved) {await onSaved();}
      } catch (err) {
        notify("Erro ao salvar produto: " + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingProduct
          ? 'save_changes'.tr
          : 'register_product_127061'.tr;
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
        element("span", { text: 'product_for_stock_entry'.tr }),
        prodSelect,
      ]),
    );

    const qtyInput = element("input", {
      type: "number",
      name: "quantityAdded",
      min: "1",
      step: "1",
      required: "",
      placeholder: 'ex_10_50_100'.tr,
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
        element("span", { text: 'quantity_to_add_to_stock'.tr }),
        qtyInput,
        presets,
      ]),
    );

    const submitBtn = element("button", {
      type: "submit",
      class: "primary pe-submit-btn",
      text: 'confirm_stock_entry'.tr,
    });

    form.append(submitBtn);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!prodSelect.value) {
        notify('select_a_product'.tr);
        return;
      }
      const qty = parseFloat(qtyInput.value) || 0;
      if (qty <= 0) {
        notify('enter_a_valid_quantity'.tr);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'updating_stock'.tr;

      try {
        await state.api("/stock/quick-entry", {
          method: "POST",
          body: {
            productId: prodSelect.value,
            quantityAdded: qty,
          },
        });

        notify(`${'entry_of'.tr}${qty} ${'units_successfully_completed'.tr}`);
        dialog.close();
        if (onSaved) {await onSaved();}
      } catch (err) {
        notify("Erro ao dar entrada no estoque: " + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'confirm_stock_entry'.tr;
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
  // The shared shell owns the trigger, including the first lazy import.
  return { open, render };
}
