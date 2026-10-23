require('../i18n/default');
const { renderAdminHtml } = require('./views-admin');
const { renderCaixaHtml } = require('./views-caixa');
const { renderAdminGerencialHtml } = require('./views-admin-gerencial');

module.exports = {
  renderAdminHtml,
  renderCaixaHtml,
  renderAdminGerencialHtml,
};
