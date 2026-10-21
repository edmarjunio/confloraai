const paths = {
  grid: ["M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z"],
  fruit: ["M12 8c-8-5-12 5-6 12 2 2 4 1 6 1s4 1 6-1c6-7 2-17-6-12Z", "M12 8V5m0 0c0-3 3-4 6-3 0 3-3 5-6 3Z"],
  sprout: ["M12 22V12", "M12 15C4 15 2 10 3 5c6 0 9 4 9 10Z", "M12 12c0-6 3-9 9-9 1 5-2 9-9 9Z"],
  paw: ["M8 14c-2 3-3 7 0 7 2 0 2-1 4-1s2 1 4 1c3 0 2-4 0-7-2-3-6-3-8 0Z", "M6 10a2 3 0 1 0-4 0 2 3 0 0 0 4 0M22 10a2 3 0 1 0-4 0 2 3 0 0 0 4 0", "M11 5a2 3 0 1 0-4 0 2 3 0 0 0 4 0M17 5a2 3 0 1 0-4 0 2 3 0 0 0 4 0"],
  cart: ["M3 3h2l2.4 12h11.8l2-8H6", "M9 21h.01M18 21h.01"],
  user: ["M20 21v-2a7 7 0 0 0-14 0v2", "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0"],
  menu: ["M3 6h18", "M3 12h18", "M3 18h18"],
  search: ["m21 21-5-5", "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
  heart: [
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  ],
  info: ["M12 16v-4", "M12 8h.01", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  leaf: ["M20 3C8 2 2 8 5 16c8 5 16-1 15-13Z", "M4 21 16 8"],
  sparkle: ["m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"],
  truck: [
    "M1 4h13v13H1Z",
    "M14 9h4l4 5v3h-8",
    "M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    "M20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  ],
  store: ["M3 10v11h18V10M2 10l2-7h16l2 7ZM9 21v-7h6v7"],
  card: ["M2 5h20v14H2ZM2 10h20M6 15h4"],
  cash: ["M2 5h20v14H2Z", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0"],
  register: ["M3 8h18v13H3Z", "M6 8V4h12v4", "M7 12h2m3 0h2m3 0h1", "M8 17h8"],
  pix: ["m12 2 10 10-10 10L2 12Z", "m5 9 4 3 3-3 3 3 4-3M5 15l4-3 3 3 3-3 4 3"],
  copy: ["M9 8h11v13H9ZM15 8V3H4v13h5"],
  trash: ["M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"],
  arrow: ["M4 12h16m-6-6 6 6-6 6"],
  send: ["m22 2-7 20-4-9L2 9ZM22 2 11 13"],
  sun: [
    "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  ],
  drop: ["M12 2C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-13Z"],
  mapPin: ["M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z", "M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
  shield: ["M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z", "m9 12 2 2 4-4"],
  box: ["m12 3 9 5-9 5-9-5 9-5Z", "M3 8v9l9 5 9-5V8", "M12 13v9"],
  clock: ["M12 8v4l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  history: ["M3 12a9 9 0 1 0 2.64-6.36L3 8", "M3 3v5h5", "M12 7v5l3 2"],
};
export function icon(name) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({
    viewBox: "0 0 24 24",
    width: "24",
    height: "24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.7",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    class: "icon",
  })) {
    node.setAttribute(key, value);
  }
  for (const d of paths[name] || paths.leaf) {
    const path = document.createElementNS(node.namespaceURI, "path");
    path.setAttribute("d", d);
    node.append(path);
  }
  return node;
}
