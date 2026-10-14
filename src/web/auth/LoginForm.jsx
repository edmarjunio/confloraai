import { useState } from 'react';
import { useSession } from './SessionProvider.jsx';
import { request } from '../api/http.mjs';
import { accountPath, tenant } from '../api/store.mjs';
import { useAction, useResource } from '../shared/hooks.mjs';
import { ErrorNotice, Field, Select, SubmitButton } from '../shared/ui.jsx';
export function LoginForm({ team = false, onComplete }) {
  const [register, setRegister] = useState(false);
  const [operator, setOperator] = useState('');
  const members = useResource(signal => team && !tenant ? request('/api/admin/auth/users', { signal }) : Promise.resolve([]), [team]);
  const action = useAction();
  const session = useSession();
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await action.run(async () => {
      const url = team && !tenant ? '/api/admin/auth/login' : accountPath(`/auth/${register ? 'register' : 'login'}`);
      const result = await request(url, { method: 'POST', body: values });
      session.setUser(result.user); onComplete?.();
    });
  }
  return <form onSubmit={submit} className="stack">
    <h2>{team ? 'nav.team'.tr : register ? 'auth.register'.tr : 'auth.login'.tr}</h2>
    {team && !tenant ? <><Select label={'auth.operator'.tr} name="userId" required value={operator} onChange={event => setOperator(event.target.value)}><option value="">{'auth.operator'.tr}</option>{(members.data || []).map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</Select><Field label={'auth.pin'.tr} name="pin" type="password" inputMode="numeric" autoComplete="current-password" required /></> : <>
      {register && <><Field label={'checkout.name'.tr} name="name" autoComplete="name" required /><Field label={'checkout.phone'.tr} name="phone" autoComplete="tel" required /></>}
      <Field label={'auth.email'.tr} name="email" type="email" autoComplete="email" required />
      <Field label={'auth.password'.tr} name="password" type="password" minLength={register ? 8 : undefined} autoComplete={register ? 'new-password' : 'current-password'} required />
    </>}
    <ErrorNotice error={action.error || members.error} />
    <SubmitButton busy={action.busy}>{register ? 'auth.register'.tr : 'auth.login'.tr}</SubmitButton>
    {!team && <button type="button" onClick={() => setRegister(value => !value)}>{register ? 'auth.login'.tr : 'auth.register'.tr}</button>}
  </form>;
}
export function RequireRole({ children, roles = ['ADMIN', 'CAIXA'] }) {
  const { user, loading, error } = useSession();
  if (loading) return <p role="status">{'app.loading'.tr}</p>;
  if (error) return <ErrorNotice error={error} />;
  if (!user) return <section className="panel narrow"><LoginForm team /></section>;
  if (!roles.includes(user.role)) return <ErrorNotice error="error.forbidden" />;
  return children;
}
