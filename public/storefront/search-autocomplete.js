import { buildSearchSuggestions } from './search-suggestions.mjs';

export function createSearchAutocomplete(state) {
  const input = document.querySelector('#search');
  const container = input.closest('form');
  const list = document.createElement('div');
  list.id = 'searchSuggestions'; list.className = 'search-suggestions'; list.hidden = true;
  list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Sugestões de busca');
  container.append(list);
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id); input.setAttribute('aria-expanded', 'false');
  let suggestions = [];
  let selected = -1;
  let timer;
  let composing = false;
  function close() { window.clearTimeout(timer); list.hidden = true; selected = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
  function choose(index) {
    if (!suggestions[index]) return;
    input.value = suggestions[index].label;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    close(); input.focus();
  }
  function paint() {
    if (document.activeElement !== input || composing) return close();
    suggestions = buildSearchSuggestions(state.products, input.value, state.config?.categories, state.config?.assistant?.synonyms);
    selected = -1;
    input.removeAttribute('aria-activedescendant');
    list.replaceChildren(...suggestions.map((suggestion, index) => {
      const option = document.createElement('div');
      option.id = `searchSuggestion${index}`; option.className = 'search-suggestion';
      option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
      const label = document.createElement('span'); label.textContent = suggestion.label;
      const kind = document.createElement('small'); kind.textContent = suggestion.kind.tr;
      option.append(label, kind);
      option.addEventListener('pointerdown', event => event.preventDefault());
      option.addEventListener('click', () => choose(index));
      return option;
    }));
    list.hidden = !suggestions.length;
    input.setAttribute('aria-expanded', String(!list.hidden));
  }
  function schedule() { close(); if (!composing) timer = window.setTimeout(paint, 120); }
  input.addEventListener('input', schedule);
  input.addEventListener('focus', schedule);
  input.addEventListener('blur', close);
  input.addEventListener('compositionstart', () => { composing = true; close(); });
  input.addEventListener('compositionend', () => { composing = false; schedule(); });
  input.addEventListener('keydown', event => {
    if (composing) return;
    if (event.key === 'Escape' || event.key === 'Tab') return close();
    if (event.key === 'Enter') {
      if (!list.hidden && selected >= 0) { event.preventDefault(); choose(selected); }
      else close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    if (list.hidden) paint();
    if (!suggestions.length) return;
    selected = (selected + (event.key === 'ArrowDown' ? 1 : selected < 0 ? 0 : -1) + suggestions.length) % suggestions.length;
    for (const [index, option] of [...list.children].entries()) option.setAttribute('aria-selected', String(index === selected));
    input.setAttribute('aria-activedescendant', list.children[selected].id);
    list.children[selected].scrollIntoView({ block: 'nearest' });
  });
  container.addEventListener('submit', close);
  return { close };
}
