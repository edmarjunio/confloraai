/* Shared category identity, filters and badges. Loaded before product media/cards. */
(() => {
  const normalize = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const palette = Object.freeze({
    green: ['#15803d', '#dcfce7', '#ffffff'],
    forest: ['#0f381e', '#e8f5eb', '#ffffff'],
    yellow: ['#a66d00', '#fff8df', '#ffffff'],
    orange: ['#bd5a12', '#fff3e9', '#ffffff'],
    blue: ['#28669e', '#edf5ff', '#ffffff'],
    rose: ['#be123c', '#fff1f2', '#ffffff'],
    slate: ['#475569', '#f1f5f9', '#ffffff'],
  });
  const paths = {
    grid: ['M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z'],
    fruit: ['M12 8c-8-5-12 5-6 12 2 2 4 1 6 1s4 1 6-1c6-7 2-17-6-12Z', 'M12 8V5m0 0c0-3 3-4 6-3 0 3-3 5-6 3Z'],
    sprout: ['M12 22V12', 'M12 15C4 15 2 10 3 5c6 0 9 4 9 10Z', 'M12 12c0-6 3-9 9-9 1 5-2 9-9 9Z'],
    paw: ['M8 14c-2 3-3 7 0 7 2 0 2-1 4-1s2 1 4 1c3 0 2-4 0-7-2-3-6-3-8 0Z', 'M6 10a2 3 0 1 0-4 0 2 3 0 0 0 4 0M22 10a2 3 0 1 0-4 0 2 3 0 0 0 4 0', 'M11 5a2 3 0 1 0-4 0 2 3 0 0 0 4 0M17 5a2 3 0 1 0-4 0 2 3 0 0 0 4 0'],
    leaf: ['M20 3C8 2 2 8 5 16c8 5 16-1 15-13Z', 'M4 21 16 8'],
    heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z'],
    box: ['m12 3 9 5-9 5-9-5 9-5Z', 'M3 8v9l9 5 9-5V8', 'M12 13v9'],
  };
  function appearance(name, kind) {
    const value = normalize(name);
    let tone, symbol;
    if (kind === 'favorites') [tone, symbol] = ['rose', 'heart'];
    else if (kind === 'purchases') [tone, symbol] = ['green', 'box'];
    else if (kind === 'all') [tone, symbol] = ['slate', 'grid'];
    else if (value.includes('frutifer')) [tone, symbol] = ['yellow', 'fruit'];
    else if (value.includes('hortifrut')) [tone, symbol] = ['orange', 'fruit'];
    else if (value.includes('horta')) [tone, symbol] = ['green', 'sprout'];
    else if (value.includes('pet') || value.includes('animal')) [tone, symbol] = ['blue', 'paw'];
    else if (value.includes('planta') || value.includes('muda')) [tone, symbol] = ['forest', 'leaf'];
    else if (value.includes('outro')) [tone, symbol] = ['slate', 'box'];
    else {
      const tones = ['green', 'yellow', 'orange', 'blue', 'rose', 'forest'];
      const hash = Array.from(value).reduce((sum, char) => (sum * 31 + char.codePointAt(0)) >>> 0, 0);
      [tone, symbol] = [tones[hash % tones.length], 'box'];
    }
    const [strong, soft, foreground] = palette[tone];
    return { tone, symbol, strong, soft, foreground };
  }
  function toggleSelection(selected, id) {
    return selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
  }
  function matchesAny(selected, predicate) {
    return selected.length === 0 || selected.some(predicate);
  }
  const style = document.createElement('style');
  style.id = 'cf-category-ui-styles';
  style.textContent = `
    .cf-category-chip.category-chip, .cf-category-tag.cf-product-category-tag {
      color:var(--category-strong); background:var(--category-soft);
      border:1.5px solid var(--category-strong); border-radius:999px;
    }
    .cf-category-chip.category-chip {
      display:inline-flex; align-items:center; justify-content:center; gap:7px;
      flex-shrink:0; min-height:38px; padding:7px 13px; font:inherit;
      font-size:12px; font-weight:800; cursor:pointer;
      box-shadow:0 2px 0 var(--category-strong);
      transition:background-color 150ms ease,color 150ms ease,transform 150ms ease;
    }
    .cf-category-chip.category-chip:hover:not(:disabled) {
      background:var(--category-soft); border-color:var(--category-strong);
      box-shadow:0 3px 0 var(--category-strong); transform:translateY(-1px);
    }
    .cf-category-chip.category-chip[aria-pressed="true"],
    .cf-category-chip.category-chip[aria-pressed="true"]:hover,
    .cf-category-tag.cf-product-category-tag {
      color:var(--category-foreground); background:var(--category-strong);
      border-color:var(--category-strong);
    }
    .cf-category-chip.category-chip:active { transform:translateY(1px); box-shadow:0 1px 0 var(--category-strong); }
    .cf-category-chip.category-chip:focus-visible { outline:3px solid var(--category-strong); outline-offset:3px; }
    .cf-category-chip.category-chip.cf-category-clear { width:38px; min-width:38px; padding:7px; gap:0; }
    .cf-category-tag.cf-product-category-tag { gap:4px; }
    .cf-category-icon { display:inline-flex; align-items:center; justify-content:center; flex:none; line-height:0; }
    .cf-category-icon > svg { display:block; width:16px; height:16px; flex:none; }
    .cf-category-tag .cf-category-icon > svg { width:11px; height:11px; }
    @media(prefers-reduced-motion:reduce) { .cf-category-chip.category-chip { transition:none; } }
  `;
  document.head.append(style);

  class RenderCategoryTag extends HTMLElement {
    static get observedAttributes() { return ['category', 'color-category', 'variant', 'selected', 'kind', 'class']; }
    connectedCallback() {
      this.onLanguageChange ||= () => this.render();
      window.addEventListener('conflora-lang-change', this.onLanguageChange);
      this.render();
    }
    disconnectedCallback() { window.removeEventListener('conflora-lang-change', this.onLanguageChange); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    render() {
      const category = this.getAttribute('category') || 'Produto';
      const labelText = category.tr || category;
      const filter = ['filter', 'action'].includes(this.getAttribute('variant'));
      const action = this.getAttribute('variant') === 'action';
      const selected = this.getAttribute('selected') === 'true';
      const theme = appearance(this.getAttribute('color-category') || category, this.getAttribute('kind'));
      const tagName = filter ? 'button' : 'span';
      // Preserve the focused native button while React updates selection.
      let tag = this.firstElementChild;
      if (!tag || tag.localName !== tagName) { tag = document.createElement(tagName); this.replaceChildren(tag); }
      tag.className = filter ? `category-chip cf-category-chip${selected ? ' is-active' : ''}`
        : `cf-product-category-tag cf-category-tag ${this.getAttribute('class') || ''}`.trim();
      tag.classList.toggle('cf-category-clear', action);
      if (action) tag.setAttribute('aria-label', labelText);
      else tag.removeAttribute('aria-label');
      tag.dataset.categoryTone = theme.tone;
      tag.style.setProperty('--category-strong', theme.strong);
      tag.style.setProperty('--category-soft', theme.soft);
      tag.style.setProperty('--category-foreground', theme.foreground);
      tag.title = labelText;
      if (filter) {
        tag.type = 'button';
        if (action) tag.removeAttribute('aria-pressed');
        else tag.setAttribute('aria-pressed', String(selected));
      }
      const icon = document.createElement('span');
      icon.className = 'cf-category-icon';
      icon.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'cf-category-svg');
      for (const [key, value] of Object.entries({ viewBox:'0 0 24 24', width:'16', height:'16', fill:'none', stroke:'currentColor', 'stroke-width':'1.8', 'stroke-linecap':'round', 'stroke-linejoin':'round' })) svg.setAttribute(key, value);
      for (const d of action ? ['M6 6l12 12M18 6 6 18'] : paths[theme.symbol]) { const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); svg.append(path); }
      icon.append(svg);
      const label = document.createElement('span');
      label.className = filter ? 'category-chip-label' : 'cf-product-category-tag-label';
      label.textContent = labelText;
      tag.replaceChildren(...(action ? [icon] : [icon, label]));
      this.style.display = 'contents';
    }
  }
  customElements.define('render-category-tag', RenderCategoryTag);
  window.ConfloraCategoryUi = Object.freeze({ appearance, normalize, toggleSelection, matchesAny });
})();
