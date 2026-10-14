import { useEffect, useId, useRef } from 'react';
import { translate } from '../i18n/runtime.mjs';
export function Field({ label, children, ...props }) {
  const id = useId();
  return <label className="field" htmlFor={id}><span>{label}</span>{children ? <span>{children}</span> : <input id={id} {...props} />}</label>;
}
export function Select({ label, children, ...props }) {
  const id = useId();
  return <label className="field" htmlFor={id}><span>{label}</span><select id={id} {...props}>{children}</select></label>;
}
export function ErrorNotice({ error }) { return error ? <p className="notice error" role="alert">{translate(error)}</p> : null; }
export function ResourceState({ resource, children }) {
  if (resource.loading && !resource.data) return <p role="status">{'app.loading'.tr}</p>;
  if (resource.error) return <div><ErrorNotice error={resource.error} /><button onClick={resource.refresh}>{'common.retry'.tr}</button></div>;
  return children;
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose?.(); }}>
    <header className="dialog-heading"><h2 id={titleId}>{title}</h2>{onClose && <button onClick={onClose} aria-label={'common.close'.tr}>{'common.close'.tr}</button>}</header>
    {children}
  </dialog>;
}
export function EmptyState() { return <p className="empty">{'common.empty'.tr}</p>; }
export function SubmitButton({ busy, children }) { return <button className="primary" disabled={busy} type="submit">{busy ? 'app.loading'.tr : children}</button>; }
