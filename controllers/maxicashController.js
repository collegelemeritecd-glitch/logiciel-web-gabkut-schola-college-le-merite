// controllers/maxicashController.js
const Paiement = require('../models/Paiement');
const Eleve = require('../models/Eleve');
const LogActivite = require('../models/LogActivite');
const PaiementIntention = require('../models/PaiementIntention');

const { generateSchoolReceiptPDF } = require('../utils/generateSchoolReceiptPDF');
const { envoyerEmailsIntelligents } = require('../utils/envoyerEmailsIntelligents');

const MERCHANT_ID = process.env.MAXICASH_MERCHANT_ID;
const MERCHANT_PASS =
  process.env.MAXICASH_MERCHANT_PASSWORD || process.env.MAXICASH_MERCHANT_PASS;

const ANNEE_SCOLAIRE = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';
const DEVISE = process.env.DEVISE || 'USD';
const ECOLE_EMAIL = process.env.ECOLE_EMAILS || 'collegelemerite.cd@gmail.com';
const ECOLE_NOM = 'Collège Le Mérite';

/**
 * Utils: parser un montant en cents -> montant en devise
 */
function centsToAmount(cents) {
  const n = Number(cents || 0);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

/**
 * Utils: déterminer si le statut représente un succès
 */
function isMaxicashSuccessStatus(status) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return s.includes('success') || s.includes('completed') || s.includes('approved');
}

/**
 * Générer une référence paiement COLM-GABK-...
 */
function generatePaiementReference(prefix = 'COLM-GABK') {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${y}${m}${d}-${h}${min}${s}-${rnd}`;
}

/**
 * Page HTML simple pour accept / decline / cancel
 */
function buildStatusHtml(title, message, success = false) {
  const color = success ? '#059669' : '#b91c1c';
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f3f4f6; padding:0; margin:0;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:10px;box-shadow:0 10px 25px rgba(15,23,42,0.1);padding:22px 20px;">
    <h1 style="font-size:1.3rem;margin:0 0 6px 0;color:${color};text-align:center;">${title}</h1>
    <p style="font-size:0.9rem;color:#111827;text-align:center;margin:0 0 12px 0;">${message}</p>
    <p style="font-size:0.8rem;color:#6b7280;text-align:center;margin-top:8px;">
      Vous pouvez fermer cette page et revenir au portail du Collège Le Mérite.
    </p>
  </div>
</body>
</html>`;
}

/* =========================================================================
 1) Redirections utilisateur (accept / decline / cancel)
============================================================================ */

exports.handleAccept = async (req, res) => {
  try {
    const {
      status,
      reference,
      Method,
      TransactionID,
      Reference,
      Status,
    } = req.query;

    console.log('[MaxiCash ACCEPT] Query:', req.query);

    const refMatricule = reference || Reference || '';

    const frontBase =
      process.env.PUBLIC_FRONT_BASE_URL || 'http://localhost:8080';
    const redirectUrl = new URL('/public-paiement-maxicash-success.html', frontBase);

    if (refMatricule) {
      redirectUrl.searchParams.set('matricule', refMatricule);
    }
    redirectUrl.searchParams.set('status', status || Status || '');
    redirectUrl.searchParams.set('method', Method || '');
    redirectUrl.searchParams.set('tx', TransactionID || '');

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error('[MaxiCash ACCEPT] Erreur générale:', err);
    const html = buildStatusHtml(
      'Paiement réussi',
      'Votre paiement a été enregistré sur la passerelle. Vous pouvez revenir au portail.',
      true
    );
    return res.status(500).send(html);
  }
};

exports.handleDecline = async (req, res) => {
  console.log('[MaxiCash DECLINE] Query:', req.query);
  const { Reference, Status } = req.query;
  const html = buildStatusHtml(
    'Paiement refusé',
    `Le paiement a été refusé ou a échoué. Référence: ${Reference || '-'}. Statut: ${Status || 'inconnu'}.`
  );
  return res.status(200).send(html);
};

exports.handleCancel = async (req, res) => {
  console.log('[MaxiCash CANCEL] Query:', req.query);
  const { Reference } = req.query;
  const html = buildStatusHtml(
    'Paiement annulé',
    `Le paiement a été annulé par l’utilisateur. Référence: ${Reference || '-'}.`
  );
  return res.status(200).send(html);
};

exports.showStatusPage = async (req, res) => {
  const { ref } = req.query;
  const paiement = await Paiement.findOne({ referencePaiement: ref }).lean();
  const title = paiement ? 'Statut du paiement' : 'Paiement introuvable';
  const message = paiement
    ? `Paiement pour ${paiement.eleveNom || 'élève'} - Montant: ${paiement.montant} ${paiement.devise || DEVISE}, Statut: ${paiement.statut || 'inconnu'}.`
    : `Aucun paiement trouvé avec la référence ${ref || '-'}.`;
  return res.status(200).send(buildStatusHtml(title, message, !!paiement));
};

/* =========================================================================
 2) Webhook notifyurl (POST /api/maxicash)
============================================================================ */

exports.handleNotify = async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('📥 MaxiCash notify payload:', payload);

    const {
      MerchantID,
      MerchantPassword,
      Reference,
      Amount,
      Currency,
      Status,
      ResponseStatus,
      ResponseError,
      TransactionID,
      Telephone,
      Email,
    } = payload;

    // 0) Sécurité credentials
    if (MerchantID !== MERCHANT_ID || MerchantPassword !== MERCHANT_PASS) {
      console.error('❌ Webhook MerchantID / Password invalides');
      return res.status(403).send('Forbidden');
    }

    // 1) Vérifier statut Maxicash (on ne traite que les succès)
    const statusEffective = ResponseStatus || Status;
    if (!isMaxicashSuccessStatus(statusEffective)) {
      console.warn(
        '⚠️ Webhook paiement non-success, ignoré:',
        statusEffective,
        ResponseError
      );
      return res.status(200).send('Ignored (not success)');
    }

    // 2) Référence obligatoire (matricule chez nous)
    if (!Reference) {
      console.error('❌ Webhook sans Reference (matricule)');
      return res.status(400).send('Missing Reference');
    }

    // 3) Idempotence (au cas où Maxicash renvoie plusieurs fois le même notify)
    const existing = await Paiement.findOne({
      referencePaiement: Reference,
      transactionExterneId: TransactionID || undefined,
    }).lean();

    if (existing) {
      console.log('ℹ️ Paiement déjà enregistré pour cette référence/TransactionID');
      return res.status(200).send('Already processed');
    }

    // 4) Montant webhook en devise (à partir des cents)
    const montantWebhook = centsToAmount(Amount);
    const tolerance = 0.01; // +/- 0.01 USD de tolérance

    // 5) Récupérer l'intention PENDING la plus récente
    let intention = await PaiementIntention.findOne({
      reference: Reference, // matricule
      status: 'pending',
      montant: {
        $gte: montantWebhook - tolerance,
        $lte: montantWebhook + tolerance,
      },
    })
      .sort({ createdAt: -1 })
      .lean();

    console.log('🔎 Intention candidate (pending + montant cohérent) pour', Reference, '=>',
      intention
        ? {
            id: intention._id,
            montant: intention.montant,
            mois: intention.mois,
            devise: intention.devise,
            createdAt: intention.createdAt,
          }
        : null
    );

    // 6) SÉCURITÉ MAX : si pas d’intention cohérente => NE RIEN CRÉER
    if (!intention) {
      console.warn(
        '🚫 AUCUNE intention PENDING cohérente trouvée pour ce webhook. Paiement NON créé.',
        {
          matricule: Reference,
          montantWebhook,
          statusEffective,
          tx: TransactionID,
        }
      );

      // Option : alerter élève/parent/école d’une anomalie de paiement
      try {
        if (envoyerEmailsIntelligents) {
          const pseudoPaiement = {
            reference: generatePaiementReference('COLM-ALERT'),
            referencePaiement: Reference,
            montant: montantWebhook,
            devise: Currency || DEVISE,
            mois: null,
            anneeScolaire: ANNEE_SCOLAIRE,
            modePaiement: 'Mobile Money',
            datePaiement: new Date(),
            parentNom: null,
            emailParent: Email || null,
            emailEleve: Email || null,
            emailPercepteur: null,
            emailEcole: ECOLE_EMAIL,
            noteIA:
              "Alerte : paiement Maxicash reçu sans intention de paiement cohérente. Aucune ligne de paiement n'a été créée dans le système. Merci de vérifier.",
          };

          console.log('📧 Envoi email ALERTE paiement incohérent:', {
            eleve: pseudoPaiement.emailEleve,
            parent: pseudoPaiement.emailParent,
            ecole: pseudoPaiement.emailEcole,
          });

          await envoyerEmailsIntelligents(pseudoPaiement, null);
        }
      } catch (err) {
        console.error('⚠️ Erreur envoi emails ALERTE (non bloquant):', err.message);
      }

      // Log activité système
      try {
        await LogActivite.create({
          utilisateur: null,
          role: 'system',
          action: 'paiement_en_ligne_anormal',
          categorie: 'paiement',
          description:
            'Webhook Maxicash reçu SANS intention cohérente. Aucun paiement créé.',
          details: JSON.stringify({
            referenceMatricule: Reference,
            montantWebhook,
            deviseWebhook: Currency,
            status: statusEffective,
            transactionId: TransactionID,
          }),
        });
      } catch (err) {
        console.error('⚠️ Erreur log activité (anomalie):', err.message);
      }

      // On répond 200 pour éviter que Maxicash ne renvoie en boucle
      return res.status(200).send('Ignored (no matching intention)');
    }

    // 7) À partir d’ici : intention cohérente TROUVÉE -> on crédite
    const montant = Number(intention.montant || 0);
    const devise = intention.devise || Currency || DEVISE;

    // 8) Chercher l’élève par matricule / référencePaiement
    const eleve = await Eleve.findOne({
      $or: [{ matricule: Reference }, { referencePaiement: Reference }],
    })
      .populate('classe')
      .lean();

    if (!eleve) {
      console.warn('⚠️ Aucun élève trouvé pour Reference (matricule):', Reference);
    } else {
      console.log('📌 Élève trouvé pour webhook:', {
        id: eleve._id,
        nom: eleve.nom,
        prenom: eleve.prenom,
        emailParent: eleve.emailParent,
      });
    }

    const now = new Date();

    // 9) Mois: priorité à l’intention
    const moisParDefaut = (() => {
      if (intention && intention.mois) return intention.mois;

      const moisIndex = now.getMonth();
      const mapping = {
        8: 'Septembre',
        9: 'Octobre',
        10: 'Novembre',
        11: 'Décembre',
        0: 'Janvier',
        1: 'Février',
        2: 'Mars',
        3: 'Avril',
        4: 'Mai',
        5: 'Juin',
      };
      return mapping[moisIndex] || 'Septembre';
    })();

    const moyen = intention.moyenPaiement || 'Mobile Money';

    // 10) Référence interne définitive
    const referenceInterne = generatePaiementReference('COLM-GABK');

    const paiementData = {
      reference: referenceInterne,
      referencePaiement: Reference,
      montant,
      devise,
      mois: moisParDefaut,
      anneeScolaire: ANNEE_SCOLAIRE,
      anneeConcernee: ANNEE_SCOLAIRE,
      moyenPaiement: moyen,
      modePaiement: moyen,
      datePaiement: now,
      transactionExterneId: TransactionID || undefined,

      telephoneEleve: intention.telephonePayer || Telephone || undefined,
      emailEleve: intention.emailPayer || Email || undefined,
      parentNom: intention.parentNom || null,
      emailParent: intention.emailParent || null,
      noteAdministrative: intention.noteAdministrative || ResponseError || null,

      ecole: ECOLE_NOM,
      noteIA: 'Paiement en ligne confirmé via passerelle.',
      emailPercepteur: null,
    };

    if (eleve) {
      paiementData.eleve = eleve._id;
      paiementData.eleveId = eleve._id;
      paiementData.eleveNom = `${eleve.nom || ''} ${eleve.prenom || ''}`.trim();
      paiementData.eleveMatricule = eleve.matricule || null;
      paiementData.classe = eleve.classe?._id || undefined;
      paiementData.classeNom = eleve.classe?.nom || null;

      if (!paiementData.parentNom) {
        paiementData.parentNom = eleve.parentNom || eleve.nomParent || null;
      }
      if (!paiementData.emailParent) {
        paiementData.emailParent = eleve.emailParent || null;
      }
      if (!paiementData.telephoneParent) {
        paiementData.telephoneParent = eleve.telephoneParent || null;
      }
      paiementData.parentContact =
        paiementData.telephoneParent || eleve.telephoneParent || null;
    } else {
      paiementData.eleveNom = `Inconnu (${Reference})`;
    }

    // 11) Création du paiement
    const paiement = await Paiement.create(paiementData);
    console.log(
      '✅ Paiement créé via webhook:',
      paiement.reference,
      'Montant:',
      paiement.montant
    );
    console.log('👁 Emails sur paiement (avant envoi):', {
      emailEleve: paiement.emailEleve,
      emailParent: paiement.emailParent,
    });

    // 12) MAJ de l’intention -> confirmed
    await PaiementIntention.findByIdAndUpdate(
      intention._id,
      {
        $set: {
          status: 'confirmed',
          paiementCree: paiement._id,
          lastMaxicashStatus: statusEffective,
          lastTransactionId: TransactionID || null,
        },
      },
      { runValidators: false }
    );

    // 13) MAJ élève (total payé / reste)
    if (eleve) {
      try {
        const totalPayeAgg = await Paiement.aggregate([
          {
            $match: {
              $or: [{ eleveId: eleve._id }, { eleve: eleve._id }],
              anneeConcernee: ANNEE_SCOLAIRE,
              statut: 'validé',
            },
          },
          { $group: { _id: null, total: { $sum: '$montant' } } },
        ]);

        const totalPaye = totalPayeAgg.length ? totalPayeAgg[0].total : 0;
        const fraisClasse =
          eleve.classe && eleve.classe.montantFrais ? eleve.classe.montantFrais : 0;
        const resteAPayer = Math.max(0, fraisClasse - totalPaye);

        await Eleve.findByIdAndUpdate(
          eleve._id,
          {
            $set: {
              totalPaye,
              resteAPayer,
            },
          },
          { runValidators: false }
        );

        console.log(
          `↪ MAJ élève ${eleve.nom} ${eleve.prenom} - Total payé: ${totalPaye} ${DEVISE}, Reste: ${resteAPayer} ${DEVISE}`
        );
      } catch (err) {
        console.error('⚠️ Erreur MAJ élève (non bloquant):', err.message);
      }
    }

    // 14) PDF
    let pdfPath = null;
    try {
      if (generateSchoolReceiptPDF) {
        const paiementPourPDF = {
          reference: paiement.reference,
          eleveNom: paiement.eleveNom || '',
          classeNom: paiement.classeNom || '',
          mois: paiement.mois || '',
          anneeScolaire: paiement.anneeScolaire || ANNEE_SCOLAIRE,
          montant: paiement.montant,
          modePaiement: paiement.modePaiement,
          datePaiement: paiement.datePaiement,
          parentNom: paiement.parentNom || 'Parent',
          parentContact: paiement.telephoneParent || paiement.parentContact || '—',
          emailParent: paiement.emailParent || '—',
          percepteurNom: paiement.percepteurNom || 'Système en ligne',
          emailPercepteur: paiement.emailPercepteur || ECOLE_EMAIL,
          noteIA: 'Paiement en ligne confirmé.',
          signaturePath: null,
        };

        pdfPath = await generateSchoolReceiptPDF(
          paiementPourPDF,
          paiement.reference
        );
        console.log('✅ PDF généré via webhook:', pdfPath);
      }
    } catch (err) {
      console.error('⚠️ Erreur génération PDF (non bloquant):', err.message);
      pdfPath = null;
    }

    // 15) Emails (élève / parent / école)
    try {
      if (envoyerEmailsIntelligents) {
        const paiementForEmail = paiement.toObject();
        paiementForEmail.emailEleve = paiementForEmail.emailEleve || null;
        paiementForEmail.emailParent = paiementForEmail.emailParent || null;
        paiementForEmail.emailPercepteur = paiementForEmail.emailPercepteur || null;
        paiementForEmail.emailEcole = ECOLE_EMAIL;

        console.log('👁 Destinataires email calculés:', {
          eleve: paiementForEmail.emailEleve,
          parent: paiementForEmail.emailParent,
          percepteur: paiementForEmail.emailPercepteur,
          ecole: paiementForEmail.emailEcole,
        });

        if (paiementForEmail.emailEleve || paiementForEmail.emailParent) {
          await envoyerEmailsIntelligents(paiementForEmail, pdfPath);
          console.log('✉️ Emails de reçu envoyés (élève/parent/école) via webhook.');
        } else {
          console.log('ℹ️ Aucun email élève/parent, skip envoi.');
        }
      } else {
        console.log('ℹ️ envoyerEmailsIntelligents non défini, aucun email envoyé.');
      }
    } catch (err) {
      console.error('⚠️ Erreur envoi emails (non bloquant):', err.message);
    }

    // 16) Log activité normal
    try {
      await LogActivite.create({
        utilisateur: null,
        role: 'system',
        action: 'paiement_en_ligne',
        categorie: 'paiement',
        description: `Paiement en ligne confirmé - Ref ${paiement.reference} - ${paiement.montant} ${paiement.devise}`,
        details: JSON.stringify({
          reference: paiement.reference,
          referenceExtern: Reference,
          montant: paiement.montant,
          devise: paiement.devise,
          status: statusEffective,
          transactionId: TransactionID,
        }),
      });
    } catch (err) {
      console.error('⚠️ Erreur log activité (non bloquant):', err.message);
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('❌ Erreur handleNotify:', err);
    return res.status(500).send('Internal error');
  }
};

