import { useState } from 'react';
import { request } from '../api/http.mjs';
import { tenant, storePath } from '../api/store.mjs';
import { useAction } from '../shared/hooks.mjs';
import { ErrorNotice, Field, Select, SubmitButton } from '../shared/ui.jsx';
export function ProductForm({ product = {}, onSaved }) {
  const action = useAction();
  const [file, setFile] = useState(null);
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await action.run(async () => {
      const id = product.id || crypto.randomUUID();
      const common = { ...product, id, name: values.name, description: values.description, imageUrl: values.imageUrl,
        isAvailable: values.status === 'ATIVO', status: values.status };
      const body = tenant ? { ...common, price: { amountMinor: Math.round(Number(values.price) * 100), currency: product.price?.currency || 'BRL' }, stock: { tracked: true, quantity: Number(values.stock) }, saleUnit: { code: values.unit, label: values.unit, minimum: values.unit === 'KG' ? 0.1 : 1, increment: values.unit === 'KG' ? 0.1 : 1 }, categories: product.categories || [] }
        : { ...common, price: Number(values.price), stockQuantity: Number(values.stock), category: values.category, unit: values.unit };
      await request(tenant ? storePath(`/admin/products/${id}`) : '/api/admin/products', { method: tenant ? 'PUT' : 'POST', body });
      if (file && !tenant) await request(`/api/admin/products/${id}/photo`, { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream', 'x-photo-content-type': file.type, 'x-photo-append': 'true' } });
      onSaved();
    });
  }
  return <form onSubmit={submit} className="stack"><Field label={'catalog.name'.tr} name="name" defaultValue={product.name || ''} required />
    <Field label={'catalog.description'.tr} name="description" defaultValue={product.description || product.descriptionAi || ''} />
    <div className="form-grid"><Field label={'catalog.price'.tr} name="price" type="number" min="0" step="0.01" required defaultValue={typeof product.price === 'object' ? product.price.amountMinor / 100 : product.price || 0} />
      <Field label={'catalog.stock'.tr} name="stock" type="number" min="0" step="0.001" defaultValue={product.stock?.quantity ?? product.stockQuantity ?? 0} />
      <Select label={'catalog.unit'.tr} name="unit" defaultValue={product.saleUnit?.code || product.unit || 'UN'}>{['UN','KG','M','L'].map(unit => <option key={unit}>{unit}</option>)}</Select>
      <Select label={'orders.status'.tr} name="status" defaultValue={product.status || (product.isAvailable === false ? 'INATIVO' : 'ATIVO')}><option value="ATIVO">{'status.active'.tr}</option><option value="INATIVO">{'status.inactive'.tr}</option></Select>
    </div>
    {!tenant && <Field label={'catalog.category'.tr} name="category" defaultValue={product.category || product.categoryName || ''} />}
    <Field label={'catalog.image'.tr} name="imageUrl" defaultValue={product.imageUrl || ''} />
    {!tenant && <Field label={'common.upload'.tr} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setFile(event.target.files[0] || null)} />}
    <ErrorNotice error={action.error} /><SubmitButton busy={action.busy}>{'common.save'.tr}</SubmitButton>
  </form>;
}
