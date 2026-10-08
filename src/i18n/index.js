const fs = require("node:fs");
const path = require("node:path");
const { AsyncLocalStorage } = require("node:async_hooks");
const context = new AsyncLocalStorage();
const directory =
  process.env.I18N_LOCALES_DIR || path.join(__dirname, "locales");
let dictionaries;
function load() {
  const result = {};
  for (const name of fs
    .readdirSync(directory)
    .filter((n) => n.endsWith(".json"))) {
    result[name.slice(0, -5)] = JSON.parse(
      fs.readFileSync(path.join(directory, name), "utf8"),
    );
  }
  return result;
}
function getDictionaries() {
  dictionaries ||= load();
  return dictionaries;
}
function supportedLocales() {
  return Object.keys(getDictionaries());
}
function resolveLocale(locale) {
  return (
    supportedLocales().find(
      (l) => l.toLowerCase() === String(locale || "").toLowerCase(),
    ) || "pt-BR"
  );
}
function getLocale() {
  return (
    context.getStore()?.locale || resolveLocale(process.env.APP_DEFAULT_LOCALE)
  );
}
function t(key, parameters = {}) {
  const all = getDictionaries();
  const message = all[getLocale()]?.[key] ?? all["pt-BR"]?.[key];
  if (message === undefined) {
    throw new Error("Unknown translation key: " + key);
  }
  return message.replace(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g, (_, name) =>
    String(parameters[name] ?? "{{" + name + "}}"),
  );
}
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function tHtml(key, parameters) {
  return escapeHtml(t(key, parameters));
}
function tTemplate(key, parameters) {
  return t(key, parameters)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}
function currency(value) {
  return new Intl.NumberFormat(getLocale(), {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}
function registerI18n(app) {
  app.use((req, res, next) => {
    const cookie = String(req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("conflora_locale="));
    const requested =
      req.query.lang || cookie?.split("=")[1] || process.env.APP_DEFAULT_LOCALE;
    const locale = resolveLocale(requested);
    context.run({ locale }, () => {
      res.locals.locale = locale;
      if (req.query.lang) {
        res.cookie("conflora_locale", locale, {
          sameSite: "strict",
          maxAge: 365 * 86400000,
        });
      }
      const send = res.send.bind(res);
      res.send = (body) => {
        if (typeof body === "string" && body.includes("<html")) {
          body = body.replace(
            /<html lang="[^"]*"/,
            '<html lang="' + locale + '"',
          );
          const script =
            '<script src="/i18n/bootstrap.js?lang=' +
            encodeURIComponent(locale) +
            '"></script>';
          body = body.replace(/<head>/i, "<head>" + script);
          if (!body.includes(script)) {
            body = body.replace(/<meta charset/i, script + "<meta charset");
          }
          if (process.env.APP_TEST_MODE === "local") {
            body = body.replace(
              /<body([^>]*)>/i,
              '<body$1><aside style="padding:12px;background:#fff3c4;text-align:center;color:#463500">' +
                escapeHtml(t("test.localBanner")) +
                "</aside>",
            );
          }
        }
        return send(body);
      };
      next();
    });
  });
  app.get("/i18n/bootstrap.js", (req, res) => {
    const locale = resolveLocale(req.query.lang);
    const dictionary = {
      ...getDictionaries()["pt-BR"],
      ...getDictionaries()[locale],
    };
    const serial = JSON.stringify({
      locale,
      dictionary,
      locales: supportedLocales(),
    }).replace(/</g, "\\u003c");
    res
      .type("application/javascript")
      .send(
        "(()=>{const config=" +
          serial +
          ';window.appLocale=config.locale;window.t=(key,params={})=>{const message=config.dictionary[key];if(message===undefined)throw Error("Unknown translation key: "+key);return message.replace(/\\{\\{([A-Za-z][A-Za-z0-9_]*)\\}\\}/g,(_,name)=>String(params[name]??"{{"+name+"}}"));};window.formatAppCurrency=value=>Number(value||0).toLocaleString(config.locale,{style:"currency",currency:"BRL"});addEventListener("DOMContentLoaded",()=>{if(config.locales.length<2)return;const label=document.createElement("label");label.textContent=t("language.select");const select=document.createElement("select");config.locales.forEach(locale=>{const opt=document.createElement("option");opt.value=locale;opt.textContent=new Intl.DisplayNames([config.locale],{type:"language"}).of(locale)||locale;opt.selected=locale===config.locale;select.append(opt);});select.onchange=()=>{const url=new URL(location.href);url.searchParams.set("lang",select.value);location.href=url.href;};label.append(select);document.body.prepend(label);});})();',
      );
  });
}
function validateLocales() {
  const all = getDictionaries();
  const base = all["pt-BR"];
  const errors = [];
  for (const [locale, messages] of Object.entries(all)) {
    for (const key of Object.keys(base)) {
      if (typeof messages[key] !== "string" || !messages[key].trim()) {
        errors.push(locale + ": missing " + key);
      }
    }
    for (const key of Object.keys(messages)) {
      if (!(key in base)) {
        errors.push(locale + ": unknown " + key);
      }
      if (!/^[a-z][A-Za-z0-9]*(\.[a-zA-Z0-9_]+)+$/.test(key)) {
        errors.push("Invalid English key: " + key);
      }
    }
  }
  return errors;
}
module.exports = {
  t,
  tHtml,
  tTemplate,
  currency,
  getLocale,
  resolveLocale,
  supportedLocales,
  registerI18n,
  validateLocales,
  context,
};
