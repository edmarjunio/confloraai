# Traduções

O catálogo padrão está em `src/i18n/locales/pt-BR.json`. Os identificadores permanecem em inglês e os valores são os textos exibidos. Chaves herdadas da migração usam namespaces estáveis `interface.message`, `interface.text`, `interface.label` e `interface.fragment`; mensagens novas devem usar nomes descritivos, como `sales.confirm`.

Para adicionar francês, copie o arquivo para `fr-FR.json` e traduza todos os valores, preservando as chaves e os espaços das mensagens fragmentadas. Inglês usa `en.json`. Reinicie o app e execute:

```bash
npm run i18n:check
npm test
```

O validador rejeita chaves ausentes, desconhecidas e textos vazios. Com dois idiomas, aparece o seletor de idioma. Também é possível abrir `/lancamentos?lang=fr-FR`; a preferência fica em cookie. `APP_DEFAULT_LOCALE` define o idioma inicial. `I18N_LOCALES_DIR` permite apontar para outro diretório completo de traduções.

Servidor: `t(key, params)` para texto, `tHtml` para HTML e `tTemplate` para fragmentos em templates JavaScript. Navegador: `window.t` e `window.formatAppCurrency`. Mensagens novas podem usar parâmetros `{{name}}`, mantendo o mesmo nome em todos os idiomas. Traduções de HTML e templates são escapadas. O idioma de cada requisição usa AsyncLocalStorage.

Datas e moeda respeitam o idioma; a moeda financeira permanece BRL, e o dia operacional permanece no fuso de São Paulo. IDs, categorias/status armazenados, cabeçalhos originais de planilhas e dados cadastrados pelos usuários não são traduzidos. O idioma da conversa livre gerada pela IA segue o contexto do agente e precisa de validação própria para novos idiomas.

A tradução inicial disponível é português. Adicionar o arquivo com as traduções é necessário para oferecer outro idioma; não há traduções automáticas para inglês/francês neste pacote.
