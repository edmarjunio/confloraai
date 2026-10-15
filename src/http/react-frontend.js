const path = require("node:path");
function installReactFrontend(app, express) {
  const directory = path.resolve(__dirname, "../../public/react");
  app.use(
    "/react",
    express.static(directory, {
      setHeaders: (res) => res.setHeader("Cache-Control", "no-cache"),
    }),
  );
  app.get(
    [
      "/",
      "/products/:productId",
      "/conta",
      "/pdv",
      "/caixa",
      "/admin",
      "/admin-gerencial",
      "/configuracoes",
      "/catalogo-classico",
      "/privacy",
      "/politica-de-privacidade",
      "/terms",
      "/termos-de-servico",
      "/data-deletion",
      "/exclusao-de-dados",
      "/simulador",
      "/chat-simulador",
      "/shop/:slug",
      "/shop/:slug/products/:productId",
      "/shop/:slug/conta",
      "/shop/:slug/admin",
      "/shop/:slug/configuracoes",
    ],
    (req, res) => {
      const slug = process.env.STOREFRONT_STORE_SLUG;
      if (
        slug &&
        (["/", "/configuracoes"].includes(req.path) ||
          req.path.startsWith("/products/"))
      ) {
        const suffix =
          req.path === "/configuracoes"
            ? "/admin"
            : req.params.productId
              ? `/products/${encodeURIComponent(req.params.productId)}`
              : "";
        return res.redirect(`/shop/${encodeURIComponent(slug)}${suffix}`);
      }
      return res
        .set("Cache-Control", "no-store")
        .sendFile(path.join(directory, "index.html"));
    },
  );
}
module.exports = { installReactFrontend };
