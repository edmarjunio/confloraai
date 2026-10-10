# Firebase Hosting e Cloud Run

O projeto Firebase é `confloraai`. O site `confloraai.web.app` encaminha todas as rotas ao serviço Cloud Run `confloraai`, na região `southamerica-east1`. O catálogo, admin, produtos e APIs continuam servidos pelo Express. A pasta `firebase-hosting` fica vazia para não interceptar rotas com arquivos estáticos.

## Publicação pelo PowerShell

Execute na raiz do repositório:

```powershell
npm ci
npm run check
npm test
gcloud run deploy confloraai --source . --project confloraai --region southamerica-east1
firebase deploy --only hosting --project confloraai
```

Use Node 24 e npm. O `package-lock.json` fixa as dependências de produção; os lockfiles Bun são excluídos do upload para impedir que o build selecione outro gerenciador. A dependência de exemplo do Data Connect criada pelo `firebase init` foi removida do app, mantendo os arquivos gerados localmente.

O deploy do Cloud Run preserva as variáveis, secrets e conta de serviço existentes. Não use o script antigo com outro projeto. Revise os arquivos enviados com `gcloud meta list-files-for-upload` antes de publicar; credenciais e arquivos `.env` devem permanecer excluídos.

`firebase deploy --only hosting` atualiza o roteamento e não publica novas versões do código Node. Não é necessário executar `firebase init` novamente nem habilitar Genkit, Functions ou Data Connect para esta arquitetura. Os exemplos gerados por uma inicialização anterior não são publicados pelo Hosting.

## Sessões e IA

Firebase Hosting encaminha apenas o cookie `__session` ao backend. As sessões usam esse nome com escopos distintos para a loja principal e cada tenant. As APIs têm cache privado/desabilitado por padrão; endpoints públicos de imagens podem definir cache próprio.

Login Google exige o domínio publicado autorizado no Firebase Authentication. Teste login e logout no domínio final após publicar. O deploy não resolve saldo esgotado do Gemini: a consultoria depende de uma chave válida e créditos no projeto correspondente.

Se o Firebase CLI encerrar por timeout e retornar ao prompt `PS>`, respostas como `y` não pertencem mais ao assistente. Não execute arquivos locais sugeridos pelo PowerShell para tentar responder ao assistente encerrado.
