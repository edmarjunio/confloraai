import { useState } from 'react';
import { request } from '../api/http.mjs';
import { storePath } from '../api/store.mjs';
import { getLocale } from '../i18n/runtime.mjs';
import { useAction } from '../shared/hooks.mjs';
import { ErrorNotice, Field, SubmitButton } from '../shared/ui.jsx';
import { ProductCard } from './ProductCard.jsx';
import { searchProducts } from '../../../public/storefront/guided-search.mjs';
export function Assistant({ config, products, onAdd }) {
  const [messages, setMessages] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const action = useAction();
  async function submit(event) {
    event.preventDefault();
    const message = new FormData(event.currentTarget).get('message');
    event.currentTarget.reset();
    await action.run(async () => {
      if (config.assistant.mode !== 'AI') {
        setRecommendations(searchProducts(products, message, config.assistant.synonyms).slice(0, 6).map(result => result.product));
        return;
      }
      const result = await request(storePath('/assistant'), { method: 'POST', body: { message, history: messages, locale: getLocale() } });
      setMessages(current => [...current, { role: 'user', text: message }, { role: 'assistant', text: result.message }]);
      setRecommendations(result.products || []);
    });
  }
  return <section className="stack"><p>{'assistant.guided'.tr}</p><div role="log">{messages.map((message, index) => <p className={`message ${message.role}`} key={index}>{message.text}</p>)}</div>
    <form className="toolbar" onSubmit={submit}><Field label={'assistant.message'.tr} name="message" required maxLength="500" /><SubmitButton busy={action.busy}>{'assistant.send'.tr}</SubmitButton></form>
    <ErrorNotice error={action.error} /><div className="product-grid">{recommendations.map(product => <ProductCard key={product.id} product={product} onAdd={onAdd} />)}</div>
  </section>;
}
