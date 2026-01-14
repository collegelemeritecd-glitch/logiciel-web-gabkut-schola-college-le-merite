// controllers/publicPaiementsController.js
const PaiementIntention = require('../models/PaiementIntention');

const ANNEE_SCOLAIRE = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';
const DEVISE = process.env.DEVISE || 'USD';

/**
 * POST /api/public/paiements/intention
 * Reçoit les infos du formulaire public et crée une intention "pending"
 */
exports.creerIntentionPaiement = async (req, res) => {
  try {
    const {
      reference,
      montant,
      mois,
      moyenPaiement,
      devise,
      telephonePayer,
      emailPayer,
      emailParent,
      parentNom,
      noteAdministrative,
    } = req.body || {};

    console.log('📥 Intention paiement reçue (public):', {
      reference,
      montant,
      mois,
      emailPayer,
      emailParent,
      parentNom,
      noteAdministrative,
    });

    if (!reference || !String(reference).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Matricule élève (reference) obligatoire.',
      });
    }

    const montantNum = Number(montant);
    if (!Number.isFinite(montantNum) || montantNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Montant invalide.',
      });
    }

    if (!mois) {
      return res.status(400).json({
        success: false,
        message: 'Le mois concerné est obligatoire.',
      });
    }

    const moyen = moyenPaiement || 'Mobile Money';

    const intention = await PaiementIntention.create({
      reference: String(reference).trim(), // matricule
      montant: montantNum,
      devise: devise || DEVISE,
      mois,
      moyenPaiement: moyen,
      telephonePayer: telephonePayer || null,
      emailPayer: emailPayer || null,
      emailParent: emailParent || null,
      parentNom: parentNom || null,
      noteAdministrative: noteAdministrative || null,
      status: 'pending',
      anneeScolaire: ANNEE_SCOLAIRE,
    });

    console.log(
      '💡 Intention de paiement créée:',
      intention.reference,
      '-',
      intention.montant,
      intention.mois,
      'emails =>',
      { emailPayer: intention.emailPayer, emailParent: intention.emailParent }
    );

    return res.status(201).json({
      success: true,
      message: 'Intention de paiement enregistrée.',
      intentionId: intention._id,
    });
  } catch (err) {
    console.error('❌ Erreur creerIntentionPaiement:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'enregistrement de l'intention.",
    });
  }
};
