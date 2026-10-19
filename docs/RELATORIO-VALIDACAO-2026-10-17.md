# Relatório de validação — Conflora

Data: 17/10/2026. Ambiente local isolado, com dados de teste em memória.

## Resultado e alcance

Os testes verificam regras do aplicativo, chamadas HTTP locais, permissões e telas de navegador. Sicredi, WhatsApp, mapas e persistência externa são simulados quando usados pelos testes. Nenhum cliente real recebeu cobrança ou mensagem nesta revisão.

**Este relatório não é uma homologação bancária nem uma garantia de ausência de erros em todo o site.** A publicação em produção e os testes com credenciais reais continuam necessários.

| Verificação | Resultado |
| --- | --- |
| Regras e integrações simuladas — `npm run test:dev` | 228 testes aprovados. |
| Navegador — `npm run test:e2e` | 48 testes aprovados. |
| Análise estática — `npm run lint` | Aprovada, sem erros. |
| Sintaxe — `npm run check:full` | Aprovada. |
| Dependências — `npm audit` | 8 alertas moderados; 0 altos e 0 críticos. |
| Sicredi real / certificado / mTLS / pagamento | Não executado: credenciais e autorização pendentes. |
| Entrega real de WhatsApp e leitura no aparelho | Não executada. Token/conta/modelos precisam de validação externa. |

## Fluxos cobertos

| Área | O que foi exercitado |
| --- | --- |
| Contas | Login, cargos, isolamento entre duas abas, sacolas e dados pessoais, acesso do cliente ao próprio histórico. |
| Catálogo | Pesquisa, categorias, chat, carrinho, pesos, cadastro do cliente, endereço e responsividade em 320/390/768/1440 px. |
| Admin | Navegação dos módulos, estoque, entrada/baixa/contagem, imagens, produto, equipe e restrições de acesso. |
| Caixa | Venda, troco, parcelas, envio ao caixa sem recebimento, transição das comandas e recibo. |
| Pix Sicredi | Valor fixo, txid, emissão, consulta por E2E, divergência de valor/chave, autenticação do callback e repetição de webhook. |
| Pix manual | Arquivo obrigatório, formato/tamanho, arquivo vinculado à operação e operador, confirmação auditada e baixa única. |
| Vendedor | Pix manual apenas de suas comandas; bloqueio de dinheiro/cartão, pedido alheio e comprovante de dívida por esse perfil. |
| Estoque | Reserva, competição pelo mesmo item, expiração, liberação, impossibilidade de finalizar sem saldo e operação com controle desativado. |
| Integridade | Repetição de pedido, confirmação concorrente, rollback de transação, pagamento tardio e recebimentos parciais de dívida. |
| Entregas | Quadro em tempo real, aceite único, separação, saída, recebimento, conclusão, restrição ao responsável e métricas. |
| WhatsApp | Payload de texto, upload da imagem, envio por ID, QR/copia e cola, fila, retomada após falha, token rejeitado e webhook assinado. |
| Recibos | Exibição estruturada, histórico e detalhes, identificação de vendedor/recebedor e remoção da marcação WhatsApp na tela. |

## Alterações realizadas

1. **Elevação dos cartões:** removido o efeito de sombra do botão interno. A superfície inteira do cartão recebe a elevação; foco por teclado e preferência de movimento reduzido continuam suportados.
2. **Componente de estilos:** estilos dos cartões de comandas centralizados em `public/pdv/order-card.styles.js`, usando `styled-components` compartilhado por caixa e entregas. A biblioteca é servida localmente. Não houve migração integral de todas as telas para essa biblioteca.
3. **Pix manual do vendedor:** nova permissão explícita para comandas próprias, com arquivo e observação obrigatórios. Recebimentos de outras formas continuam no caixa/admin. Cobrança Pix já emitida com outras parcelas não pode ser recebida pelo vendedor por esse atalho.
4. **Mensagens desatualizadas:** cobranças/QR pendentes de pedidos cancelados e avisos de saída de pedidos fora de rota são descartados. Jobs descartados não podem ser reclamados novamente pela fila.
5. **Autenticação Sicredi concorrente:** chamadas simultâneas compartilham a solicitação de token. Falhas liberam a solicitação para uma tentativa posterior; o token válido continua reutilizado.
6. **Cache da aplicação:** versão do cache público incrementada para distribuir os arquivos atualizados após publicação.
7. **Regressões:** acrescentados testes de autorização do vendedor, falta de estoque na confirmação bancária, QR cancelado, autenticação concorrente, rejeição de token Meta, upload de imagem e elevação visual.
8. **Documentação:** manual operacional por perfil e este relatório, com distinção entre validação local e homologação externa.

Durante a execução, um teste detectou valor incorreto no texto de conferência de Pix dividido após o ajuste de permissões. A exibição foi corrigida para mostrar a parcela Pix. A integração inicial da biblioteca de estilos também foi corrigida antes da rodada final de navegador.

## Estoque: regra validada

Pedidos comuns aguardando pagamento/separação/entrega mantêm reserva quando o controle está ativo. A confirmação do pagamento baixa uma vez; entregar um pedido previamente pago não baixa novamente. Expirar uma reserva libera disponibilidade sem somar novamente ao saldo físico.

É possível operar sem controle numérico: Admin → Estoque → Desativar estoque. Reservas anteriores são respeitadas. O teste cobre venda em dinheiro, Pix e entrega sem entrada de estoque, e o bloqueio de novas vendas sem saldo após reativar o controle.

**Exceção atual: fiado aprovado pelo admin baixa estoque e cria dívida, sem marcar o pagamento como recebido.** O proprietário confirmou expressamente essa regra nesta revisão; a quitação posterior não provoca nova baixa.

Se o banco confirmar um pagamento mas o saldo foi alterado indevidamente e ficou insuficiente, a transação não finaliza nem baixa parcialmente. O evento precisa ser reprocessado após resolução, ou conciliado pelo admin. O dinheiro bancário não é estornado automaticamente. O teste reproduz falta de saldo, correção e repetição sem baixa duplicada.

## Pendências reais encontradas na configuração local

- Ausentes: `SICREDI_CLIENT_ID`, `SICREDI_CLIENT_SECRET`, `SICREDI_CERT_PEM`, `SICREDI_KEY_PEM` e `SICREDI_PIX_KEY`.
- Ausente: proteção do callback por `SICREDI_WEBHOOK_SECRET` ou `SICREDI_WEBHOOK_GATEWAY_SECRET`.
- Ausentes: `TASK_SECRET` e `PDV_WORKER_SECRET`.
- WhatsApp: `META_APP_SECRET` ausente. Número, token e verify token estão preenchidos; isso não prova validade, acesso ou entrega.
- Não foram consultados nem modificados os segredos do servidor de produção nesta revisão.

O guia oficial do Sicredi confirma uso de mTLS/OAuth2, cobrança por txid e `modalidadeAlteracao: 0` para valor fixo. A homologação deve usar os endereços fornecidos pelo banco. Fonte consultada em 17/10/2026: [API Pix Sicredi](https://developers.sicredi.com.br/public/docs/getting-started-pix).

## Limites e próximos testes no ambiente real

1. Após autorização bancária, configurar certificado/credenciais/escopos e validar a conexão no ambiente liberado pelo Sicredi.
2. Configurar e homologar a segurança do webhook. Segredo na URL não equivale à validação de certificado cliente por mTLS.
3. Fazer cobrança controlada, pagar o valor exato e conferir extrato, confirmação, reserva e uma única baixa.
4. Reenviar evento de pagamento e conferir ausência de recebimento/baixa duplicados; testar vencimento e conciliação tardia.
5. Com Meta válida, conferir recebimento real de recibo, QR/copia e cola e aviso de saída, inclusive modelos aprovados fora da janela de atendimento.
6. Validar permissões reais de Firestore/Storage/Cloud Tasks e reconexão após reiniciar o backend.
7. Revisar os oito alertas moderados de dependências Firebase/Google. A correção automática indicada envolve versão principal de `firebase-admin`; não foi aplicada atualização forçada sem avaliar compatibilidade.

A fila registra a aceitação pela Meta e progresso local; não acompanha aqui uma garantia absoluta de leitura ou entrega única. Queda de rede depois de aceitação externa pode produzir reenvio. Os testes não substituem carga real, auditoria completa de segurança, teste de todas as combinações possíveis ou rastreamento GPS real.

## Arquitetura e manutenção

Rotas validam sessão e dados, políticas decidem permissões, serviços coordenam banco/WhatsApp e repositórios aplicam alterações transacionais. O componente visual do cartão é compartilhado; estilos e autorização novos têm responsabilidade específica. As correções mantêm esse desenho, com nomes explícitos, retornos antecipados e testes de comportamento.

Não foi realizada uma reescrita completa do projeto nem afirmada a eliminação de toda duplicação histórica. As mudanças estão concentradas nos fluxos revisados para permitir verificar comportamento financeiro e evitar alterações sem cobertura.

Evidências locais: `.audit-unit.log`, `.audit-browser.log`, `.audit-lint.log`, `.audit-check.log` e `.audit-dependencies.log` (ignoradas pelo Git). Os testes reproduzíveis ficam em `test/` e `test/browser/`.
