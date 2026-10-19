'use strict';

/**
 * Etapa obrigatória entre consulta e envio (item 7). Cada verificação é "não aplicável" (undefined),
 * aprovada (true | {ok:true}) ou reprovada (false | {ok:false, detail}). O envio só é autorizado se
 * todas as verificações APLICÁVEIS passarem.
 */
const CHECK_IDS = Object.freeze([
  'request_understood',            // 1. A pergunta foi compreendida?
  'product_matches_request',       // 2. O produto corresponde ao pedido?
  'variation_matches_request',     // 3. A variação corresponde ao pedido?
  'record_active',                 // 4. O registro está ativo?
  'required_field_present',        // 5. O campo necessário existe e é válido?
  'price_currency_unit_coherent',  // 6. Preço, moeda e unidade são coerentes?
  'availability_assertable',       // 7. A disponibilidade pode ser afirmada?
  'no_source_conflict',            // 8. Existe conflito entre fontes ou campos?
  'freshness_policy',              // 9. A informação atende à política de atualização?
  'message_only_confirmed_facts',  // 10. A resposta contém somente fatos confirmados?
  'conversation_allows_auto_reply',// 11. A conversa permite resposta automática?
]);

function buildChecks(state = {}) {
  return CHECK_IDS.map((id) => {
    const value = state[id];
    if (value === undefined) return { id, ok: true, applicable: false };
    const ok = value === true || value?.ok === true;
    return { id, ok, applicable: true, ...(value?.detail ? { detail: String(value.detail).slice(0, 200) } : {}) };
  });
}

function passed(checks) {
  return checks.every((check) => !check.applicable || check.ok);
}

function failedIds(checks) {
  return checks.filter((c) => c.applicable && !c.ok).map((c) => c.id);
}

module.exports = { CHECK_IDS, buildChecks, passed, failedIds };
