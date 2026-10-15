import { Fragment, lazy, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useStore } from "zustand";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "../state/query-client.mjs";
import { localeStore, setLocale } from "../i18n/runtime.mjs";
import { SessionProvider } from "../auth/SessionProvider.jsx";
import { Shell } from "./Shell.jsx";
import { ErrorBoundary } from "../shared/ErrorBoundary.jsx";

const pages = {
  catalog: lazy(() => import("../catalog/CatalogPage.jsx")),
  pdv: lazy(() => import("../pdv/PdvPage.jsx")),
  admin: lazy(() => import("../admin/AdminPage.jsx")),
  account: lazy(() => import("../auth/AccountPage.jsx")),
  legal: lazy(() => import("../legal/LegalPage.jsx")),
  simulator: lazy(() => import("../simulator/SimulatorPage.jsx")),
};
function resolvePage(path) {
  if (
    /^\/(privacy|politica-de-privacidade|terms|termos-de-servico|data-deletion|exclusao-de-dados)\/?$/.test(
      path,
    )
  ) {
    return pages.legal;
  }
  if (/^\/(simulador|chat-simulador)\/?$/.test(path)) {
    return pages.simulator;
  }
  if (/\/(pdv|caixa)\/?$/.test(path)) {
    return pages.pdv;
  }
  if (/\/(admin|admin-gerencial|configuracoes)\/?$/.test(path)) {
    return pages.admin;
  }
  if (/\/conta\/?$/.test(path)) {
    return pages.account;
  }
  return pages.catalog;
}
const Page = resolvePage(location.pathname);
const Layout = Page === pages.catalog ? Fragment : Shell;
const queryClient = createQueryClient();
function App() {
  const locale = useStore(localeStore, (state) => state.locale);
  useEffect(() => {
    setLocale(locale);
  }, [locale]);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <link
          rel="stylesheet"
          href="/store-assets/v5/store.css"
          precedence="base"
        />
        <link
          rel="stylesheet"
          href="/react/internal.css"
          precedence="components"
        />
        <link
          rel="stylesheet"
          href="/react/storefront.css"
          precedence="compat"
        />
        <Layout>
          <Suspense fallback={<p role="status">{"app.loading".tr}</p>}>
            <Page />
          </Suspense>
        </Layout>
      </SessionProvider>
    </QueryClientProvider>
  );
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
