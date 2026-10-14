import { useState } from 'react';
import { request } from '../api/http.mjs';
import { storePath, tenant } from '../api/store.mjs';
import { useAction, useResource } from '../shared/hooks.mjs';
import { ErrorNotice, Field, ResourceState, SubmitButton } from '../shared/ui.jsx';
import { IdentitySettings, CheckoutSettings, AssistantSettings } from './SettingsSections.jsx';
import { CategoriesEditor } from './CategoriesEditor.jsx';
import { settingsPayload } from './settings-payload.mjs';
function SettingsForm({ current, onSaved }) {
  const action = useAction();
  const [categories, setCategories] = useState(current.config.categories);
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await action.run(async () => { await request(storePath('/admin/config'), { method: 'PUT', body: settingsPayload(current, values, categories) }); onSaved(); });
  }
  return <form className="stack" onSubmit={submit}><IdentitySettings config={current.config} /><CheckoutSettings config={current.config} /><CategoriesEditor categories={categories} onChange={setCategories} /><AssistantSettings config={current.config} assistant={current.assistant || {}} />
    {tenant && <fieldset><Field label={'settings.webhook'.tr} name="orderWebhookUrl" defaultValue={current.integrations?.orderWebhookUrl} /><Field label={'settings.secret'.tr} name="webhookSecretRef" defaultValue={current.integrations?.webhookSecretRef} /></fieldset>}
    <ErrorNotice error={action.error} /><SubmitButton busy={action.busy}>{'common.save'.tr}</SubmitButton>
  </form>;
}
export function SettingsPanel() {
  const resource = useResource(signal => request(storePath('/admin/config'), { signal }), []);
  const [saved, setSaved] = useState(false);
  return <ResourceState resource={resource}>{saved && <p role="status">{'common.saved'.tr}</p>}{resource.data && <SettingsForm key={resource.data.config.version} current={resource.data} onSaved={() => { setSaved(true); resource.refresh(); }} />}</ResourceState>;
}
