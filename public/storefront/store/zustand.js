/**
 * Zustand Vanilla Store Implementation
 * Exact official implementation from zustand/vanilla
 */
export const createStore = (createState) => {
  let state;
  const listeners = new Set();

  const setState = (partial, replace) => {
    const nextState = typeof partial === 'function' ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state =
        replace !== null && replace !== undefined
          ? replace
          : typeof nextState !== 'object' || nextState === null
            ? nextState
            : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };

  const getState = () => state;
  const getInitialState = () => initialState;

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const api = { setState, getState, getInitialState, subscribe };
  const initialState = (state = createState(setState, getState, api));
  return api;
};
