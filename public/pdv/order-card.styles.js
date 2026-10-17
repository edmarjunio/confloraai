/* global window */
/* One styled surface for cashier and delivery cards, including keyboard/motion states. */
window.PdvStyled = (() => {
  const styled = window.styled?.default;
  if (typeof styled !== 'function') return Object.freeze({ OrderCardSurface: 'cf-card' });
  const OrderCardSurface = styled('cf-card')`
    &.cf-order-card {
      position: relative;
      border-width: 1px;
      box-shadow: 0 5px 12px rgb(15 56 30 / 9%);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    &.cf-order-card:hover { transform: translateY(-3px); box-shadow: 0 12px 22px rgb(15 56 30 / 15%); }
    &.cf-order-card--amber { border-color: #fcd34d; background: rgb(254 225 104 / 38%); }
    &.cf-order-card--blue { border-color: #7dd3fc; background: rgb(125 211 252 / 30%); }
    &.cf-order-card--green { border-color: #6ee7b7; background: rgb(110 231 183 / 30%); }
    &.cf-order-card--red { border-color: #fda4af; background: rgb(253 164 175 / 30%); }
    &[draggable="true"] { cursor: grab; }
    &[draggable="true"]:active { cursor: grabbing; }
    &.cf-order-card--selected { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgb(14 165 233 / 20%); }
    &.cf-order-card--attention { animation: confloraOrderArrival 1.35s ease-in-out 5; }
    & > button:first-child:hover, & > button:first-child:active { transform: none; box-shadow: none; }
    & > button:first-child:focus-visible { outline: 2px solid var(--cf-green); outline-offset: 4px; border-radius: 8px; }
    @keyframes confloraOrderArrival {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    @media (prefers-reduced-motion: reduce) {
      &.cf-order-card { transition: none; animation: none; }
      &.cf-order-card:hover { transform: none; }
    }
  `;
  return Object.freeze({ OrderCardSurface });
})();
