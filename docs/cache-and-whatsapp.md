# Cache público e teste do WhatsApp

Validação local: 182 testes de lógica e 29 testes de navegador aprovados.
Após o ajuste final de expiração do snapshot e atualização do shell, os sete
testes de cache, catálogo, chat e configurações foram reexecutados e aprovados.
Lint e sintaxe dos módulos também aprovados. Não houve publicação ou envio real.

## Estratégia e funcionamento

1. A primeira visita baixa a interface e o catálogo. A consulta de login roda em
   paralelo e não bloqueia a exibição dos produtos.
2. O service worker guarda HTML público, estilos, logo, ícones e módulos da loja.
   Nas visitas seguintes, serve esses arquivos do Cache Storage. Requer HTTPS
   ou localhost e suporte a service workers; caso contrário, o site funciona online.
3. Configurações públicas, categorias/filtros e produtos ficam em localStorage,
   separados entre loja principal e cada tenant. O snapshot expira após 24 horas.
4. Havendo snapshot válido, o catálogo aparece antes da resposta da API. Uma
   atualização roda em segundo plano; conteúdo igual não provoca nova renderização.
   Falhas de rede preservam o último snapshot válido nessa sessão.
5. Voltar à aba ou recuperar conexão solicita uma atualização, com intervalo mínimo
   de um minuto entre tentativas. Não há polling permanente em abas ocultas.
6. Consultas simultâneas com a mesma chave compartilham uma requisição. A invalidação
   por prefixo foi corrigida para que as listas possam receber dados novos.

O cache persistente contém somente a resposta pública de configuração/catálogo.
Identidade, permissões, pedidos, saldos e pagamentos não entram nesse cache.
Admin e Caixa não são documentos de navegação offline. Checkout, preço e estoque
continuam sujeitos à validação do servidor: visualizar offline não confirma venda.
As listas privadas ainda podem precisar de feedback de espera na primeira consulta.

O service worker usa uma lista explícita de arquivos públicos, limita o total a
160 entradas e nunca intercepta endpoints `/api`. Fotos externas de produtos não
são pré-carregadas em massa; seguem o carregamento sob demanda e cache HTTP da origem.

## Publicação e atualização

- As mudanças são locais até serem publicadas; publicar backend e Hosting juntos.
- **A cada mudança da interface**, incrementar `CACHE_NAME` em
  `public/storefront/sw.js`. O navegador instala o novo shell em segundo plano.
  A nova versão entra depois que as abas antigas fecharem; não força recarga no
  meio de uma compra. A ativação limpa as versões antigas do cache da Conflora.
- Ao adicionar imports ao shell, atualizar `CORE_FILES`. A instalação é atômica:
  se faltar um arquivo, a versão nova não substitui a anterior.
- O Firebase Hosting recebe a permissão de escopo `/` para o worker. A rota
  `/store-assets/**` é encaminhada ao backend para manter os aliases existentes.
- O worker exclui navegações administrativas, transações e APIs. Não configurar
  regras genéricas que guardem todas as respostas HTTP.

Referência: [estratégias de cache de PWAs — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching).

## Teste do WhatsApp já disponível

`npm run test:whatsapp` executa dois testes isolados, sem Meta, Gemini ou Firestore:

- Verificação do webhook, rejeição de assinatura falsa e processamento do evento
  assinado como mensagem de um cliente fictício.
- Montagem da requisição de envio usando o cliente real do projeto, com resposta
  da Meta substituída por uma resposta local. Não entrega mensagem a telefone algum.

`npm run check:whatsapp` verifica apenas presença das variáveis, sem revelar valores
ou fazer chamadas externas. No ambiente local inspecionado, faltava `META_APP_SECRET`
e `WHATSAPP_AI_ENABLED` estava desativado. Token e Phone Number ID preenchidos não
comprovam que as credenciais estão válidas ou pertencem ao número de teste.

## Próximo teste: mensagem de verdade usando o número de teste da Meta

1. Abrir o aplicativo da empresa em Meta for Developers e a configuração/teste da
   API do WhatsApp. Selecionar o número de teste da Meta e adicionar/verificar o
   próprio celular como destinatário autorizado nesse ambiente.
2. Usar o token e o **Phone Number ID desse número de teste**, não misturar com
   credenciais do número comercial. Enviar o template de teste disponibilizado
   pelo painel e confirmar recebimento no próprio celular.
3. Configurar os segredos no backend de teste: `WHATSAPP_TOKEN`,
   `WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET` e `WHATSAPP_VERIFY_TOKEN`.
   App Secret é o segredo do aplicativo Meta; Verify Token é um segredo escolhido
   para a verificação do webhook. Manter valores fora de commits e do frontend.
4. Publicar esse backend de teste em HTTPS. Cadastrar como callback a URL HTTPS
   desse backend seguida de `/webhook`, com o mesmo Verify Token. Assinar o campo
   `messages` da conta/número em teste. A configuração Hosting de produção foi
   corrigida para encaminhar `/webhook` (singular), além de `/webhooks/**`.
5. Responder pelo celular ao número de teste e verificar a chegada do evento ao
   backend. Para testar respostas automáticas de vendas, definir
   `WHATSAPP_AI_ENABLED=true` **no ambiente de teste**. Com `false`, o backend
   encaminha a mensagem apenas para verificação de comprovantes.
6. Começar com uma pergunta direta sobre um produto cadastrado. Perguntas
   consultivas podem consumir créditos do Gemini; o teste local acima não consome.
   Validar depois texto, foto/QR e recibo, usando pedidos fictícios e Pix simulado.

Os testes bancários são independentes: a autorização Sicredi não impede testar o
transporte do WhatsApp. A confirmação de Pix real continua dependendo do banco.

Referência oficial da Meta: [envio de mensagem de teste](https://www.postman.com/meta/whatsapp-business-platform/request/9php9mt/send-test-message).
