const test = require("node:test");
const assert = require("node:assert/strict");
const { isExplicitConfirmation } = require("../src/orders/confirmation");

test("aceita confirmações inequívocas", () => {
  for (const message of [
    "sim",
    "confirmo",
    "pode fechar",
    "está certo",
    "fechado",
  ]) {
    assert.equal(isExplicitConfirmation(message), true, message);
  }
});

test("rejeita intenção incerta", () => {
  for (const message of [
    "acho que sim",
    "talvez",
    "vou pensar",
    "depois te falo",
  ]) {
    assert.equal(isExplicitConfirmation(message), false, message);
  }
});
