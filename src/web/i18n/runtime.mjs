import pt from './locales/pt-BR.json' with { type: 'json' };
import en from './locales/en-US.json' with { type: 'json' };
import es from './locales/es-ES.json' with { type: 'json' };
export const dictionaries = { 'pt-BR': pt, 'en-US': en, 'es-ES': es };
export const languages = { 'pt-BR': 'Português', 'en-US': 'English', 'es-ES': 'Español' };
export function resolveLocale(requested) {
  if (Object.hasOwn(dictionaries, requested)) return requested;
  return Object.keys(dictionaries).find(key => key.split('-')[0] === String(requested).split('-')[0]) || 'pt-BR';
}
let locale = 'pt-BR';
try { locale = resolveLocale(globalThis.localStorage?.getItem('conflora.locale') || globalThis.navigator?.language); } catch { /* Storage may be blocked. */ }
const listeners = new Set();
export const getLocale = () => locale;
export function subscribeLocale(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function setLocale(value) {
  locale = resolveLocale(value);
  try { globalThis.localStorage?.setItem('conflora.locale', locale); } catch { /* Keep in memory. */ }
  if (globalThis.document) { document.documentElement.lang = locale; document.documentElement.dir = new Intl.Locale(locale).textInfo?.direction || 'ltr'; }
  for (const listener of listeners) listener();
}
export function translate(key, parameters = {}) {
  const message = dictionaries[locale]?.[key] ?? pt[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(parameters, name) ? String(parameters[name]) : match);
}
export const money = (minor, currency = 'BRL') => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(minor || 0) / 100);
export const dateTime = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '';
