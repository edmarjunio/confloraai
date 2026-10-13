const { renderHomeHtml } = require('./views-home');
const { renderAdminHtml } = require('./views-admin');
const { renderCaixaHtml } = require('./views-caixa');
const { renderAdminGerencialHtml } = require('./views-admin-gerencial');

module.exports = {
  renderHomeHtml,
  renderAdminHtml,
  renderCaixaHtml,
  renderAdminGerencialHtml,
};
