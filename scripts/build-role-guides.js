const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(__dirname, '../public/guias');
const guides = {
  admin: { title: 'Guia do administrador', steps: [
    'Entre com sua conta Google de administrador.',
    'Cadastre as configurações da loja, os produtos e o estoque real antes de habilitar as vendas.',
    'Cadastre os colaboradores com os perfis e permissões necessários.',
    'Confira vendas, pagamentos, entregas e fechamentos no painel gerencial.',
    'Acompanhe falhas na aba Sistema. O teste Sicredi executa somente uma simulação isolada.',
  ] },
  caixa: { title: 'Guia do caixa', steps: [
    'Entre com seu usuário e PIN cadastrados pelo administrador.',
    'Selecione os produtos ou abra uma comanda existente.',
    'Confira os itens, valores e a forma de pagamento antes de receber.',
    'No Pix manual, confirme o recebimento no extrato antes de aprovar o comprovante. No Sicredi integrado, aguarde a confirmação bancária.',
    'No fechamento, informe os valores conferidos e anexe os comprovantes solicitados.',
  ] },
  vendedor: { title: 'Guia do vendedor', steps: [
    'Entre com seu usuário e PIN cadastrados pelo administrador.',
    'Monte a sacola com os produtos cadastrados e confira as quantidades.',
    'Informe os dados do cliente e selecione retirada ou entrega.',
    'Revise a comanda antes de encaminhar o pagamento ao caixa.',
    'Acompanhe o andamento do pedido nas comandas.',
  ] },
  entregador: { title: 'Guia do entregador', steps: [
    'Entre com seu usuário e PIN cadastrados pelo administrador.',
    'Aceite uma entrega disponível e confira os itens do pedido.',
    'Use o endereço cadastrado para iniciar a rota.',
    'Registre a entrega e o recebimento conforme a forma de pagamento do pedido.',
    'Confira seus recebimentos e entregas ao encerrar o turno.',
  ] },
};
function document(title, content) {
  return `<!doctype html><html lang="pt-BR"><head><script src="/store-assets/i18n-runtime.js"></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Conflora</title>
  <style>body{font:17px/1.6 system-ui;max-width:760px;margin:40px auto;padding:0 20px;color:#173b2b}li{margin:16px 0}a{color:#137341}</style></head>
  <body><a href="/">Conflora</a><h1>${title}</h1>${content}<p><a href="/guias/">Todos os guias</a></p></body></html>`;
}
for (const [role, guide] of Object.entries(guides)) fs.writeFileSync(path.join(directory, `${role}.html`), document(guide.title,
  '<ol>' + guide.steps.map(step => `<li>${step}</li>`).join('') + '</ol>'));
fs.writeFileSync(path.join(directory, 'index.html'), document('Guias de uso', '<ul>' + Object.entries(guides)
  .map(([role, guide]) => `<li><a href="/guias/${role}.html">${guide.title}</a></li>`).join('') + '</ul>'));
