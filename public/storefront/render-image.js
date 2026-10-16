/* Shared product media components for the storefront and cashier. */
(() => {
  const normalizeCategory = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const categoryIcon = (name) => {
    const category = normalizeCategory(name);
    if (category.includes("hortifrutti") || category.includes("frut")) return "🍋";
    if (category.includes("horta")) return "🥬";
    if (category.includes("pet") || category.includes("animal")) return "🐾";
    if (category.includes("planta") || category.includes("muda")) return "🌱";
    if (category.includes("madeira") || category.includes("serragem") || category.includes("lenha")) return "🪵";
    if (category.includes("ferramenta") || category.includes("ferragem")) return "🛠️";
    if (category.includes("vaso")) return "🪴";
    if (category.includes("adubo") || category.includes("fertilizante") || category.includes("substrato")) return "🪱";
    return "🌿";
  };

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

      readCandidates() {
        try {
          const candidates = JSON.parse(this.getAttribute("image-candidates") || "[]");
          if (!Array.isArray(candidates)) return [];
          return candidates.map((candidate) => typeof candidate === "string"
            ? candidate
            : candidate?.url || candidate?.imageUrl || candidate?.src || candidate?.downloadURL || "");
        } catch {
          return [];
        }
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
        this.style.overflow = "hidden";

        const image = document.createElement("img");
        image.alt = this.getAttribute("alt") || "";
        image.loading = this.getAttribute("loading") || "lazy";
        image.decoding = this.getAttribute("decoding") || "async";
        image.className = this.getAttribute("class") || "";
        image.style.display = "block";
        image.style.width = "100%";
        image.style.height = "100%";
        image.style.minWidth = "0";
        image.style.minHeight = "0";
        image.style.objectFit = "cover";
        image.style.objectPosition = "center";
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
    }

    customElements.define("render-image", RenderImage);
  }

  if (!customElements.get("render-category-tag")) {
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

    customElements.define("render-category-tag", RenderCategoryTag);
  }

  window.ConfloraProductUi = Object.freeze({ categoryIcon, normalizeCategory });
})();
