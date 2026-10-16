/* Shared product image component for the storefront and cashier. */
(() => {
  if (!customElements.get("render-image")) {
    class RenderImage extends HTMLElement {
    static get observedAttributes() {
      return ["src", "alt", "image-candidates", "fallback-src", "loading", "decoding", "class"];
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    render() {
      const sources = [
        this.getAttribute("src"),
        ...this.readCandidates(),
        this.getAttribute("fallback-src"),
        "/store-assets/placeholder.svg",
      ].filter((source, index, all) => source && all.indexOf(source) === index);

      this.replaceChildren();
      this.style.display = "block";
      this.style.minWidth = "0";
      this.style.minHeight = "0";
      const image = document.createElement("img");
      image.alt = this.getAttribute("alt") || "";
      image.loading = this.getAttribute("loading") || "lazy";
      image.decoding = this.getAttribute("decoding") || "async";
      image.className = this.getAttribute("class") || "";
      image.dataset.sourceIndex = "0";
      image.src = sources[0] || "/store-assets/placeholder.svg";
      image.addEventListener("error", () => {
        const nextIndex = Number(image.dataset.sourceIndex || 0) + 1;
        if (nextIndex >= sources.length) return;
        image.dataset.sourceIndex = String(nextIndex);
        image.src = sources[nextIndex];
      });
      this.append(image);
    }

    readCandidates() {
      try {
        const candidates = JSON.parse(this.getAttribute("image-candidates") || "[]");
        return Array.isArray(candidates)
          ? candidates.map((candidate) => typeof candidate === "string" ? candidate : candidate?.url || candidate?.imageUrl || candidate?.src || candidate?.downloadURL || "")
          : [];
      } catch {
        return [];
      }
    }
    }
    customElements.define("render-image", RenderImage);
  }

  const normalizeCategory = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const categoryIcon = (name) => {
    const value = normalizeCategory(name);
    if (value.includes("hortifrutti")) return "🍋";
    if (value.includes("frut")) return "🍋";
    if (value.includes("horta")) return "🥬";
    if (value.includes("pet") || value.includes("animal")) return "🐾";
    if (value.includes("planta") || value.includes("muda")) return "🌱";
    if (value.includes("outro")) return "🌿";
    if (value.includes("madeira") || value.includes("serragem") || value.includes("lenha")) return "🪵";
    if (value.includes("ferramenta") || value.includes("ferragem")) return "🛠️";
    if (value.includes("vaso")) return "🪴";
    if (value.includes("adubo") || value.includes("fertilizante") || value.includes("substrato")) return "🪱";
    return "🌿";
  };

  class RenderCategoryTag extends HTMLElement {
    static get observedAttributes() {
      return ["category", "icon", "class"];
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    render() {
      const category = (this.getAttribute("category") || "").trim();
      const icon = this.getAttribute("icon") || categoryIcon(category);
      const tag = document.createElement("span");
      tag.className = `cf-product-category-tag ${this.getAttribute("class") || ""}`.trim();
      tag.textContent = `${icon} ${category || "Produto"}`;
      this.style.display = "contents";
      this.replaceChildren(tag);
    }
  }

  if (!customElements.get("render-category-tag")) {
    customElements.define("render-category-tag", RenderCategoryTag);
  }
  window.ConfloraProductUi = Object.freeze({ categoryIcon, normalizeCategory });
})();
