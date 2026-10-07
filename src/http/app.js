let expressModule = null;
function getExpress() {
  if (!expressModule) {
    try {
      expressModule = require('express');
    } catch {
      return null;
    }
  }
  return expressModule;
}

const config = require('../config/env');
const Logger = require('../shared/logger');
const { SignatureValidator } = require('../security/signature.validator');

function renderPrivacyPolicyHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Política de Privacidade | Conflora Horta e Viveiro</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 800px; margin: 0 auto; padding: 24px 16px; background-color: #f7fafc; }
    .card { background: white; padding: 36px 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    h1 { color: #22543d; font-size: 28px; margin-bottom: 8px; }
    h2 { color: #276749; font-size: 20px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    p, li { font-size: 15px; color: #4a5568; }
    ul { padding-left: 20px; }
    .contact-box { background: #edf2f7; border-left: 4px solid #38a169; padding: 14px 18px; border-radius: 4px; margin-top: 20px; }
    footer { text-align: center; margin-top: 32px; font-size: 13px; color: #a0aec0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Política de Privacidade</h1>
    <p><strong>Conflora Horta e Viveiro & Agromadeiras</strong> — Mineiros, Goiás</p>
    <p><em>Última atualização: Outubro de 2026</em></p>

    <p>Esta Política de Privacidade descreve como a Conflora coleta, utiliza e protege os dados pessoais fornecidos por usuários que interagem com nosso canal oficial de atendimento automatizado e vendas no WhatsApp, em total conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong> e as políticas da <strong>Meta Platforms</strong>.</p>

    <h2>1. Dados Coletados</h2>
    <p>Ao interagir com nosso atendimento via WhatsApp, podemos coletar exclusivamente:</p>
    <ul>
      <li><strong>Identificação básica:</strong> Nome de exibição do perfil no WhatsApp e número de telefone celular.</li>
      <li><strong>Mensagens de atendimento:</strong> Histórico das mensagens trocadas, dúvidas sobre plantas, pedidos de orçamento e itens solicitados do catálogo.</li>
      <li><strong>Comprovantes de pagamento:</strong> Imagens ou documentos de comprovante PIX enviados voluntariamente para confirmação de compras.</li>
    </ul>

    <h2>2. Finalidade do Tratamento dos Dados</h2>
    <p>Os dados coletados são utilizados estritamente para:</p>
    <ul>
      <li>Prestar atendimento ao cliente, responder dúvidas sobre espécies de plantas, portes e valores.</li>
      <li>Montar orçamentos e emitir resumos de pedidos comerciais.</li>
      <li>Confirmar pagamentos PIX e organizar a separação de plantas para retirada ou entrega.</li>
      <li>Garantir a segurança, prevenção contra fraudes e melhoria contínua do atendimento.</li>
    </ul>

    <h2>3. Compartilhamento Seguro de Dados</h2>
    <p>A Conflora <strong>não comercializa, não aluga e não compartilha</strong> dados pessoais com terceiros para fins publicitários. Os dados transitam unicamente por provedores de infraestrutura tecnológica essenciais para o funcionamento do serviço:</p>
    <ul>
      <li><strong>Meta Platforms (WhatsApp Cloud API):</strong> Infraestrutura oficial de envio e recebimento de mensagens.</li>
      <li><strong>Google Cloud Platform:</strong> Hospedagem segura de servidores e banco de dados para armazenamento do histórico de atendimento.</li>
    </ul>

    <h2>4. Retenção e Segurança dos Dados</h2>
    <p>Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados contra acessos não autorizados ou destruição acidental. O histórico de mensagens é mantido apenas pelo tempo necessário para cumprimento das finalidades comerciais ou exigências legais.</p>

    <h2>5. Seus Direitos (LGPD) e Exclusão de Dados</h2>
    <p>Você tem o direito de solicitar a confirmação de tratamento, acesso, correção ou a <strong>exclusão total de seus dados pessoais</strong> a qualquer momento.</p>
    <p>Para solicitar a exclusão definitiva de seus dados do nosso sistema, consulte nossa página de <a href="/exclusao-de-dados" style="color: #276749; font-weight: bold;">Instruções de Exclusão de Dados</a> ou envie uma mensagem diretamente para nosso canal de contato.</p>

    <div class="contact-box">
      <strong>Canal do Encarregado de Dados (DPO / Contato):</strong><br>
      E-mail: <a href="mailto:edmarjuniob@gmail.com">edmarjuniob@gmail.com</a><br>
      Localização: Mineiros - GO, Brasil
    </div>
  </div>
  <footer>
    &copy; 2026 Conflora Horta e Viveiro. Todos os direitos reservados.
  </footer>
</body>
</html>`;
}

function renderDataDeletionHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Instruções de Exclusão de Dados | Conflora AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 800px; margin: 0 auto; padding: 24px 16px; background-color: #f7fafc; }
    .card { background: white; padding: 36px 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    h1 { color: #22543d; font-size: 26px; margin-bottom: 8px; }
    h2 { color: #276749; font-size: 19px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    p, li { font-size: 15px; color: #4a5568; }
    .step-box { background: #f0fff4; border-left: 4px solid #38a169; padding: 14px 18px; border-radius: 4px; margin: 16px 0; }
    footer { text-align: center; margin-top: 32px; font-size: 13px; color: #a0aec0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Instruções de Exclusão de Dados do Usuário</h1>
    <p><strong>Conflora Horta e Viveiro</strong> — Atendimento WhatsApp</p>
    <p>Em conformidade com as diretrizes da <strong>Meta Platforms</strong> e o Artigo 18 da <strong>LGPD</strong>, você tem o direito de solicitar a remoção completa de todas as suas informações e histórico de conversas do nosso sistema a qualquer momento.</p>

    <h2>Como solicitar a exclusão de seus dados:</h2>

    <div class="step-box">
      <strong>Opção 1: Via E-mail Oficial</strong><br>
      Envie um e-mail para <a href="mailto:edmarjuniob@gmail.com"><strong>edmarjuniob@gmail.com</strong></a> com:<br>
      • <strong>Assunto:</strong> Solicitação de Exclusão de Dados (LGPD)<br>
      • <strong>Corpo do e-mail:</strong> Informe o número de telefone (com DDD) utilizado no WhatsApp da Conflora.
    </div>

    <div class="step-box">
      <strong>Opção 2: Diretamente pelo WhatsApp</strong><br>
      Envie a mensagem <code>"Excluir meus dados"</code> ou <code>"Apagar histórico"</code> para o nosso número de atendimento comercial no WhatsApp.
    </div>

    <h2>Prazo e Procedimento:</h2>
    <p>Após o recebimento da solicitação, nossa equipe processará a exclusão em até <strong>48 horas úteis</strong>. Todas as sessões, mensagens e informações vinculadas ao seu número de telefone serão permanentemente apagadas ou anonimizadas do nosso banco de dados no Firestore.</p>

    <p><a href="/politica-de-privacidade" style="color: #276749;">← Voltar para a Política de Privacidade</a></p>
  </div>
  <footer>
    &copy; 2026 Conflora Horta e Viveiro. Todos os direitos reservados.
  </footer>
</body>
</html>`;
}

function renderHomeHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conflora AI — Atendimento & Vendas WhatsApp</title>
  <style>
    :root {
      --primary: #22543d;
      --primary-light: #276749;
      --accent: #38a169;
      --bg: #f7fafc;
      --card-bg: #ffffff;
      --text: #2d3748;
      --text-muted: #718096;
      --border: #e2e8f0;
      --chat-user: #dcf8c6;
      --chat-bot: #ffffff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; padding: 20px 16px; }
    .container { max-width: 960px; margin: 0 auto; }
    header { background: var(--card-bg); border-radius: 12px; padding: 24px 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); margin-bottom: 20px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; }
    .brand h1 { color: var(--primary); font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .brand p { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
    .badge-status { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; background: #def7ec; color: #03543f; }
    .badge-status::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #31c48d; }
    .grid { display: grid; grid-template-columns: 1fr 1.3fr; gap: 20px; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
    .card { background: var(--card-bg); border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); }
    h2 { font-size: 18px; color: var(--primary-light); margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #edf2f7; }
    .info-item { margin-bottom: 12px; font-size: 14px; }
    .info-item strong { color: var(--primary); }
    .links-list { list-style: none; margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
    .links-list a { display: inline-flex; align-items: center; color: var(--primary-light); text-decoration: none; font-size: 14px; font-weight: 500; padding: 8px 12px; background: #f0fff4; border-radius: 6px; transition: background 0.2s; }
    .links-list a:hover { background: #dcfce7; }
    .chat-container { display: flex; flex-direction: column; height: 540px; }
    .chat-messages { flex: 1; overflow-y: auto; padding: 16px; background: #efeae2; border-radius: 8px; display: flex; flex-direction: column; gap: 12px; }
    .message-bubble { max-width: 82%; padding: 10px 14px; border-radius: 8px; font-size: 14px; word-break: break-word; white-space: pre-wrap; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    .message-bubble.user { align-self: flex-end; background: var(--chat-user); border-top-right-radius: 2px; }
    .message-bubble.assistant { align-self: flex-start; background: var(--chat-bot); border-top-left-radius: 2px; }
    .message-meta { font-size: 11px; color: var(--text-muted); margin-top: 4px; text-align: right; }
    .quick-prompts { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 8px; }
    .quick-btn { background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 14px; padding: 4px 10px; font-size: 12px; cursor: pointer; color: #4a5568; transition: all 0.15s; }
    .quick-btn:hover { background: #e2e8f0; color: #2d3748; }
    .chat-inputs { display: flex; gap: 8px; margin-top: 8px; }
    .chat-input { flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; outline: none; }
    .chat-input:focus { border-color: var(--accent); }
    .send-btn { background: var(--accent); color: white; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .send-btn:hover { background: #2f855a; }
    .send-btn:disabled { background: #cbd5e0; cursor: not-allowed; }
    .phone-row { display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px; }
    .phone-row input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <h1>🌱 Conflora AI <span>v2.1</span></h1>
        <p>Atendimento Inteligente no WhatsApp — Conflora Horta e Viveiro & Agromadeiras</p>
      </div>
      <span class="badge-status">Servidor Ativo (Porta 3000)</span>
    </header>

    <div class="grid">
      <div>
        <div class="card" style="margin-bottom: 20px;">
          <h2>Visão Geral do Sistema</h2>
          <div class="info-item"><strong>WhatsApp Cloud API:</strong> Webhook Meta ativo e verificado</div>
          <div class="info-item"><strong>Catálogo:</strong> Google Sheets com fallback em contingência</div>
          <div class="info-item"><strong>Inteligência Artificial:</strong> Gemini 2.5 Flash / Assistente Conflora</div>
          <div class="info-item"><strong>Persistência:</strong> Firestore com fallback em memória</div>
          <div class="info-item"><strong>Filas:</strong> Cloud Tasks com processamento assíncrono</div>
        </div>

        <div class="card">
          <h2>Conformidade & Links Meta</h2>
          <ul class="links-list">
            <li><a href="/politica-de-privacidade">📄 Política de Privacidade (LGPD)</a></li>
            <li><a href="/exclusao-de-dados">🗑️ Instruções de Exclusão de Dados</a></li>
            <li><a href="/termos-de-servico">⚖️ Termos de Serviço</a></li>
            <li><a href="/health">🩺 Status de Saúde (/health)</a></li>
          </ul>
        </div>
      </div>

      <div class="card">
        <h2>Simulador de Atendimento WhatsApp</h2>
        <div class="chat-container">
          <div class="phone-row">
            <input type="text" id="phone" value="5564999990001" placeholder="Telefone com DDD" style="width: 140px;" />
            <input type="text" id="custName" value="Cliente Teste" placeholder="Nome do cliente" style="flex: 1;" />
          </div>

          <div class="chat-messages" id="messages">
            <div class="message-bubble assistant">
              Olá! Seja muito bem-vindo à Conflora Horta e Viveiro 🌱. Sou o assistente de vendas e estou à sua disposição. Como posso ajudar?
              <div class="message-meta">Conflora AI</div>
            </div>
          </div>

          <div class="quick-prompts">
            <button class="quick-btn" onclick="sendPrompt('qual valor da palmeira rabo de raposa?')">Palmeira Rabo de Raposa</button>
            <button class="quick-btn" onclick="sendPrompt('Vocês tem mini cabra??')">Mini Cabra</button>
            <button class="quick-btn" onclick="sendPrompt('Vocês tem palmeiras?')">Consultoria Palmeiras</button>
            <button class="quick-btn" onclick="sendPrompt('Manda pra mim 3 alface cabeça de 8, 3 rucula e 5 cebolinha')">Fazer Pedido Horta</button>
            <button class="quick-btn" onclick="sendPrompt('pode me mandar foto da palmeira rabo de raposa?')">Pedir Fotos</button>
            <button class="quick-btn" onclick="sendPrompt('Hoje vai ser no débito')">Mudar Pagamento</button>
            <button class="quick-btn" onclick="sendPrompt('Pode confirmar!')">Confirmar Pedido</button>
          </div>

          <div class="chat-inputs">
            <input type="text" id="userMsg" class="chat-input" placeholder="Digite uma mensagem para o assistente..." onkeydown="if(event.key==='Enter') sendMessage()" />
            <button id="sendBtn" class="send-btn" onclick="sendMessage()">Enviar</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const messagesEl = document.getElementById('messages');
    const userMsgEl = document.getElementById('userMsg');
    const sendBtnEl = document.getElementById('sendBtn');
    const phoneEl = document.getElementById('phone');
    const nameEl = document.getElementById('custName');

    function sendPrompt(text) {
      userMsgEl.value = text;
      sendMessage();
    }

    async function sendMessage() {
      const text = userMsgEl.value.trim();
      const phone = phoneEl.value.trim() || '5564999990001';
      const name = nameEl.value.trim() || 'Cliente Teste';
      if (!text) return;

      appendBubble(text, 'user', name);
      userMsgEl.value = '';
      sendBtnEl.disabled = true;

      const loadingBubble = appendBubble('Digitando...', 'assistant', 'Conflora AI');

      try {
        const res = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telefone: phone, nome: name, mensagem: text }),
        });
        const data = await res.json();
        loadingBubble.remove();

        if (data.reply) {
          const metaInfo = (data.intent ? 'Intent: ' + data.intent : '') + (data.latencyMs ? ' (' + data.latencyMs + 'ms)' : '');
          appendBubble(data.reply, 'assistant', 'Conflora AI', metaInfo);
        } else if (data.error) {
          appendBubble('Erro: ' + data.error, 'assistant', 'Sistema');
        } else {
          appendBubble('Sem resposta do atendente.', 'assistant', 'Conflora AI');
        }
      } catch (err) {
        loadingBubble.remove();
        appendBubble('Erro de conexão ao enviar mensagem: ' + err.message, 'assistant', 'Sistema');
      } finally {
        sendBtnEl.disabled = false;
        userMsgEl.focus();
      }
    }

    function appendBubble(text, role, sender, extraMeta) {
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble ' + role;
      bubble.textContent = text;
      const meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.textContent = sender + (extraMeta ? ' • ' + extraMeta : '');
      bubble.appendChild(meta);
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return bubble;
    }
  </script>
</body>
</html>`;
}

function renderTermsOfServiceHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termos de Serviço | Conflora AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 800px; margin: 0 auto; padding: 24px 16px; background-color: #f7fafc; }
    .card { background: white; padding: 36px 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    h1 { color: #22543d; font-size: 26px; margin-bottom: 8px; }
    h2 { color: #276749; font-size: 19px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    p, li { font-size: 15px; color: #4a5568; }
    footer { text-align: center; margin-top: 32px; font-size: 13px; color: #a0aec0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Termos de Serviço</h1>
    <p><strong>Conflora Horta e Viveiro</strong> — Atendimento WhatsApp</p>

    <h2>1. O Serviço</h2>
    <p>O canal de atendimento via WhatsApp da Conflora é uma ferramenta voltada para disponibilizar catálogo de plantas, tirar dúvidas sobre espécies e portes, orçar pedidos e fornecer suporte a clientes na cidade de Mineiros - GO e região.</p>

    <h2>2. Disponibilidade e Preços</h2>
    <p>Os valores e disponibilidades de mudas, plantas ornamentais, hortaliças e insumos são baseados no estoque físico e catálogo oficial da Conflora. Os pedidos tornam-se vinculantes após a confirmação mútua e validação do pagamento.</p>

    <h2>3. Contato</h2>
    <p>Dúvidas sobre estes termos podem ser enviadas para <a href="mailto:edmarjuniob@gmail.com">edmarjuniob@gmail.com</a>.</p>
  </div>
  <footer>
    &copy; 2026 Conflora Horta e Viveiro. Todos os direitos reservados.
  </footer>
</body>
</html>`;
}

function createApp({ messageService, taskQueueClient }) {
  const express = getExpress();
  if (!express) { throw new Error('Express module not available'); }
  const app = express();
  const signatureValidator = new SignatureValidator(config.whatsapp.metaAppSecret);

  // Preserve raw body buffer for signature validation
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Home / Dashboard & Test Console
  app.get('/', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderHomeHtml());
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  // Meta Verification: Política de Privacidade
  app.get(['/politica-de-privacidade', '/privacy'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderPrivacyPolicyHtml());
  });

  // Meta Verification: Exclusão de Dados do Usuário
  app.get(['/exclusao-de-dados', '/data-deletion'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderDataDeletionHtml());
  });

  // Meta Verification: Termos de Serviço
  app.get(['/termos-de-servico', '/terms'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderTermsOfServiceHtml());
  });

  // Meta Webhook Verification (GET)
  app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      Logger.info('Meta Webhook verificado com sucesso.');
      return res.status(200).send(challenge);
    }

    Logger.warn('Tentativa de verificação do Webhook com token inválido.');
    return res.sendStatus(403);
  });

  // Meta Webhook Event Receiver (POST)
  app.post('/webhook', async (req, res) => {
    const signature = req.headers['x-hub-signature-256'];

    if (!signatureValidator.validate(req.rawBody, signature)) {
      Logger.warn('Assinatura do webhook inválida.');
      return res.sendStatus(401);
    }

    res.sendStatus(200);

    const body = req.body;
    if (body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) {
      return;
    }

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value || !Array.isArray(value.messages)) {
          continue;
        }

        for (const msg of value.messages) {
          const phone = msg.from;
          const messageId = msg.id;
          const text = msg.text?.body || '';
          const customerName = value.contacts?.[0]?.profile?.name || '';

          if (!text) {
            continue;
          }

          const taskPayload = { phone, message: text, customerName, messageId };

          if (taskQueueClient) {
            await taskQueueClient.enqueueProcessMessage(taskPayload).catch((err) => {
              Logger.error('Erro ao enfileirar tarefa; processando diretamente', err);
              messageService.handleCustomerMessage(taskPayload).catch(() => {});
            });
          } else {
            setImmediate(() => {
              messageService.handleCustomerMessage(taskPayload).catch(() => {});
            });
          }
        }
      }
    }
  });

  // Cloud Tasks Processing Endpoint
  app.post('/tasks/processar-mensagem', async (req, res) => {
    const secret = req.headers['x-conflora-task-secret'];
    if (config.tasks.taskSecret && secret !== config.tasks.taskSecret) {
      return res.sendStatus(401);
    }

    const { phone, message, customerName, messageId } = req.body;
    if (!phone || !message) {
      return res.status(400).send('Dados inválidos');
    }

    try {
      const result = await messageService.handleCustomerMessage({
        phone,
        message,
        customerName,
        messageId,
      });
      res.status(200).json(result);
    } catch (error) {
      Logger.error('Erro ao processar mensagem via Cloud Tasks', error);
      res.status(500).send('Erro interno');
    }
  });

  // Local Testing Chat Endpoint
  if (config.isDev || process.env.NODE_ENV !== 'production') {
    app.post('/chat', async (req, res) => {
      const { telefone, nome, mensagem } = req.body;
      if (!telefone || !mensagem) {
        return res.status(400).json({ error: 'Campos "telefone" e "mensagem" são obrigatórios.' });
      }

      try {
        const result = await messageService.handleCustomerMessage({
          phone: telefone,
          message: mensagem,
          customerName: nome || 'Cliente Teste',
          messageId: `local-${Date.now()}`,
        });
        res.status(200).json(result);
      } catch (error) {
        Logger.error('Erro no endpoint /chat local', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  return app;
}

module.exports = {
  createApp,
  renderHomeHtml,
  renderPrivacyPolicyHtml,
  renderDataDeletionHtml,
  renderTermsOfServiceHtml,
};
