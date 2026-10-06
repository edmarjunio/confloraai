const { normalizeText } = require('../shared/string.util');
const Logger = require('../shared/logger');

const STOPWORDS = new Set([
  'qual', 'quanto', 'valor', 'preco', 'preço', 'voces', 'tem', 'possuem', 'quero', 'comprar',
  'levar', 'favor', 'ola', 'bom', 'dia', 'tarde', 'noite', 'muda', 'planta', 'plantas',
  'para', 'com', 'sem', 'mais', 'menos', 'aqui', 'mineiros', 'conflora', 'gostaria', 'saber',
]);

class LearningService {
  constructor({ firestoreRepo, catalogRepo }) {
    this.firestoreRepo = firestoreRepo;
    this.catalogRepo = catalogRepo;
  }

  async learnFromCompletedSale({ purchasedItems = [], conversationHistory = [] }) {
    const uniqueProductNames = [...new Set(purchasedItems.map((i) => i.name))];
    if (uniqueProductNames.length !== 1) {
      Logger.debug('Aprendizado ignorado: compra com multiplos produtos para evitar contaminacao cruzada.');
      return;
    }

    const targetProductName = uniqueProductNames[0];
    const productGroup = this.catalogRepo.findProductByName(targetProductName);
    if (!productGroup) {
      return;
    }

    const userTexts = conversationHistory
      .filter((m) => m.role === 'user')
      .map((m) => normalizeText(m.text));

    const candidateTerms = new Set();

    for (const text of userTexts) {
      const words = text.split(' ').filter((w) => w.length > 2 && !STOPWORDS.has(w));
      if (words.length >= 2 && words.length <= 4) {
        candidateTerms.add(words.join(' '));
      }
      for (const w of words) {
        if (w.length > 4 && !STOPWORDS.has(w)) {
          candidateTerms.add(w);
        }
      }
    }

    const normalizedTargetName = normalizeText(targetProductName);

    for (const term of candidateTerms) {
      if (normalizedTargetName.includes(term) || productGroup.tags.has(term)) {
        continue;
      }

      this.catalogRepo.registerLearnedTag(targetProductName, term);

      if (this.firestoreRepo && this.firestoreRepo.firestore) {
        try {
          const docKey = normalizedTargetName + '_' + term.replace(/\s+/g, '_');
          await this.firestoreRepo.firestore
            .collection('learned_tags')
            .doc(docKey)
            .set({
              productName: targetProductName,
              learnedTag: term,
              confidence: 0.9,
              learnedAt: new Date().toISOString(),
            }, { merge: true });
        } catch (err) {
          Logger.warn('Erro ao persistir tag aprendida no Firestore', { error: err.message });
        }
      }
    }
  }
}

module.exports = {
  LearningService,
};
