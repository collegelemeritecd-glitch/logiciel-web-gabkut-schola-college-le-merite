const Paiement = require('../models/Paiement');
const { envoyerEmailsIntelligents } = require('../utils/envoyerEmailsIntelligents');

const ANNEE_SCOLAIRE = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';

exports.envoyerMailsMobileMoney = async (req, res) => {
  try {
    const { depuis, jusqua, uniquementSansEmail } = req.body || {};

    const filtre = {
      anneeConcernee: ANNEE_SCOLAIRE,
      modePaiement: 'Mobile Money',
    };

    if (depuis || jusqua) {
      filtre.datePaiement = {};
      if (depuis) filtre.datePaiement.$gte = new Date(depuis);
      if (jusqua) filtre.datePaiement.$lte = new Date(jusqua);
    }

    if (uniquementSansEmail) {
      filtre.$or = [
        { emailEleve: { $exists: false } },
        { emailParent: { $exists: false } },
      ];
    }

    const paiements = await Paiement.find(filtre).lean();

    if (!paiements.length) {
      return res.status(200).json({
        success: true,
        message: 'Aucun paiement Mobile Money trouvé pour ces critères.',
        count: 0,
      });
    }

    let envoyes = 0;
    let erreurs = 0;

    for (const p of paiements) {
      try {
        // on repasse en objet "model-like" pour la fonction utilitaire
        const paiementObj = { ...p };

        // sécuriser les champs d’email si besoin (déjà faits normalement au moment du paiement)
        paiementObj.emailEleve = paiementObj.emailEleve || null;
        paiementObj.emailParent = paiementObj.emailParent || null;
        paiementObj.emailPercepteur = paiementObj.emailPercepteur || null;

        await envoyerEmailsIntelligents(paiementObj, null);
        envoyes += 1;
      } catch (err) {
        console.error('❌ Erreur envoi email Mobile Money:', p._id, err.message);
        erreurs += 1;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Traitement des mails Mobile Money terminé.',
      count: paiements.length,
      envoyes,
      erreurs,
    });
  } catch (err) {
    console.error('❌ Erreur envoyerMailsMobileMoney:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'envoi des mails Mobile Money.",
    });
  }
};
