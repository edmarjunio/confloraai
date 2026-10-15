const dictionary = require('../../src/web/i18n/locales/pt-BR.json');
module.exports = function translationPlugin({ types: t }) {
  return { visitor: {
    Program: { enter(path, state) { state.translateId = path.scope.generateUidIdentifier('translate'); state.used = false; },
      exit(path, state) {
        if (state.used) path.unshiftContainer('body', t.importDeclaration([t.importSpecifier(state.translateId, t.identifier('translate'))], t.stringLiteral('@i18n')));
      } },
    MemberExpression(path, state) {
      if (!t.isStringLiteral(path.node.object) || !t.isIdentifier(path.node.property, { name: 'tr' }) || path.node.computed) return;
      const key = path.node.object.value;
      if (!Object.hasOwn(dictionary, key)) throw path.buildCodeFrameError(`Unknown translation key: ${key}`);
      state.used = true;
      const args = [t.stringLiteral(key)];
      if (path.parentPath.isCallExpression() && path.parentPath.node.callee === path.node) {
        args.push(...path.parentPath.node.arguments);
        path.parentPath.replaceWith(t.callExpression(state.translateId, args));
      } else path.replaceWith(t.callExpression(state.translateId, args));
    },
    JSXText(path) {
      if (path.node.value.trim()) throw path.buildCodeFrameError('Interface text must use a translation key.');
    },
    JSXAttribute(path) {
      if (['title','placeholder','aria-label','alt'].includes(path.node.name.name) && t.isStringLiteral(path.node.value) && path.node.value.value) {
        throw path.buildCodeFrameError('Accessible text must use a translation key or data expression.');
      }
    },
  } };
};
