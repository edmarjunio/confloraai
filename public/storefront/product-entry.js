import { $, element, notify } from "./ui.js";
import { tr, onLanguageChange } from "./i18n/index.js";
import { queryClient } from "./query/tanstackQuery.js";

export function createProductEntry(state, onSaved) {
  const dialog = $("#productEntryDialog");
  const content = $("#productEntryContent");
  let currentTab = "product"; // "product" | "stock"
  let editingProduct = null;

  onLanguageChange(() => {
    if (dialog && dialog.hasAttribute("open")) {
      render();
    }
  });

  function render() {
    if (!dialog || !content) {
      return;
    }
    content.replaceChildren();

    // Tabs
    const tabsContainer = element("div", { class: "pe-tabs" }, [
      element("button", {
        type: "button",
        class: `pe-tab-btn ${currentTab === "product" ? "active" : ""}`,
        text: editingProduct
          ? tr("product_entry.edit_title", { name: editingProduct.name })
          : `+ ${"product_entry.new_title".tr}`,
        onclick: () => {
          currentTab = "product";
          render();
        },
      }),
      element("button", {
        type: "button",
        class: `pe-tab-btn ${currentTab === "stock" ? "active" : ""}`,
        text: `⚡ ${"catalog.quick_stock".tr}`,
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
      placeholder: "product_entry.name".tr,
      value: editingProduct?.name || "",
    });
    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: `${"product_entry.name".tr} *` }),
        nameInput,
      ]),
    );

    // Category and Subcategory row
    const catInput = element("input", {
      type: "text",
      name: "category",
      list: "categorySuggestions",
      placeholder: "product_entry.category".tr,
      value: editingProduct?.categoryName || editingProduct?.category || "",
    });
    const subcatInput = element("input", {
      type: "text",
      name: "subcategory",
      placeholder: "product_entry.subcategory".tr,
      value: editingProduct?.subcategoryName || editingProduct?.subcategory || "",
    });

    form.append(
      element("div", { class: "pe-row" }, [
        element("label", { class: "pe-label" }, [
          element("span", { text: `${"product_entry.category".tr} *` }),
          catInput,
        ]),
        element("label", { class: "pe-label" }, [
          element("span", { text: "product_entry.subcategory".tr }),
          subcatInput,
        ]),
      ]),
    );

    // Pricing Row (Venda e Custo)
    const priceVal = editingProduct?.price?.amountMinor !== undefined
      ? (editingProduct.price.amountMinor / 100).toFixed(2)
      : (Number(editingProduct?.price || 0)).toFixed(2);

    const priceInput = element("input", {
      type: "number",
      name: "price",
      step: "0.01",
      min: "0.01",
      required: "",
      placeholder: "0.00",
      value: priceVal > 0 ? priceVal : "",
    });

    const costInput = element("input", {
      type: "number",
      name: "cost",
      step: "0.01",
      min: "0",
      placeholder: "0.00",
      value: editingProduct?.cost || editingProduct?.preco_custo || "",
    });

    form.append(
      element("div", { class: "pe-row" }, [
        element("label", { class: "pe-label" }, [
          element("span", { text: `${"product_entry.price".tr} *` }),
          priceInput,
        ]),
        element("label", { class: "pe-label" }, [
          element("span", { text: "product_entry.cost".tr }),
          costInput,
        ]),
      ]),
    );

    // Stock and Unit Row
    const stockInput = element("input", {
      type: "number",
      name: "stock",
      min: "0",
      step: "1",
      placeholder: "0",
      value: editingProduct?.stock?.quantity ?? (editingProduct?.estoque ?? "10"),
    });

    const unitSelect = element("select", { name: "unit" }, [
      element("option", { value: "UN", text: "UN - Unidade" }),
      element("option", { value: "VASO", text: "VASO - Vaso / Pote" }),
      element("option", { value: "KG", text: "KG - Quilo" }),
      element("option", { value: "MUDA", text: "MUDA - Muda" }),
      element("option", { value: "PACOTE", text: "PCT - Pacote" }),
      element("option", { value: "SACO", text: "SACO - Saco" }),
      element("option", { value: "BANDEJA", text: "BDJ - Bandeja" }),
    ]);
    if (editingProduct?.saleUnit?.code) {
      unitSelect.value = editingProduct.saleUnit.code;
    }

    form.append(
      element("div", { class: "pe-row" }, [
        element("label", { class: "pe-label" }, [
          element("span", { text: "product_entry.stock".tr }),
          stockInput,
        ]),
        element("label", { class: "pe-label" }, [
          element("span", { text: "product_entry.unit".tr }),
          unitSelect,
        ]),
      ]),
    );

    // Image URL
    const imageInput = element("input", {
      type: "url",
      name: "imageUrl",
      placeholder: "https://...",
      value: editingProduct?.imageUrl || "",
    });
    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: "product_entry.image_url".tr }),
        imageInput,
      ]),
    );

    // Description
    const descInput = element("textarea", {
      name: "description",
      rows: "3",
      placeholder: "product_entry.description".tr,
      text: editingProduct?.description || editingProduct?.descriptionAi || "",
    });
    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: "product_entry.description".tr }),
        descInput,
      ]),
    );

    // Care tips and ideal env
    const careInput = element("input", {
      type: "text",
      name: "cuidados_basicos",
      placeholder: "product.care_tips".tr,
      value: editingProduct?.cuidados_basicos || "",
    });
    const envInput = element("input", {
      type: "text",
      name: "ambiente_ideal",
      placeholder: "product.ideal_env".tr,
      value: editingProduct?.ambiente_ideal || "",
    });
    form.append(
      element("div", { class: "pe-row" }, [
        element("label", { class: "pe-label" }, [
          element("span", { text: "product.care_tips".tr }),
          careInput,
        ]),
        element("label", { class: "pe-label" }, [
          element("span", { text: "product.ideal_env".tr }),
          envInput,
        ]),
      ]),
    );

    // Submit and Cancel buttons
    const submitBtn = element("button", {
      type: "submit",
      class: "primary pe-submit-btn",
      text: editingProduct ? "common.save".tr : "product_entry.save".tr,
    });
    const cancelBtn = element("button", {
      type: "button",
      class: "quiet",
      text: "common.cancel".tr,
      onclick: () => dialog.close(),
    });

    form.append(
      element("div", { class: "pe-actions" }, [cancelBtn, submitBtn]),
    );

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const category = catInput.value.trim();
      const subcategory = subcatInput.value.trim();
      const price = parseFloat(priceInput.value) || 0;
      const cost = parseFloat(costInput.value) || 0;
      const stock = parseInt(stockInput.value, 10) || 0;
      const unit = unitSelect.value || "UN";
      const imageUrl = imageInput.value.trim();
      const description = descInput.value.trim();
      const cuidados = careInput.value.trim();
      const ambiente = envInput.value.trim();

      if (!name || !category || price <= 0) {
        notify("common.required_fields".tr);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "product_entry.saving".tr;

      const payload = {
        id: editingProduct?.id || `prod_${Date.now()}`,
        name,
        category,
        categoryName: category,
        subcategory,
        subcategoryName: subcategory,
        price,
        cost,
        stock: { quantity: stock, tracked: true },
        unit,
        imageUrl,
        description,
        cuidados_basicos: cuidados,
        ambiente_ideal: ambiente,
      };

      try {
        await state.api("/admin/products", {
          method: "POST",
          body: payload,
        });

        // Invalidate TanStack Query catalog cache
        queryClient.invalidateQueries({ queryKey: ["catalog"] });

        notify("product_entry.success".tr);
        dialog.close();
        if (onSaved) {
          await onSaved();
        }
      } catch (err) {
        notify(`${"common.error".tr}: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingProduct ? "common.save".tr : "product_entry.save".tr;
      }
    });

    content.append(form);
  }

  function renderQuickStockForm() {
    const form = element("form", { class: "pe-form" });

    // Select Product
    const prodSelect = element("select", { name: "productId", required: "" }, [
      element("option", { value: "", text: "Selecione o produto..." }),
      ...state.products.map((p) =>
        element("option", {
          value: p.id,
          text: `${p.name} (Atual: ${p.stock?.quantity ?? 0} ${p.saleUnit?.code || "UN"})`,
          selected: editingProduct?.id === p.id,
        }),
      ),
    ]);

    form.append(
      element("label", { class: "pe-label" }, [
        element("span", { text: `${"product_entry.name".tr} *` }),
        prodSelect,
      ]),
    );

    // Quantity Input
    const qtyInput = element("input", {
      type: "number",
      name: "quantityAdded",
      min: "1",
      step: "1",
      required: "",
      placeholder: "10",
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
        element("span", { text: `${"catalog.quick_stock".tr} *` }),
        qtyInput,
        presets,
      ]),
    );

    const submitBtn = element("button", {
      type: "submit",
      class: "primary pe-submit-btn",
      text: `⚡ ${"catalog.quick_stock".tr}`,
    });

    form.append(submitBtn);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!prodSelect.value) {
        notify("common.required_fields".tr);
        return;
      }
      const qty = parseFloat(qtyInput.value) || 0;
      if (qty <= 0) {
        notify("common.required_fields".tr);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "common.loading".tr;

      try {
        await state.api("/stock/quick-entry", {
          method: "POST",
          body: {
            productId: prodSelect.value,
            quantityAdded: qty,
          },
        });

        queryClient.invalidateQueries({ queryKey: ["catalog"] });
        notify(`+${qty} ${"catalog.in_stock".tr}`);
        dialog.close();
        if (onSaved) {
          await onSaved();
        }
      } catch (err) {
        notify(`${"common.error".tr}: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = `⚡ ${"catalog.quick_stock".tr}`;
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

  return { open, render };
}
