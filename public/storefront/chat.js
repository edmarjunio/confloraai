import { createChat as createAiChat } from "./ai-chat.js";
import { createGuidedChat } from "./guided-chat.js";
export function createChat(state, catalog) {
  return state.config.assistant.mode === "GUIDED"
    ? createGuidedChat(state, catalog)
    : createAiChat(state, catalog);
}
