/**
 * Conflora BUTTON3D Component
 * Componente unificado e centralizado para todos os botões do sistema.
 * Suporta Web Component (<button-3d>), helper vanilla (window.createButton3D)
 * e componente React (window.Button3D / PdvComponents.Button3D).
 */
(() => {
  const BUTTON_VARIANTS = ['primary', 'secondary', 'danger', 'warning', 'sky', 'dark', 'sub', 'quiet'];
  const BUTTON_SIZES = ['sm', 'md', 'lg', 'xl'];
  const BUTTON_SHAPES = ['pill', 'rounded'];

  /**
   * Constrói a string de classes CSS unificada do Button3D.
   */
  function buildButton3DClass({
    variant = 'primary',
    size = 'md',
    shape = 'pill',
    block = false,
    className = ''
  } = {}) {
    const v = BUTTON_VARIANTS.includes(variant) ? variant : 'primary';
    const s = BUTTON_SIZES.includes(size) ? size : 'md';
    const sh = BUTTON_SHAPES.includes(shape) ? shape : 'pill';
    return [
      'cf-btn-3d',
      `cf-btn-3d--${v}`,
      `cf-btn-3d--${s}`,
      `cf-btn-3d--${sh}`,
      block ? 'cf-btn-3d--block' : '',
      className
    ].filter(Boolean).join(' ');
  }

  /**
   * Helper Vanilla JS para criar instâncias de botões 3D.
   */
  function createButton3D({
    text = '',
    label = '',
    variant = 'primary',
    size = 'md',
    shape = 'pill',
    block = false,
    disabled = false,
    type = 'button',
    href = null,
    icon = null,
    className = '',
    onClick = null,
    attributes = {}
  } = {}) {
    const tag = href ? 'a' : 'button';
    const btn = document.createElement(tag);
    if (href) {
      btn.href = href;
    } else {
      btn.type = type;
    }
    if (disabled) btn.disabled = true;

    btn.className = buildButton3DClass({ variant, size, shape, block, className });

    if (icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'cf-btn-3d__icon';
      iconSpan.setAttribute('aria-hidden', 'true');
      if (typeof icon === 'string') {
        iconSpan.textContent = icon;
      } else if (icon instanceof Node) {
        iconSpan.appendChild(icon);
      }
      btn.appendChild(iconSpan);
    }

    const content = text || label;
    if (content) {
      const textSpan = document.createElement('span');
      textSpan.className = 'cf-btn-3d__text';
      textSpan.textContent = content;
      btn.appendChild(textSpan);
    }

    if (typeof onClick === 'function') {
      btn.onclick = onClick;
    }

    for (const [k, v] of Object.entries(attributes)) {
      btn.setAttribute(k, v);
    }

    return btn;
  }

  /**
   * Custom Element: <button-3d>
   * Uso no HTML:
   *   <button-3d variant="primary" size="md">Adicionar</button-3d>
   *   <button-3d variant="secondary" icon="←" href="/caixa">Voltar</button-3d>
   */
  class Button3DElement extends HTMLElement {
    static get observedAttributes() {
      return ['variant', 'size', 'shape', 'block', 'disabled', 'type', 'href', 'icon'];
    }

    connectedCallback() {
      if (this._rendered) {
        this.updateClasses();
        return;
      }
      this._rendered = true;

      const href = this.getAttribute('href');
      const tag = href ? 'a' : 'button';
      const inner = document.createElement(tag);
      if (href) {
        inner.href = href;
      } else {
        inner.type = this.getAttribute('type') || 'button';
      }

      // Transfere o conteúdo atual para o elemento interno
      while (this.firstChild) {
        inner.appendChild(this.firstChild);
      }

      // Adiciona ícone se definido via atributo
      const iconAttr = this.getAttribute('icon');
      if (iconAttr && !inner.querySelector('.cf-btn-3d__icon')) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'cf-btn-3d__icon';
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.textContent = iconAttr;
        inner.prepend(iconSpan);
      }

      this.style.display = (this.hasAttribute('block') || this.hasAttribute('full')) ? 'block' : 'inline-block';
      this.appendChild(inner);
      this.innerElement = inner;
      this.updateClasses();

      // Repassa eventos de clique se necessário
      this.onclick = (e) => {
        if (this.hasAttribute('disabled')) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
    }

    updateClasses() {
      if (!this.innerElement) return;
      const variant = this.getAttribute('variant') || 'primary';
      const size = this.getAttribute('size') || 'md';
      const shape = this.getAttribute('shape') || 'pill';
      const block = this.hasAttribute('block') || this.hasAttribute('full');
      const disabled = this.hasAttribute('disabled');

      this.innerElement.className = buildButton3DClass({
        variant,
        size,
        shape,
        block,
        className: this.getAttribute('btn-class') || ''
      });

      if (this.innerElement.tagName === 'BUTTON') {
        this.innerElement.disabled = disabled;
      }
    }

    attributeChangedCallback() {
      if (this._rendered) {
        this.updateClasses();
      }
    }
  }

  if (typeof customElements !== 'undefined' && !customElements.get('button-3d')) {
    customElements.define('button-3d', Button3DElement);
  }

  /**
   * Componente React: Button3D
   * Compatível com React/JSX em app.jsx e components.jsx.
   */
  function Button3D({
    children,
    variant = 'primary',
    size = 'md',
    shape = 'pill',
    block = false,
    disabled = false,
    type = 'button',
    className = '',
    icon = null,
    onClick = null,
    style = undefined,
    title = undefined,
    ...rest
  }) {
    const fullClass = buildButton3DClass({ variant, size, shape, block, className });
    return React.createElement(
      'button',
      {
        type,
        disabled,
        className: fullClass,
        onClick,
        style,
        title,
        ...rest
      },
      icon ? React.createElement('span', { className: 'cf-btn-3d__icon', 'aria-hidden': 'true' }, icon) : null,
      React.createElement('span', { className: 'cf-btn-3d__text' }, children)
    );
  }

  // Exportações Globais
  window.Button3D = Button3D;
  window.Button3D.create = createButton3D;
  window.Button3D.buildClass = buildButton3DClass;
  window.createButton3D = createButton3D;
})();
