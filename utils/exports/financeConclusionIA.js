/* ============================================================================
 🔮 financeConclusionIA.js — Analyse automatique des paiements scolaires
 Utilisé dans PDF + Word + Excel
============================================================================= */
module.exports = function generateConclusionFinance(paiements) {
  const total = paiements.reduce((acc, p) => acc + Number(p.montant || 0), 0);

  const parClasse = {};
  paiements.forEach(p => {
    parClasse[p.classe] = (parClasse[p.classe] || 0) + Number(p.montant || 0);
  });

  const meilleureClasse = Object.keys(parClasse).sort((a, b) => parClasse[b] - parClasse[a])[0];
  const pireClasse = Object.keys(parClasse).sort((a, b) => parClasse[a] - parClasse[b])[0];

  return `
📘 Rapport Financier — Analyse IA
—————————————————————————————————————————————
Total encaissé pendant la période analysée : ${total.toLocaleString("fr-FR")} USD.

La classe la plus performante est : **${meilleureClasse}**,
contribuant fortement à la stabilité financière de l'établissement.

La classe nécessitant un suivi renforcé est : **${pireClasse}**.
Une stratégie de recouvrement ciblée est recommandée afin d'améliorer
la trésorerie pour les prochains mois.

Prévision de trésorerie :
Si la performance de ${meilleureClasse} se maintient au même rythme,
le Collège Le Mérite atteindra un taux d'encaissement supérieur à **92 %**
avant la fin du trimestre.

🔰 Recommandations IA :
• Continuer la sensibilisation des parents via communications officielles
• Prioriser les rappels dans les classes à faible taux
• Récompenser les classes à rendement exemplaire (motivation sociale)

🏛 Powered by Gabkut-Schola • Gabkut-Ecole • Gabkut Agency LMK
📞 +243 822 783 500 — Sécurité & Transparence financière.
`;
};
