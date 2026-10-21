'use strict';
const { normalizeName } = require('./util');

// Only this explicitly reviewed metadata is authoritative. Existing AI care text is not.
const RULES = [
  ['light', 'sol_pleno', /\b(sol forte|sol pleno|ensolarado|plantas? (?:pra|para|de) sol)\b/],
  ['light', 'sombra', /\b(sombra|pouco sol|luz indireta)\b/],
  ['environment', 'interno', /\b(dentro de casa|ambiente interno|interior|internas?)\b/],
  ['environment', 'externo', /\b(ambiente externo|externas?)\b/],
  ['use', 'cerca_viva', /\bcerca viva\b/],
  ['size', 'pequeno', /\b(nao cresca muito|pequena|pequeno|baixo porte)\b/],
  ['growth', 'pendente', /\bpendentes?\b/],
  ['leaf', 'grande', /\bfolhas? grandes?\b/],
  ['use', 'jardim_vertical', /\b(parede do jardim|jardim vertical)\b/],
  ['use', 'vaso_grande', /\bvaso grande\b/],
];

function approvedTraits(data) {
  const metadata = data?.botanical;
  if (metadata?.approved !== true || typeof metadata.reviewedBy !== 'string' || !metadata.reviewedBy.trim()) return {};
  return metadata.traits && typeof metadata.traits === 'object' ? metadata.traits : {};
}

function interpretTraits(query) {
  const text = normalizeName(query);
  // Negation, alternatives and qualifiers need a human rather than a partial interpretation.
  if (/\b(nao|sem|ou|mas|exceto|menos|nenhum)\b/.test(text) && !/nao cresca muito/.test(text)) return { unsupported: true, constraints: [] };
  const constraints = RULES.filter(([, , pattern]) => pattern.test(text)).map(([field, value]) => ({ field, value }));
  // Every meaningful word must be covered; never silently drop an unknown requirement.
  let rest = text;
  for (const [, , pattern] of RULES) rest = rest.replace(pattern, ' ');
  rest = rest.replace(/\b(tem|alguma|algumas|uma|umas|planta|plantas|quero|queria|preciso|opcoes|sugestoes|pra|para|colocar|que|aguenta|em|no|na|de|do|da|um|lugar|pega|fazer|por|favor|voces|me|mostra|sugerir|a|o)\b/g, ' ').trim();
  return { constraints, unsupported: Boolean(rest.replace(/\s/g, '')) };
}

function satisfiesTraits(data, constraints) {
  const traits = approvedTraits(data);
  return constraints.length > 0 && constraints.every(({ field, value }) =>
    Array.isArray(traits[field]) && traits[field].includes(value));
}

function reviewedBotanical(input, actor) {
  const values = {
    light: ['sol_pleno', 'sombra'], environment: ['interno', 'externo'],
    use: ['cerca_viva', 'jardim_vertical', 'vaso_grande'], size: ['pequeno'],
    growth: ['pendente'], leaf: ['grande'],
  };
  if (!input || typeof input.approved !== 'boolean' || !actor?.id) throw Object.assign(new Error('Informe a revisão das características botânicas.'), { status: 400 });
  const traits = {};
  for (const [field, choices] of Object.entries(input.traits || {})) {
    if (!values[field] || !Array.isArray(choices) || choices.some(choice => !values[field].includes(choice))) throw Object.assign(new Error('Característica botânica inválida.'), { status: 400 });
    traits[field] = [...new Set(choices)];
  }
  return { approved: input.approved, traits, reviewedBy: String(actor.id), reviewedAt: new Date().toISOString() };
}

module.exports = { interpretTraits, satisfiesTraits, approvedTraits, reviewedBotanical };
