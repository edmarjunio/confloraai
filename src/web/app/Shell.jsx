import { useState } from 'react';
import { useSession } from '../auth/SessionProvider.jsx';
import { LoginForm } from '../auth/LoginForm.jsx';
import { Modal, ErrorNotice } from '../shared/ui.jsx';
import { languages, getLocale, setLocale } from '../i18n/runtime.mjs';
import { basePath, tenant } from '../api/store.mjs';
import { useAction } from '../shared/hooks.mjs';
export function Shell({ children }) {
  const [login, setLogin] = useState(false);
  const { user, logout } = useSession();
  const action = useAction();
  return <>
    <a href="#main" className="skip">{'nav.skip'.tr}</a>
    <header className="site-header"><a className="brand" href={basePath || '/'}><img src="/store-assets/brands/conflora-logo.png" alt={''} /><strong>{'app.title'.tr}</strong></a>
      <nav aria-label={'nav.home'.tr}><a href={basePath || '/'}>{'nav.catalog'.tr}</a><a href={`${basePath}/conta`}>{'nav.account'.tr}</a>
        {!tenant && <a href="/pdv">{'nav.pdv'.tr}</a>}
        {user?.role === 'ADMIN' && <a href={`${basePath}/admin`}>{'nav.admin'.tr}</a>}
        {user ? <button onClick={() => action.run(logout)}>{'auth.logout'.tr}</button> : <button onClick={() => setLogin(true)}>{'nav.team'.tr}</button>}
        <select aria-label={'common.language'.tr} value={getLocale()} onChange={event => setLocale(event.target.value)}>{Object.entries(languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select>
      </nav>
    </header>
    <ErrorNotice error={action.error} />
    <main id="main" className="page">{children}</main>
    <footer><a href="/privacy">{'legal.privacy'.tr}</a><a href="/terms">{'legal.terms'.tr}</a><a href="/data-deletion">{'legal.deletion'.tr}</a></footer>
    {login && <Modal title={'nav.team'.tr} onClose={() => setLogin(false)}><LoginForm team onComplete={() => setLogin(false)} /></Modal>}
  </>;
}
