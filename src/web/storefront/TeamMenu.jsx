import { useSession } from "../auth/SessionProvider.jsx";
import { LoginForm } from "../auth/LoginForm.jsx";
import { useAction } from "../shared/hooks.mjs";
import { Modal, ErrorNotice } from "../shared/ui.jsx";
import { basePath, tenant } from "../api/store.mjs";
import { languages, getLocale, setLocale } from "../i18n/runtime.mjs";
export function TeamMenu({ onClose }) {
  const { user, logout } = useSession();
  const action = useAction();
  return (
    <Modal title={"nav.team".tr} onClose={onClose} className="drawer team-menu">
      {user ? (
        <div className="team-operator-card">
          <strong>{user.name}</strong>
          <button onClick={() => action.run(logout)}>{"auth.logout".tr}</button>
        </div>
      ) : (
        <LoginForm team />
      )}
      <nav className="team-menu-actions">
        <a className="team-nav-card" href={basePath || "/"}>
          {"nav.catalog".tr}
        </a>
        {!tenant && ["ADMIN", "CAIXA"].includes(user?.role) && (
          <a className="team-nav-card featured-caixa" href="/pdv">
            {"nav.pdv".tr}
          </a>
        )}
        {user?.role === "ADMIN" && (
          <>
            <a className="team-nav-card" href={`${basePath}/admin`}>
              {"nav.admin".tr}
            </a>
            <a className="team-nav-card" href={`${basePath}/configuracoes`}>
              {"nav.settings".tr}
            </a>
            {!tenant && (
              <a className="team-nav-card" href="/simulador">
                {"simulator.title".tr}
              </a>
            )}
          </>
        )}
        <a className="team-nav-card" href={`${basePath}/conta`}>
          {"nav.account".tr}
        </a>
      </nav>
      <label>
        {"common.language".tr}
        <select
          value={getLocale()}
          onChange={(event) => setLocale(event.target.value)}
        >
          {Object.entries(languages).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <ErrorNotice error={action.error} />
    </Modal>
  );
}
