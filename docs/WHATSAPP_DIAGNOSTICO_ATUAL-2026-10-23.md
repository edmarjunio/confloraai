# Diagnóstico do WhatsApp atual — 23/10/2026

Escopo desta sessão: investigar a configuração existente, executar testes autorizados e corrigir defeitos encontrados. Sem refatoração geral, remoção de arquivos, publicação, alterações na Meta ou sincronização de catálogo. As alterações locais anteriores à sessão foram preservadas, inclusive o estado do Git já existente sobre `aeb65b6`.

**Atualização autorizada pelo usuário:** “Autorizar respostas no número de teste”. `WHATSAPP_AI_ENABLED=true` foi aplicado ao `.env` e somente o processo Node da porta 8080 foi reiniciado, de PID 23768 para 19180. `/health` respondeu 200 na revisão `local-aeb65b6-dirty-whatsapp-test`; o log confirmou o `.env` correto, nenhum override WhatsApp herdado e `assistantEnabled: true`. `check:whatsapp -- --meta --require-assistant` passou. Nenhum disparo manual foi feito; a entrega/resposta no aparelho aguarda mensagem do usuário ao número de teste.

## Causas confirmadas

1. **WABA incorreto no `.env`.** O valor inicial era recusado pela Meta (`100/33`) e não correspondia à conta do número de teste. O usuário confirmou o uso do número de teste e forneceu o WABA correto. Consultas autenticadas confirmaram que `1109837771546167` é a *Test WhatsApp Business Account* e contém o Phone Number ID `1346441561890238`, identificado como *Test Number*, telefone final 7087. IDs são identificadores de ativos; nenhum token ou app secret consta deste relatório.
2. **Assistente desligado.** `WHATSAPP_AI_ENABLED=false` impedia respostas conversacionais mesmo com webhook válido. A flag foi mantida desativada durante o diagnóstico e ativada somente após a autorização específica acima.
3. **Contrato ausente.** Não havia `WHATSAPP_WELCOME_CONTRACT`, embora o nome do modelo estivesse preenchido.
4. **CTA divergente.** O botão URL aprovado é estático e aponta para `https://lojaconflora.web.app/`; o valor local anterior era diferente. A configuração exclusiva do WhatsApp foi alinhada ao modelo existente, sem alterar Hosting, navegação do site ou template na Meta.

O erro genérico do webhook não distinguia WABA, número e ausência de metadados. Eventos de outros campos inscritos também passavam pela conferência de número antes de serem ignorados. Agora campos sem consumidor são ignorados explicitamente; eventos de mensagens continuam sujeitos à validação estrita de conta/número e assinatura.

## Ambiente e processo

O comando local carrega `C:\Users\Junin\confloraai\.env`. Na inspeção inicial não havia `CONFLORA_ENV_FILE` ou variáveis WhatsApp herdadas substituindo esses valores; os IDs eram strings numéricas, sem aspas externas e sem duplicação de chaves. O arquivo não tinha BOM. Não havia `.env.dev` nessa cópia.

O carregador agora informa caminho, origem, sucesso/falha de leitura e **nomes** de variáveis herdadas com precedência, nunca seus valores. Não foi alterada a semântica de carregamento das demais configurações.

Foi encontrada instância Node local na porta 8080, sem `--watch`, com `/health` retornando revisão `local`. Alterar `.env` ou código não recarregava esse processo. O reinício autorizado foi realizado e os novos logs confirmados; não houve deploy.

## Modelo real conferido por leitura da Meta

- Nome: `boas_vindas_conflora`.
- Idioma: `pt_BR`; status: `APPROVED`; parâmetros: `POSITIONAL`.
- Cabeçalho: `IMAGE`; o código usa o logo Conflora existente, sem upload real nesta sessão.
- Corpo: `_Olá{{1}}eja muito bem-vindo à_ *Conflora Horta e Viveiro* 🥬🐣🪴`.
- Mapeamento correto: um `greeting_fragment`. Com nome, ` Cliente, s`; sem nome, `! S`. Não substituir esse parâmetro apenas pelo nome, pois o texto aprovado incorpora partes da saudação.
- Rodapé: “Escolha uma das opções abaixo para iniciar seu atendimento”.
- Botão 0: URL estática, “Catálogo virtual”, `https://lojaconflora.web.app/`.
- Botão 1: resposta rápida, “Montar minha sacola”, payload enviado `montar_sacola`.
- Botão 2: resposta rápida, “Falar com atendente”, payload enviado `btn_atendente`.

O contrato foi preenchido no `.env` ignorado pelo Git, após validar esses campos e o vínculo do número. Não foi criado, editado ou aprovado nenhum modelo na Meta. O token atual respondeu como válido, tipo `SYSTEM_USER`, com os escopos de mensagens/gestão consultados. Isso não comprova entrega de mensagem.

A URL aprovada sofreu timeout na consulta HTTP desta máquina e não pôde ser aberta pela ferramenta de navegação. Sua disponibilidade funcional precisa de conferência no aparelho; não foi declarada fora do ar nem substituída por outra URL. Por ser estática, eventual correção no template exige decisão/autorização na Meta.

## Correções pontuais de código

- Diagnóstico de rejeição separa `WABA_MISMATCH`, `PHONE_ID_MISMATCH` e metadados ausentes. Registra somente fingerprints/sufixos dos IDs, estado do assistente, revisão e origem do ambiente. Não registra corpo de mensagem, contatos, cabeçalhos ou credenciais.
- Falhas do template distinguem contrato ausente, JSON inválido, idioma/nome/componentes/CTA divergentes.
- Erro no processamento local da inbox deixou de ser silencioso; há código de diagnóstico e fingerprint do evento.
- Envio manual usava `store.id`, método inexistente: substituído por hash estável para manter a idempotência existente.
- Na chamada sintética real, o extrator Gemini retornou itens corretos, mas `action=confirm`. A integração agora aproveita os itens como atualização, sem usar uma classificação da IA como consentimento comercial. A confirmação explícita do cliente continua obrigatória.
- O bloqueio do agente desligado alcançava indevidamente notificações transacionais do caixa/Pix/encomendas. Essas notificações mantêm seu funcionamento original quando o agente conversacional está desligado, mas **continuam bloqueadas por posse humana/pausa/geração superada**. Nenhuma regra financeira, validação Sicredi ou baixa de estoque foi alterada.
- Fixtures/expectativas antigas foram ajustadas ao fluxo efetivamente existente: template em vez de menu genérico; confirmação final após pagamento; geração da inbox; pausa após envio incerto; invalidação explícita do índice no teste de mutação administrativa. As verificações comerciais foram preservadas.

Arquivos desta sessão: `src/config/env.js`, `src/integrations/whatsapp-diagnostics.js`, `src/integrations/whatsapp-welcome.js`, `src/http/app.js`, `src/http/whatsapp-admin.routes.js`, `src/server.js`, `src/services/message.service.js`, `src/services/sales-conversation.service.js`, `src/services/automation-send-guard.js`, `src/orders/pdv.service.js`, `scripts/check-whatsapp-config.js` e os testes relacionados. `.env` contém as correções locais de WABA, URL WhatsApp, contrato e ativação autorizada do assistente; não deve ser versionado.

## Verificações executadas

- **231 testes isolados aprovados, zero falhas, zero ignorados**, em 14 arquivos: WhatsApp/diagnóstico/saudação/carrinho, vendas conversacionais, agente verificado, encomendas, arquitetura comercial, preços, PDV, Pix manual, Sicredi simulado e aplicação. Banco/transporte dos testes são isolados; não gravam dados comerciais remotos.
- Uma chamada real ao extrator Gemini configurado, `gemini-3.5-flash-lite`, com frase sintética sem dados de clientes: extração de quatro rúculas e duas alfaces, retirada e dinheiro. Não houve envio de WhatsApp ou criação de comanda nessa chamada.
- Leituras Graph: validade do token, número, WABA, vínculo e template/componentes. **Nenhuma escrita na Meta.**
- ESLint dos arquivos afetados aprovado; sintaxe de 18 JS aprovada; `git diff --check` aprovado.
- Logs completos dos testes estão em `.private/whatsapp-diagnostics/`, excluído do Git/deploy. Nenhum segredo real foi impresso.

Não foram executados testes de carga/performance, navegador, entrega real do template, abertura do CTA em aparelho ou conversa completa real pelo WhatsApp. O catálogo Meta continua desabilitado e a sincronização continua desativada; o fluxo atual informa a pendência e aceita texto. Não foi introduzida implementação futura de catálogo nesta sessão.

## Comandos de diagnóstico

```powershell
npm run check:whatsapp
npm run check:whatsapp -- --meta
npm run check:whatsapp -- --meta --require-assistant
```

O primeiro é local; `--meta` realiza somente GETs de conferência. `--require-assistant` retorna erro se a configuração estiver válida, mas o agente continuar desligado. Presença de variável não é prova de vínculo, aprovação ou resposta do agente.

## Aplicação local e limites

O assistente foi habilitado e o processo local correto foi reiniciado após autorização. Essa etapa permite respostas reais e utiliza o backend já configurado (`confloraai`, pagamento manual); não configura banco isolado ou ambiente hospedado novo. Não encaminhar mensagens arbitrárias ao webhook público sem assinatura e não afrouxar as verificações para fazê-lo aceitar outra conta.

Após reinício autorizado, conferir no log o caminho do `.env`, fingerprints dos ativos, `assistantEnabled` e revisão. Enviar “menu” ao número de teste a partir de um destinatário autorizado na Meta; conferir logo/saudação/três botões e depois o atendimento por texto. Não confirmar compra real involuntariamente. Conta/número/template já foram verificados por leitura; entrega e resposta reais só ficam comprovadas após esse teste.

Rollback pontual: reverter apenas as mudanças desta sessão, preservando o trabalho local anterior e o `.env` corrigido, ou manter o agente desligado enquanto se investiga. Não apagar Firestore/inbox/outbox, alterar pausas humanas, limpar cache ou cancelar comandas. Não houve deploy nem alteração do ambiente hospedado.
