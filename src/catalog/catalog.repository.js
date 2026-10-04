const { google } = require("googleapis");
const { config } = require("../config/env");
const logger = require("../shared/logger");
const { normalizeText } = require("../shared/text");

const SEARCH_FIELDS = Object.freeze([
  ["descricao", 10],
  ["variacao", 9],
  ["tagsIa", 8],
  ["descricaoIa", 7],
  ["subcategoria", 6],
  ["categoria", 4],
  ["endereco", 1],
]);

const STOP_WORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "eu",
  "me",
  "meu",
  "minha",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "pra",
  "pro",
  "que",
  "quero",
  "tem",
  "ter",
  "um",
  "uma",
  "vcs",
  "voces",
  "voce",
]);

let cache = { expiresAt: 0, rows: [] };

function parsePrice(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  let normalized = String(value ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function singularize(token) {
  if (token.length <= 4) {
    return token;
  }
  if (token.endsWith("oes")) {
    return `${token.slice(0, -3)}ao`;
  }
  if (token.endsWith("ais")) {
    return `${token.slice(0, -3)}al`;
  }
  if (token.endsWith("eis")) {
    return `${token.slice(0, -3)}el`;
  }
  if (token.endsWith("res")) {
    return token.slice(0, -1);
  }
  if (token.endsWith("s")) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .map(singularize)
    .filter((token) => token && !STOP_WORDS.has(token));
}

function isActive(row) {
  return normalizeText(row.STATUS) === "ativo";
}

function isWhatsappVisible(row) {
  const flag = normalizeText(row.EXIBIR_WHATSAPP);
  if (!flag) {
    return true;
  }
  return !new Set(["nao", "false", "0", "n", "ocultar"]).has(flag);
}

function mapProduct(row) {
  const fallbackPrice = parsePrice(row.VALOR);
  const numericPrice = parsePrice(row.VALOR_NUM);

  return {
    id: String(row["Product ID"] ?? "").trim(),
    descricao: String(row.DESCRIÇÃO ?? "").trim(),
    status: String(row.STATUS ?? "").trim(),
    valor: String(row.VALOR ?? "").trim(),
    valorNum: numericPrice ?? fallbackPrice,
    categoria: String(row.CATEGORIA ?? "").trim(),
    endereco: String(row.ENDEREÇO ?? "").trim(),
    imageUrl: String(row.ImageURL ?? "").trim(),
    subcategoria: String(row.SUBCATEGORIA ?? "").trim(),
    imageFileId: String(row.ImageFileId ?? "").trim(),
    imagePathCache: String(row.ImagePathCache ?? "").trim(),
    variacao: String(row.VARIACAO ?? "").trim(),
    descricaoIa: String(row.DESCRICAO_IA ?? "").trim(),
    tagsIa: String(row.TAGS_IA ?? "").trim(),
  };
}

async function loadRowsFromSheets() {
  if (!config.sheets.spreadsheetId) {
    throw new Error("SPREADSHEET_ID não configurado.");
  }

  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheets.spreadsheetId,
    range: `${config.sheets.sheetName}!A:O`,
  });

  const values = response.data.values ?? [];
  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map((header) => String(header ?? "").trim());
  return values
    .slice(1)
    .map((valuesRow) =>
      Object.fromEntries(
        headers.map((header, index) => [header, valuesRow[index] ?? ""]),
      ),
    );
}

async function getRows(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cache.expiresAt > now) {
    return cache.rows;
  }

  const rows = await loadRowsFromSheets();
  cache = {
    rows,
    expiresAt: now + Math.max(0, config.sheets.cacheSeconds) * 1000,
  };
  return rows;
}

function levenshtein(a, b) {
  if (a === b) {
    return 0;
  }
  if (!a) {
    return b.length;
  }
  if (!b) {
    return a.length;
  }

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function tokenSimilarity(a, b) {
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 1;
  }

  const shortest = Math.min(a.length, b.length);
  const longest = Math.max(a.length, b.length);
  if (shortest <= 3) {
    return 0;
  }

  if ((a.startsWith(b) || b.startsWith(a)) && shortest / longest >= 0.72) {
    return 0.92 * (shortest / longest) + 0.08;
  }

  return Math.max(0, 1 - levenshtein(a, b) / longest);
}

function similarityThreshold(token) {
  if (token.length <= 3) {
    return 1;
  }
  if (token.length <= 5) {
    return 0.78;
  }
  if (token.length <= 8) {
    return 0.74;
  }
  return 0.7;
}

function scoreProduct(product, queryTokens, normalizedQuery) {
  if (normalizeText(product.id) === normalizedQuery) {
    return 10000;
  }

  let score = 0;
  for (const [field, weight] of SEARCH_FIELDS) {
    const fieldText = normalizeText(product[field]);
    if (!fieldText) {
      continue;
    }

    if (fieldText === normalizedQuery) {
      score += 1000 * weight;
    } else if (fieldText.startsWith(normalizedQuery)) {
      score += 350 * weight;
    } else if (fieldText.includes(normalizedQuery)) {
      score += 220 * weight;
    }

    const fieldTokens = tokenize(product[field]);
    for (const queryToken of queryTokens) {
      let best = 0;
      for (const fieldToken of fieldTokens) {
        best = Math.max(best, tokenSimilarity(queryToken, fieldToken));
      }
      if (best >= similarityThreshold(queryToken)) {
        score += best * 100 * weight;
      }
    }
  }

  const description = normalizeText(product.descricao);
  if (description.startsWith(normalizedQuery)) {
    score += 250;
  }
  return score;
}

async function buscarProdutos(termo, opcoes = {}) {
  const queryTokens = tokenize(termo);
  if (!queryTokens.length) {
    return [];
  }

  const normalizedQuery = queryTokens.join(" ");
  const rows = await getRows();
  const products = rows
    .filter((row) => isActive(row) && isWhatsappVisible(row))
    .map(mapProduct);

  const ranked = products
    .map((product) => ({
      product,
      score: scoreProduct(product, queryTokens, normalizedQuery),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return [];
  }

  const bestScore = ranked[0].score;
  const relevanceCut = queryTokens.length >= 2 ? bestScore * 0.55 : 0;
  const relevant = ranked
    .filter((item) => item.score >= relevanceCut)
    .map((item) => item.product);

  const returnAll = opcoes.todos === true;
  const limit = Math.min(Math.max(Number(opcoes.limite || 20), 1), 100);
  const result = returnAll ? relevant : relevant.slice(0, limit);

  logger.info("Busca de catálogo concluída", {
    termo: String(termo),
    resultados: result.length,
  });

  return result;
}

async function obterProdutosPorIds(productIds, options = {}) {
  const ids = new Set(
    (productIds || []).map((value) => String(value ?? "").trim()),
  );
  if (!ids.size) {
    return new Map();
  }

  const rows = await getRows(options.forceRefresh === true);
  const productsById = new Map();

  for (const row of rows) {
    const id = String(row["Product ID"] ?? "").trim();
    if (!ids.has(id) || !isActive(row) || !isWhatsappVisible(row)) {
      continue;
    }
    productsById.set(id, mapProduct(row));
  }

  return productsById;
}

async function obterProdutoPorId(productId, options = {}) {
  const products = await obterProdutosPorIds([productId], options);
  return products.get(String(productId ?? "").trim()) || null;
}

function clearCatalogCache() {
  cache = { expiresAt: 0, rows: [] };
}

module.exports = {
  buscarProdutos,
  obterProdutoPorId,
  obterProdutosPorIds,
  clearCatalogCache,
  parsePrice,
  tokenize,
  singularize,
};
