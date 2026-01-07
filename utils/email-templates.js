/**
 * EMAIL & PDF TEMPLATES - Gabkut Schola
 * Génère des templates HTML identiques pour emails ET PDFs
 * GARANTIT COHÉRENCE: Mail = PDF + Éléments visuels
 */

// CONFIGURATION GLOBALE PARTAGÉE
const EMAIL_CONFIG = {
  SCHOOL_NAME: 'Collège Le Mérite',
  LOGO_URL: 'https://college-le-merite.cd/logo.png', // À vérifier
  SITE_URL: 'https://collegelemerite.cd',
  YEAR: new Date().getFullYear(),
  CONTACT: {
    email: 'collegelemerite.cd@gmail.com',
    phone: '+243 822 783 500',
    address: 'Kinshasa, RDC'
  }
};

/**
 * BUILD SITUATION DES MENSUALITÉS
 * Template réutilisable pour EMAIL et PDF
 * 
 * @param {Object} eleveData - Données élève
 * @param {Array} mensualites - Array de mensualités
 * @param {Number} totalAttendu - Total attendu
 * @param {Number} totalPaye - Total payé
 * @param {Number} retard - Montant retard
 * @returns {String} HTML sanitisé
 */
function buildPaymentSituationTemplate(eleveData, mensualites, totalAttendu, totalPaye, retard) {
  const {
    nom = '',
    postnom = '',
    prenom = '',
    matricule = 'N/A',
    classe = 'Non assigné',
    email = 'Non renseigné'
  } = eleveData || {};

  const nomComplet = [postnom, prenom, nom].filter(Boolean).join(' ').trim() || 'Élève';
  const totalReste = totalAttendu - totalPaye;

  // BUILD TABLE MENSUALITÉS
  const mensualitesRows = (mensualites || []).map(m => {
    const reste = (m.montantAttendu || 0) - (m.montantPaye || 0);
    let statut, couleur;
    
    if (reste === 0) {
      statut = 'Réglé';
      couleur = '#d1fae5|#065f46';
    } else if (m.montantPaye > 0) {
      statut = 'Partiel';
      couleur = '#fef3c7|#92400e';
    } else {
      statut = 'Impayé';
      couleur = '#fee2e2|#991b1b';
    }

    const [bgColor, textColor] = couleur.split('|');

    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${m.mois || 'N/A'}</td>
        <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${m.montantAttendu || 0} USD</td>
        <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #059669; font-weight: 600;">${m.montantPaye || 0} USD</td>
        <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #dc2626;">${reste} USD</td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; padding: 4px 8px; border-radius: 20px; font-size: 12px; font-weight: 600;
            background-color: ${bgColor}; color: ${textColor};">
            ${statut}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  // ALERTE RETARD (si applicable)
  const retardAlert = retard > 0 ? `
    <div style="background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin: 16px 0; color: #991b1b;">
      <strong>⚠️ Retard cumulé: ${retard} USD</strong><br>
      <em style="font-size: 13px;">Nous vous prions de bien vouloir régulariser ce montant dans les plus brefs délais.</em>
    </div>
  ` : '';

  // HTML FINAL (IDENTIQUE POUR EMAIL ET PDF)
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .email-container {
      max-width: 640px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td style="padding: 24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          
          <!-- EN-TÊTE ÉCOLE -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 18px 24px; color: #e0f2fe; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Gabkut Schola</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #e0f2fe;">${EMAIL_CONFIG.SCHOOL_NAME}</p>
            </td>
          </tr>

          <!-- TITRE SECTION -->
          <tr>
            <td style="padding: 24px 24px 20px 24px;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1f2937;">
                📋 Situation des mensualités
              </h2>
              <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">Communication officielle de la direction</p>
            </td>
          </tr>

          <!-- INFOS ÉLÈVE -->
          <tr>
            <td style="background-color: #f3f4f6; padding: 16px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="color: #6b7280; width: 140px; padding: 6px 0;">Élève:</td>
                  <td style="color: #111827; font-weight: 600; padding: 6px 0;">${nomComplet}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; width: 140px; padding: 6px 0;">Matricule:</td>
                  <td style="color: #111827; padding: 6px 0;">${matricule}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; width: 140px; padding: 6px 0;">Classe:</td>
                  <td style="color: #111827; padding: 6px 0;">${classe}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; width: 140px; padding: 6px 0;">Email:</td>
                  <td style="color: #111827; padding: 6px 0;">${email}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TABLE MENSUALITÉS -->
          <tr>
            <td style="padding: 24px 24px 20px 24px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; font-size: 14px; color: #111827;">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Mois</th>
                    <th style="padding: 8px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Attendu</th>
                    <th style="padding: 8px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Payé</th>
                    <th style="padding: 8px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Reste</th>
                    <th style="padding: 8px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  ${mensualitesRows}
                </tbody>
                <tfoot style="background-color: #3b82f6; color: #ffffff; font-weight: 700;">
                  <tr>
                    <td style="padding: 12px; text-align: right;">TOTAL</td>
                    <td style="padding: 12px; text-align: right;">${totalAttendu} USD</td>
                    <td style="padding: 12px; text-align: right;">0.00 USD</td>
                    <td style="padding: 12px; text-align: right;">${totalAttendu} USD</td>
                    <td style="padding: 12px; text-align: center;">---</td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>

          <!-- ALERTE RETARD -->
          ${retardAlert ? `<tr><td style="padding: 0 24px 20px 24px;">${retardAlert}</td></tr>` : ''}

          <!-- FOOTER TEXT -->
          <tr>
            <td style="padding: 24px 24px 20px 24px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px; font-size: 14px; color: #374151;">
                Cordialement,<br>
                <strong>La Direction & Service Comptable</strong>
              </p>
              <p style="margin: 0; font-size: 13px; color: #6b7280;">
                Pour toute question concernant votre compte ou les modalités de paiement,
                n'hésitez pas à nous contacter.
              </p>
            </td>
          </tr>

          <!-- PIED DE PAGE AVEC DATE -->
          <tr>
            <td style="background-color: #f9fafb; padding: 10px 24px; text-align: center; font-size: 11px; color: #9ca3af; line-height: 1.5; border-top: 1px solid #e5e7eb;">
              Fait à Kinshasa, le ${new Date().toLocaleDateString('fr-FR')}<br>
              © ${EMAIL_CONFIG.YEAR} Gabkut Schola, développé par <a href="https://gabkut.com" style="color: #3b82f6; text-decoration: none; font-weight: 600;" target="_blank">Gabkut Agency LMK</a><br>
              📞 ${EMAIL_CONFIG.CONTACT.phone} | 📧 ${EMAIL_CONFIG.CONTACT.email}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  buildPaymentSituationTemplate,
  EMAIL_CONFIG
};