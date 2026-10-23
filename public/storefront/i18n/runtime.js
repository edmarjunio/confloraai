import { tr, getLanguage, onLanguageChange, applyHtmlTranslations, TRANSLATIONS } from './index.js';
import { aliases } from './aliases.js';
import { translateProductName } from './products.js';

globalThis.translateProductName = translateProductName;

const shared = globalThis.ConfloraLanguageState;
if (!shared.documentTranslator) {
  shared.documentTranslator = true;
  const textState = new WeakMap();
  const attributeState = new WeakMap();
  const translatedKeys = new Map(Object.values(TRANSLATIONS).flatMap(dictionary =>
    Object.entries(dictionary).map(([key, value]) => [value, key])));
  const ignored = 'script,style,code,pre,textarea,[contenteditable="true"],[data-i18n-skip],.cf-topbar-identity strong';
  let scheduled = false;

  function translateText(node) {
    if (node.parentElement?.closest(ignored)) return;
    const previous = textState.get(node);
    const current = node.nodeValue;
    const original = previous && current === previous.written ? previous.original : current;
    const normalized = original.trim().replace(/\s+/g, ' ');
    const key = aliases[normalized] || translatedKeys.get(normalized);
    if (!key) return;
    const translated = original.match(/^\s*/)[0] + tr(key) + original.match(/\s*$/)[0];
    textState.set(node, { original, written: translated });
    if (current !== translated) node.nodeValue = translated;
  }

  function translateAttributes(element) {
    if (element.closest(ignored)) return;
    const states = attributeState.get(element) || {};
    for (const attribute of ['placeholder', 'title', 'aria-label', 'alt']) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const previous = states[attribute];
      const original = previous && current === previous.written ? previous.original : current;
      const key = aliases[original.trim()] || translatedKeys.get(original.trim());
      if (!key) continue;
      const translated = tr(key);
      states[attribute] = { original, written: translated };
      if (current !== translated) element.setAttribute(attribute, translated);
    }
    attributeState.set(element, states);
  }

  function translateDocument() {
    scheduled = false;
    if (!document.body) return;
    applyHtmlTranslations();
    document.documentElement.lang = getLanguage() === 'pt' ? 'pt-BR' : getLanguage();
    const nodes = document.createTreeWalker(document.body, 4);
    for (let node = nodes.nextNode(); node; node = nodes.nextNode()) translateText(node);
    document.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(translateAttributes);
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(translateDocument);
  }
  onLanguageChange(schedule);
  document.addEventListener('DOMContentLoaded', () => {
    translateDocument();
    new window.MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'] });
  }, { once: true });
  if (document.readyState !== 'loading') schedule();
}
