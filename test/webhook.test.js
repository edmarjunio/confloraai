const test = require("node:test");
const assert = require("node:assert/strict");
const { extractInboundMessages } = require("../src/http/webhook-parser");

test("extrai mensagem de texto do webhook da Meta", () => {
  const payload = {
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              contacts: [
                { wa_id: "5564999999999", profile: { name: "Cliente" } },
              ],
              messages: [
                {
                  id: "wamid.test",
                  from: "5564999999999",
                  type: "text",
                  text: { body: "Quero uma palmeira" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  assert.deepEqual(extractInboundMessages(payload), [
    {
      kind: "text",
      phone: "5564999999999",
      profileName: "Cliente",
      messageId: "wamid.test",
      message: "Quero uma palmeira",
    },
  ]);
});
