import { Field, Select } from '../shared/ui.jsx';
import { languages } from '../i18n/runtime.mjs';
export function IdentitySettings({ config }) {
  return <fieldset><legend>{'settings.identity'.tr}</legend><div className="form-grid">
    <Field label={'catalog.name'.tr} name="name" defaultValue={config.identity.name} required /><Field label={'settings.subtitle'.tr} name="subtitle" defaultValue={config.identity.subtitle} />
    <Field label={'settings.city'.tr} name="city" defaultValue={config.identity.city} /><Field label={'settings.region'.tr} name="region" defaultValue={config.identity.region} />
    <Select label={'settings.locale'.tr} name="locale" defaultValue={config.identity.locale}>{Object.entries(languages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
    <Field label={'settings.currency'.tr} name="currency" defaultValue={config.identity.currency} required />
    <Field label={'settings.logo'.tr} name="logoUrl" defaultValue={config.branding.logoUrl} /><Field label={'settings.icon'.tr} name="iconUrl" defaultValue={config.branding.iconUrl} />
    <Field label={'settings.primary'.tr} name="primary" type="color" defaultValue={config.branding.colors.primary} /><Field label={'settings.accent'.tr} name="accent" type="color" defaultValue={config.branding.colors.accent} />
    <Field label={'settings.text'.tr} name="text" type="color" defaultValue={config.branding.colors.text} /><Field label={'settings.background'.tr} name="background" type="color" defaultValue={config.branding.colors.background} />
  </div></fieldset>;
}
export function CheckoutSettings({ config }) {
  const { checkout } = config;
  return <fieldset><legend>{'cart.checkout'.tr}</legend><div className="form-grid">
    <Field label={'settings.contact'.tr} name="contactPhone" defaultValue={checkout.contactPhone} />
    <Field label={'settings.pixKey'.tr} name="pixKey" defaultValue={checkout.pix?.key} /><Field label={'settings.recipient'.tr} name="recipientName" defaultValue={checkout.pix?.recipientName} />
    <Field label={'checkout.address'.tr} name="pickupAddress" defaultValue={checkout.pickup.address} />
    <Field label={'cart.freight'.tr} name="fee" type="number" min="0" step="0.01" defaultValue={checkout.delivery.feeMinor / 100} />
    <Field label={'checkout.area'.tr} name="serviceAreas" defaultValue={checkout.delivery.serviceAreas.join(', ')} />
  </div><div className="toolbar">
    <label><input type="checkbox" name="delivery" defaultChecked={checkout.delivery.enabled} />{'checkout.delivery'.tr}</label>
    <label><input type="checkbox" name="pickup" defaultChecked={checkout.pickup.enabled} />{'checkout.pickup'.tr}</label>
    {[['PIX', 'checkout.pix'.tr], ['CARD', 'checkout.card'.tr], ['CASH', 'checkout.cash'.tr]].map(([method, label]) => <label key={method}><input type="checkbox" name={`payment_${method}`} defaultChecked={checkout.enabledPayments.includes(method)} />{label}</label>)}
  </div></fieldset>;
}
export function AssistantSettings({ config, assistant }) {
  return <fieldset><legend>{'settings.assistant'.tr}</legend><label><input type="checkbox" name="assistantEnabled" defaultChecked={config.assistant.enabled} />{'settings.enabled'.tr}</label>
    <Select label={'settings.mode'.tr} name="assistantMode" defaultValue={config.assistant.mode}><option value="GUIDED">{'settings.guided'.tr}</option><option value="AI">{'settings.ai'.tr}</option></Select>
    <Field label={'catalog.name'.tr} name="displayName" defaultValue={config.assistant.displayName} /><Field label={'settings.welcome'.tr} name="welcomeMessage" defaultValue={config.assistant.welcomeMessage} />
    <label className="field">{'settings.persona'.tr}<textarea name="persona" defaultValue={assistant.persona || ''} /></label>
    <label className="field">{'settings.instructions'.tr}<textarea name="instructions" rows="6" defaultValue={assistant.instructions || ''} /></label>
    <label><input type="checkbox" name="webSearchEnabled" defaultChecked={assistant.webSearchEnabled} />{'settings.web'.tr}</label>
  </fieldset>;
}
