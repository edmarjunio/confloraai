import { useState } from "react";
import { request } from "../api/http.mjs";
import { useAction, useResource } from "../shared/hooks.mjs";
import {
  ErrorNotice,
  Field,
  ResourceState,
  SubmitButton,
} from "../shared/ui.jsx";
import { SimulatorInventory } from "./SimulatorInventory.jsx";

export default function SimulatorPage() {
  const inventory = useResource(
    (signal) => request("/api/inventory", { signal }),
    ["simulator-inventory"],
  );
  const action = useAction();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  async function send(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const text = message.trim();
    if (!text || action.busy) {
      return;
    }
    await action.run(async () => {
      const response = await request("/chat", {
        method: "POST",
        body: {
          telefone: values.phone,
          nome: values.name,
          mensagem: text,
        },
      });
      if (response.error || !response.reply) {
        throw new Error("error.generic");
      }
      setMessages((current) => [
        ...current,
        { role: "user", text },
        { role: "assistant", text: response.reply },
      ]);
      setMessage("");
      if (response.intent === "ORDER_CONFIRMATION") {
        inventory.refresh();
      }
    });
  }
  return (
    <>
      <h1>{"simulator.title".tr}</h1>
      <div className="simulator-layout">
        <section className="panel">
          <ResourceState resource={inventory}>
            <SimulatorInventory
              data={inventory.data}
              onRefresh={inventory.refresh}
            />
          </ResourceState>
        </section>
        <section className="panel">
          <form className="stack" onSubmit={send}>
            <div className="form-grid">
              <Field name="name" label={"checkout.name".tr} required />
              <Field
                name="phone"
                type="tel"
                label={"checkout.phone".tr}
                required
              />
            </div>
            <p>{"simulator.notice".tr}</p>
            <div
              className="simulator-messages"
              role="log"
              aria-live="polite"
              aria-label={"simulator.title".tr}
            >
              {messages.map((item, index) => (
                <p className={`message ${item.role}`} key={index}>
                  {item.text}
                </p>
              ))}
            </div>
            <Field
              label={"assistant.message".tr}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
            <ErrorNotice error={action.error} />
            <SubmitButton busy={action.busy}>
              {"assistant.send".tr}
            </SubmitButton>
          </form>
        </section>
      </div>
    </>
  );
}
