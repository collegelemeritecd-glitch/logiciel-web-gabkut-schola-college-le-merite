/************************************************************
 📄 PUBLIC VERIFICATION CONTROLLER
 Collège Le Mérite - Gabkut Agency LMK +243822783500
 Vérification publique, export PDF, envoi email simple
*************************************************************/

const fs = require('fs');
const nodemailer = require('nodemailer');
const Paiement = require('../models/Paiement');

// Génération PDF (utilitaire déjà existant côté percepteur)
let generateSchoolReceiptPDF = null;
try {
  const pdfModule = require('../utils/generateSchoolReceiptPDF');
  generateSchoolReceiptPDF =
    typeof pdfModule === 'function' ? pdfModule : pdfModule.generateSchoolReceiptPDF;
  console.log('✅ generateSchoolReceiptPDF (public) chargé');
} catch (err) {
  console.error('❌ generateSchoolReceiptPDF NON CHARGÉ (public):', err.message);
}

/**
 * Transporteur mail simple pour la vérification publique
 * Utilise EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 */
function createMailTransport() {
  // On lit tes vraies variables existantes
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.ECOLE_EMAIL || process.env.SMTP_USER || 'no-reply@collegelemerite.cd';

  if (!host || !user || !pass) {
    throw new Error('Configuration SMTP incomplète (SMTP_HOST / SMTP_USER / SMTP_PASS)');
  }

  const transporter = require('nodemailer').createTransport({
    host,
    port,
    secure: Number(port) === 465,
    auth: { user, pass }
  });

  return { transporter, from };
}


// ========================================
// 📌 VÉRIFICATION PUBLIQUE SIMPLE
// GET /api/public/verif/:code
// ========================================
exports.verifierDocument = async (req, res) => {
  try {
    const { code } = req.params;

    const paiement = await Paiement.findOne({ reference: code }).lean();

    if (!paiement) {
      return res.status(404).json({
        success: false,
        message: 'Document introuvable'
      });
    }

    return res.json({
      success: true,
      document: {
        reference: paiement.reference,
        eleveNom: paiement.eleveNom,
        classeNom: paiement.classeNom,
        mois: paiement.mois,
        anneeScolaire: paiement.anneeScolaire || paiement.anneeConcernee,
        montant: paiement.montant,
        datePaiement: paiement.datePaiement,
        percepteurNom: paiement.percepteurNom
      }
    });
  } catch (err) {
    console.error('❌ Erreur verif public:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ========================================
// 📌 EXPORT PDF PUBLIC
// GET /api/public/verif/:code/export
// ========================================
exports.exporterRapport = async (req, res) => {
  try {
    const { code } = req.params;
    const paiement = await Paiement.findOne({ reference: code }).lean();

    if (!paiement) {
      return res.status(404).json({
        success: false,
        message: 'Document introuvable'
      });
    }

    if (!generateSchoolReceiptPDF) {
      return res.status(500).json({
        success: false,
        message: 'Module PDF indisponible'
      });
    }

    const paiementPourPDF = {
      reference: paiement.reference,
      eleveNom: paiement.eleveNom + ' ' + (paiement.elevePrenom || ''),
      classeNom: paiement.classeNom,
      mois: paiement.mois,
      anneeScolaire: paiement.anneeScolaire || paiement.anneeConcernee,
      montant: paiement.montant,
      modePaiement: paiement.modePaiement || paiement.moyenPaiement,
      datePaiement: paiement.datePaiement,
      parentNom: paiement.parentNom || 'Parent',
      parentContact: paiement.telephoneParent || '—',
      emailParent: paiement.emailParent || '—',
      percepteurNom: paiement.percepteurNom,
      emailPercepteur: paiement.emailPercepteur,
      noteIA: 'Vérification publique de reçu.',
      signaturePath: null
    };

    const pdfPath = await generateSchoolReceiptPDF(paiementPourPDF, paiement.reference);

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du PDF'
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Verification-${paiement.reference}.pdf"`
    );

    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    console.error('❌ Erreur exportRapport:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ========================================
// 📌 ENVOI EMAIL PUBLIC SIMPLE
// POST /api/public/verif/:code/email
// body: { email }
// ========================================
exports.envoyerRapportParEmail = async (req, res) => {
  try {
    const { code } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Adresse email requise'
      });
    }

    const paiement = await Paiement.findOne({ reference: code }).lean();
    if (!paiement) {
      return res.status(404).json({
        success: false,
        message: 'Document introuvable'
      });
    }

    if (!generateSchoolReceiptPDF) {
      return res.status(500).json({
        success: false,
        message: 'Module PDF indisponible'
      });
    }

    // 1) Générer le PDF à joindre
    let pdfPath = null;
    try {
      const paiementPourPDF = {
        reference: paiement.reference,
        eleveNom: paiement.eleveNom + ' ' + (paiement.elevePrenom || ''),
        classeNom: paiement.classeNom,
        mois: paiement.mois,
        anneeScolaire: paiement.anneeScolaire || paiement.anneeConcernee,
        montant: paiement.montant,
        modePaiement: paiement.modePaiement || paiement.moyenPaiement,
        datePaiement: paiement.datePaiement,
        parentNom: paiement.parentNom || 'Parent',
        parentContact: paiement.telephoneParent || '—',
        emailParent: paiement.emailParent || '—',
        percepteurNom: paiement.percepteurNom,
        emailPercepteur: paiement.emailPercepteur,
        noteIA: 'Vérification publique de reçu.',
        signaturePath: null
      };

      pdfPath = await generateSchoolReceiptPDF(paiementPourPDF, paiement.reference);
    } catch (err) {
      console.error('⚠️ Erreur génération PDF (email public):', err.message);
      pdfPath = null;
    }

    const frontUrl = process.env.FRONT_BASE_URL || 'https://www.collegelemerite.school';
    const verifUrl = `${frontUrl.replace(/\/+$/, '')}/verif.html?code=${encodeURIComponent(code)}`;

    // 2) Mail très simple, style "rapport de vérification"
    const subject = `Rapport de vérification du document ${paiement.reference}`;
    const text = [
      'Chers,',
      '',
      'Nous vous informons que le document vérifié est reconnu comme valide dans le système du Collège Le Mérite.',
      '',
      `Référence : ${paiement.reference}`,
      `Élève : ${paiement.eleveNom}`,
      `Classe : ${paiement.classeNom || '—'}`,
      `Mois payé : ${paiement.mois || '—'}`,
      `Montant : ${(paiement.montant || 0).toFixed(2)} USD`,
      `Date du paiement : ${paiement.datePaiement ? new Date(paiement.datePaiement).toLocaleDateString('fr-FR') : '—'}`,
      '',
      `Vous pouvez également consulter ce document en ligne via : ${verifUrl}`,
      '',
      'Ceci est un rapport de vérification automatique.',
      'Collège Le Mérite'
    ].join('\n');

    const html = `
      <p>Chers,</p>
      <p>
        Nous vous informons que le document vérifié est reconnu comme valide dans le système du
        <strong>Collège Le Mérite</strong>.
      </p>
      <p>
        Référence : <strong>${paiement.reference}</strong><br>
        Élève : <strong>${paiement.eleveNom}</strong><br>
        Classe : ${paiement.classeNom || '—'}<br>
        Mois payé : ${paiement.mois || '—'}<br>
        Montant : ${(paiement.montant || 0).toFixed(2)} USD<br>
        Date du paiement :
        ${paiement.datePaiement ? new Date(paiement.datePaiement).toLocaleDateString('fr-FR') : '—'}
      </p>
      <p>
        Vous pouvez également consulter ce document en ligne via ce lien :<br>
        <a href="${verifUrl}" target="_blank">${verifUrl}</a>
      </p>
      <p>
        En pièce jointe, vous trouverez le document correspondant à cette vérification.
      </p>
      <p>
        Ceci est un rapport de vérification automatique.<br>
        Collège Le Mérite
      </p>
    `;

    const { transporter, from } = createMailTransport();

    const mailOptions = {
      from,
      to: email,
      subject,
      text,
      html,
      attachments: []
    };

    if (pdfPath && fs.existsSync(pdfPath)) {
      mailOptions.attachments.push({
        filename: `Verification-${paiement.reference}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf'
      });
    }

    await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      message: `Rapport envoyé à ${email}`
    });
  } catch (err) {
    console.error('❌ Erreur envoyerRapportParEmail (public):', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l’envoi de l’email'
    });
  }
};
