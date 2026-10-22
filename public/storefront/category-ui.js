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
  const cartoonIcons = Object.freeze({
    grid: `
      <rect x="2.5" y="2.5" width="8" height="8" rx="2.5" fill="#22c55e" stroke="#0f172a" stroke-width="1.6"/>
      <path d="M4.2 4.5h3.5" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
      <rect x="13.5" y="2.5" width="8" height="8" rx="2.5" fill="#facc15" stroke="#0f172a" stroke-width="1.6"/>
      <path d="M15.2 4.5h3.5" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
      <rect x="2.5" y="13.5" width="8" height="8" rx="2.5" fill="#fb923c" stroke="#0f172a" stroke-width="1.6"/>
      <path d="M4.2 15.5h3.5" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
      <rect x="13.5" y="13.5" width="8" height="8" rx="2.5" fill="#38bdf8" stroke="#0f172a" stroke-width="1.6"/>
      <path d="M15.2 15.5h3.5" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
    `,
    clear: `
      <circle cx="12" cy="12" r="9.5" fill="#fca5a5" stroke="#0f172a" stroke-width="1.6"/>
      <circle cx="12" cy="11.3" r="8.2" fill="#ef4444"/>
      <path d="M6.8 6.5a6.5 6.5 0 0 1 6.5-1.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <path d="M9 9l6 6M15 9l-6 6" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
    `,
    heart: `
      <path d="M12 20.8C12 20.8 3.5 15.2 3.5 8.9A4.9 4.9 0 0 1 12 5.8a4.9 4.9 0 0 1 8.5 3.1c0 6.3-8.5 11.9-8.5 11.9Z" fill="#fb7185" stroke="#0f172a" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M12 19.3C12 19.3 5 14.4 5 8.9a3.5 3.5 0 0 1 6.2-2.2L12 7.6l.8-.9A3.5 3.5 0 0 1 19 8.9c0 5.5-7 10.4-7 10.4Z" fill="#f43f5e"/>
      <path d="M6.8 8.2a2.2 2.2 0 0 1 2.4-1.6" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    `,
    fruit: `
      <path d="M12 6.5V3.2" stroke="#78350f" stroke-width="2" stroke-linecap="round"/>
      <path d="M12.2 4.2c2.2-2.2 5.5-1.8 6.3.6-2.2 1.8-4.8 1.4-6.3-.6Z" fill="#22c55e" stroke="#0f172a" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="12" cy="13.5" r="7.5" fill="#facc15" stroke="#0f172a" stroke-width="1.7"/>
      <path d="M12 6a7.5 7.5 0 0 1 6.2 11.7A7.5 7.5 0 1 1 6.5 8.4" fill="#eab308"/>
      <path d="M8.2 10.2a4.5 4.5 0 0 1 3.2-2.2" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" fill="none"/>
    `,
    veggie: `
      <path d="M9.5 5.5c-.8-2.2.5-3.5 2.5-3 1.5-1.2 3.5 0 2.5 2.2 2 .4 2.2 2.4.2 3.1" fill="#22c55e" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8.2 7.5h7.6c1.6 0 2.6 1.8 1.9 3.4l-4.2 9.2c-.6 1.3-2.4 1.3-3 0L6.3 10.9c-.7-1.6.3-3.4 1.9-3.4Z" fill="#fb923c" stroke="#0f172a" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M9.2 10.2h2.6M11.5 13.5h2.4M10.2 16.5h1.8" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
    `,
    sprout: `
      <path d="M7 15.5h10l-1.3 5.2a1.5 1.5 0 0 1-1.4 1.1H9.7a1.5 1.5 0 0 1-1.4-1.1L7 15.5Z" fill="#d97706" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/>
      <rect x="5.8" y="13.2" width="12.4" height="3" rx="1.4" fill="#f59e0b" stroke="#0f172a" stroke-width="1.6"/>
      <path d="M12 13.2V7.5" stroke="#15803d" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M12 10.5C6.8 10.5 4.5 7 5.5 3.5c4.2 0 6.5 2.5 6.5 7Z" fill="#4ade80" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M12 9.2c0-4.2 2.3-6.5 6.5-6.5 1 3.5-1.3 6.5-6.5 6.5Z" fill="#22c55e" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M7.4 5.5c1.2.2 2.2.8 2.8 1.8" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    `,
    paw: `
      <ellipse cx="6" cy="9.5" rx="2.2" ry="2.8" fill="#38bdf8" stroke="#0f172a" stroke-width="1.6"/>
      <ellipse cx="18" cy="9.5" rx="2.2" ry="2.8" fill="#38bdf8" stroke="#0f172a" stroke-width="1.6"/>
      <ellipse cx="9.6" cy="5.5" rx="2.2" ry="2.8" fill="#38bdf8" stroke="#0f172a" stroke-width="1.6"/>
      <ellipse cx="14.4" cy="5.5" rx="2.2" ry="2.8" fill="#38bdf8" stroke="#0f172a" stroke-width="1.6"/>
      <path d="M7.5 15c-1.8 2.4-2.2 5.5.8 5.5 1.8 0 2.1-.8 3.7-.8s1.9.8 3.7.8c3 0 2.6-3.1.8-5.5-2.1-2.8-6.9-2.8-9 0Z" fill="#0ea5e9" stroke="#0f172a" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M9.5 14.5a3.5 2.2 0 0 1 4.2 0" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    `,
    flower: `
      <circle cx="12" cy="6" r="3.4" fill="#fb7185" stroke="#0f172a" stroke-width="1.5"/>
      <circle cx="17.5" cy="10" r="3.4" fill="#f43f5e" stroke="#0f172a" stroke-width="1.5"/>
      <circle cx="15.5" cy="16.5" r="3.4" fill="#fb7185" stroke="#0f172a" stroke-width="1.5"/>
      <circle cx="8.5" cy="16.5" r="3.4" fill="#f43f5e" stroke="#0f172a" stroke-width="1.5"/>
      <circle cx="6.5" cy="10" r="3.4" fill="#fb7185" stroke="#0f172a" stroke-width="1.5"/>
      <circle cx="12" cy="11.5" r="3.6" fill="#facc15" stroke="#0f172a" stroke-width="1.6"/>
      <path d="M10.8 10.2a1.6 1.6 0 0 1 2-.4" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    `,
    leaf: `
      <path d="M19.5 3.5C9 2.5 3.5 8 5.5 16.5c7.5 4.5 15-1 14-13Z" fill="#22c55e" stroke="#0f172a" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M19.5 3.5C13 9 9.5 13 5.5 16.5c7.5 4.5 15-1 14-13Z" fill="#16a34a"/>
      <path d="M4.5 20.5 15.5 8.5" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M8.5 8.5c2-1.8 4.8-2.6 7.5-2.6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    `,
    box: `
      <path d="M12 2.8 20.5 7.5v9L12 21.2 3.5 16.5v-9L12 2.8Z" fill="#fbbf24" stroke="#0f172a" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M3.5 7.5 12 12.2l8.5-4.7" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
      <path d="M12 12.2v9L20.5 16.5v-9L12 12.2Z" fill="#f59e0b" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M7.5 6.2 12 3.8l4.5 2.4" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    `,
  });
  function appearance(name, kind) {
    const value = normalize(name);
    let tone, symbol;
    if (kind === 'favorites') [tone, symbol] = ['rose', 'heart'];
    else if (kind === 'purchases') [tone, symbol] = ['green', 'box'];
    else if (kind === 'all') [tone, symbol] = ['forest', 'grid'];
    else if (value.includes('limpar')) [tone, symbol] = ['rose', 'clear'];
    else if (value.includes('frutifer') || value.includes('citric')) [tone, symbol] = ['yellow', 'fruit'];
    else if (value.includes('hortifrut') || value.includes('legum') || value.includes('verdur')) [tone, symbol] = ['orange', 'veggie'];
    else if (value.includes('horta') || value.includes('temper') || value.includes('erva')) [tone, symbol] = ['green', 'sprout'];
    else if (value.includes('pet') || value.includes('animal') || value.includes('raco') || value.includes('racao')) [tone, symbol] = ['blue', 'paw'];
    else if (value.includes('flor') || value.includes('ornament') || value.includes('orquid') || value.includes('rosa')) [tone, symbol] = ['rose', 'flower'];
    else if (value.includes('planta') || value.includes('muda') || value.includes('folha') || value.includes('palmeir') || value.includes('sombra') || value.includes('sol') || value.includes('suculent') || value.includes('cact')) [tone, symbol] = ['forest', 'leaf'];
    else if (value.includes('outro')) [tone, symbol] = ['slate', 'box'];
    else {
      const tones = ['green', 'yellow', 'orange', 'blue', 'rose', 'forest'];
      const symbols = ['sprout', 'fruit', 'veggie', 'paw', 'flower', 'leaf'];
      const hash = Array.from(value).reduce((sum, char) => (sum * 31 + char.codePointAt(0)) >>> 0, 0);
      const idx = hash % tones.length;
      [tone, symbol] = [tones[idx], symbols[idx]];
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
      display:inline-flex; align-items:center; justify-content:center; gap:6px;
      flex-shrink:0; min-height:38px; padding:6px 12px; font:inherit;
      font-size:12px; font-weight:800; cursor:pointer;
      box-shadow:0 3px 0 var(--category-strong), 0 3px 6px rgba(15, 23, 42, 0.12);
      transition:background-color 150ms ease,color 150ms ease,transform 150ms ease,box-shadow 150ms ease;
    }
    .cf-category-chip.category-chip:not(.is-active):not([aria-pressed="true"]):hover:not(:disabled) {
      background:var(--category-soft); border-color:var(--category-strong);
      box-shadow:0 4px 0 var(--category-strong), 0 5px 10px rgba(15, 23, 42, 0.16); transform:translateY(-1px);
    }
    .cf-category-chip.category-chip[aria-pressed="true"],
    .cf-category-chip.category-chip[aria-pressed="true"]:hover,
    .cf-category-chip.category-chip.is-active,
    .cf-category-chip.category-chip.is-active:hover,
    .cf-category-tag.cf-product-category-tag {
      color:var(--category-foreground) !important; background:var(--category-strong) !important;
      border-color:var(--category-strong) !important;
    }
    .cf-category-chip.category-chip:active { transform:translateY(1px); box-shadow:0 1px 0 var(--category-strong); }
    .cf-category-chip.category-chip:focus-visible { outline:3px solid var(--category-strong); outline-offset:3px; }
    .cf-category-chip.category-chip.cf-category-clear {
      padding: 6px 14px;
      gap: 7px;
      border-radius: 999px;
      font-weight: 700;
      white-space: nowrap;
    }
    .cf-category-chip.category-chip.cf-category-icon-only { width:38px; min-width:38px; height:38px; min-height:38px; padding:0; gap:0; border-radius:999px; }
    .cf-category-tag.cf-product-category-tag { gap:4px; }
    .cf-category-icon { display:inline-flex; align-items:center; justify-content:center; flex:none; line-height:0; filter:drop-shadow(0 1.5px 0 rgba(15, 23, 42, 0.28)); }
    .cf-category-icon > svg { display:block; width:18px; height:18px; flex:none; overflow:visible; }
    .cf-category-tag .cf-category-icon > svg { width:12px; height:12px; }
    .cf-drag-scroll, .catalog-category-filter {
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
    }
    .cf-drag-scroll.is-dragging, .catalog-category-filter.is-dragging {
      cursor: grabbing !important;
      scroll-behavior: auto !important;
    }
    .cf-drag-scroll.is-dragging *, .catalog-category-filter.is-dragging * {
      cursor: grabbing !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      pointer-events: none !important;
    }
    body.cf-dragging-active {
      cursor: grabbing !important;
      user-select: none !important;
      -webkit-user-select: none !important;
    }
    @media(prefers-reduced-motion:reduce) { .cf-category-chip.category-chip { transition:none; } }
  `;
  document.head.append(style);

  class RenderCategoryTag extends HTMLElement {
    static get observedAttributes() { return ['category', 'color-category', 'variant', 'selected', 'kind', 'class', 'hide-label']; }
    connectedCallback() {
      this.onLanguageChange ||= () => this.render();
      window.addEventListener('conflora-lang-change', this.onLanguageChange);
      this.render();
    }
    disconnectedCallback() { window.removeEventListener('conflora-lang-change', this.onLanguageChange); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    render() {
      const category = this.getAttribute('category') || '';
      const labelText = category.tr || category;
      const filter = ['filter', 'action'].includes(this.getAttribute('variant'));
      const action = this.getAttribute('variant') === 'action';
      const selected = this.getAttribute('selected') === 'true';
      const kind = this.getAttribute('kind');
      const hideLabel = this.getAttribute('hide-label') === 'true' || kind === 'all' || !labelText;
      const theme = appearance(this.getAttribute('color-category') || category || 'todas', kind);
      const tagName = filter ? 'button' : 'span';
      // Preserve the focused native button while React updates selection.
      let tag = this.firstElementChild;
      if (!tag || tag.localName !== tagName) { tag = document.createElement(tagName); this.replaceChildren(tag); }
      tag.className = filter ? `category-chip cf-category-chip${selected ? ' is-active' : ''}`
        : `cf-product-category-tag cf-category-tag ${this.getAttribute('class') || ''}`.trim();
      tag.classList.toggle('cf-category-clear', action);
      tag.classList.toggle('cf-category-icon-only', hideLabel && !action);
      const accessibleLabel = labelText || (kind === 'all' ? 'Todas as categorias'.tr : (action ? 'Limpar filtros'.tr || 'Limpar filtros' : 'Filtro'));
      tag.setAttribute('aria-label', accessibleLabel);
      tag.dataset.categoryTone = theme.tone;
      tag.style.setProperty('--category-strong', theme.strong);
      tag.style.setProperty('--category-soft', theme.soft);
      tag.style.setProperty('--category-foreground', theme.foreground);
      tag.title = accessibleLabel;
      if (filter) {
        tag.type = 'button';
        tag.setAttribute('aria-pressed', String(selected));
      }
      const icon = document.createElement('span');
      icon.className = 'cf-category-icon';
      icon.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'cf-category-svg');
      for (const [key, value] of Object.entries({ viewBox:'0 0 24 24', width:'18', height:'18', fill:'none' })) svg.setAttribute(key, value);
      svg.innerHTML = cartoonIcons[theme.symbol] || cartoonIcons.box;
      icon.append(svg);
      if (hideLabel && !action) {
        tag.replaceChildren(icon);
      } else {
        const label = document.createElement('span');
        label.className = filter ? 'category-chip-label' : 'cf-product-category-tag-label';
        label.textContent = labelText || (action ? 'Limpar filtros' : '');
        tag.replaceChildren(icon, label);
      }
      this.style.display = 'contents';
    }
  }
  customElements.define('render-category-tag', RenderCategoryTag);
  
  function attachDragScroll(container) {
    if (!container || container.__cfDragScrollBound) return () => {};
    container.__cfDragScrollBound = true;
    container.classList.add('cf-drag-scroll');

    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;
    let hasDragged = false;
    let momentumAnimId = null;
    let lastMoveTime = 0;
    let lastMoveX = 0;
    let velocity = 0;

    const cancelMomentum = () => {
      if (momentumAnimId) {
        cancelAnimationFrame(momentumAnimId);
        momentumAnimId = null;
      }
    };

    const onPointerDown = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (e.button !== 0) return;

      cancelMomentum();
      isDown = true;
      hasDragged = false;
      startX = e.clientX;
      lastMoveX = e.clientX;
      lastMoveTime = performance.now();
      startScrollLeft = container.scrollLeft;
      velocity = 0;

      const onPointerMove = (moveEvent) => {
        if (!isDown) return;
        const currentX = moveEvent.clientX;
        const deltaX = currentX - startX;

        if (!hasDragged && Math.abs(deltaX) > 5) {
          hasDragged = true;
          container.classList.add('is-dragging');
          document.body.classList.add('cf-dragging-active');
        }

        if (hasDragged) {
          moveEvent.preventDefault();
          container.scrollLeft = startScrollLeft - deltaX;

          const now = performance.now();
          const dt = now - lastMoveTime;
          if (dt > 8) {
            velocity = (currentX - lastMoveX) / dt;
            lastMoveTime = now;
            lastMoveX = currentX;
          }
        }
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        if (!isDown) return;
        isDown = false;
        container.classList.remove('is-dragging');
        document.body.classList.remove('cf-dragging-active');

        if (hasDragged) {
          const preventClick = (clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            clickEvent.stopImmediatePropagation();
          };
          window.addEventListener('click', preventClick, { capture: true, once: true });
          setTimeout(() => {
            window.removeEventListener('click', preventClick, { capture: true });
          }, 120);

          const now = performance.now();
          if (now - lastMoveTime < 100 && Math.abs(velocity) > 0.15) {
            let momentumVelocity = velocity * 16;
            const decay = () => {
              momentumVelocity *= 0.92;
              if (Math.abs(momentumVelocity) > 0.5) {
                container.scrollLeft -= momentumVelocity;
                momentumAnimId = requestAnimationFrame(decay);
              } else {
                momentumAnimId = null;
              }
            };
            momentumAnimId = requestAnimationFrame(decay);
          }
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    const onWheel = (e) => {
      if (e.shiftKey) return;
      if (e.deltaY !== 0 && e.deltaX === 0 && container.scrollWidth > container.clientWidth) {
        const atLeft = container.scrollLeft <= 0 && e.deltaY < 0;
        const atRight = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1 && e.deltaY > 0;
        if (!atLeft && !atRight) {
          container.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }
    };

    const onDragStart = (e) => e.preventDefault();

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('dragstart', onDragStart);

    return () => {
      cancelMomentum();
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('dragstart', onDragStart);
      delete container.__cfDragScrollBound;
    };
  }

  function autoInitDragScroll() {
    const selectors = '.cf-drag-scroll, [data-drag-scroll="true"], .catalog-category-filter, .catalog-subcategory-filter';
    document.querySelectorAll(selectors).forEach(attachDragScroll);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInitDragScroll);
    } else {
      autoInitDragScroll();
    }
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => autoInitDragScroll());
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  window.ConfloraCategoryUi = Object.freeze({ appearance, normalize, toggleSelection, matchesAny, attachDragScroll, enableDragScroll: attachDragScroll });
})();

