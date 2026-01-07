/* ============================================================
   📧 GABKUT-ÉCOLE — Envoi d'emails de relances (v1.0)
   ------------------------------------------------------------
   Système d'envoi de relances automatiques pour impayés
   ============================================================ */

const nodemailer = require("nodemailer");

// 🏫 CONFIGURATION ÉCOLE
const ECOLE_CONFIG = {
  nom: "Collège Le Mérite",
  slogan: "Connaissance • Rigueur • Réussite",
  ville: "Kinshasa",
  commune: "Kampemba",
  quartier: "Bel-Air",
  avenue: "Frangipanier",
  numero: "27",
  telephones: ["+243 822 783 500"],
  email: "collegelemerite5@gmail.com",
  siteWeb: "www.collegelemerite.cd",
  signatureGabkut: "© Gabkut Agency LMK – Signature électronique vérifiée / +243822783500",
  marque: "Gabkut-Schola – propulsé par Gabkut Agency LMK",
};

console.log('🔑 SMTP CONFIG (Relances):', {
  host: process.env.SMTP_HOST,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS ? '✅ Défini' : '❌ Manquant'
});

// 📧 TRANSPORTER SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: 587,
  secure: false,
  tls: { rejectUnauthorized: false },
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// 🎨 TEMPLATES D'EMAILS DE RELANCES
const TEMPLATES = {
  'relance-simple': {
    badge: '📬 RELANCE AMICALE',
    badgeColor: '#dbeafe',
    badgeText: '#1e40af',
    objet: 'Rappel Amical - Paiement Scolarité',
    titre: 'Rappel Amical',
    getMessage: (eleve) => `
      <p>Madame, Monsieur,</p>
      <p>Nous espérons que vous et votre famille vous portez bien.</p>
      <p>Nous nous permettons de vous rappeler amicalement qu'un solde reste dû concernant la scolarité de <strong>${eleve.eleveNom}</strong>.</p>
      <p>Nous vous remercions de bien vouloir régulariser cette situation dès que possible.</p>
    `
  },
  'relance-officielle': {
    badge: '⚠️ RELANCE OFFICIELLE',
    badgeColor: '#fef3c7',
    badgeText: '#92400e',
    objet: 'URGENT - Régularisation Paiement Scolarité',
    titre: 'Relance Officielle',
    getMessage: (eleve) => `
      <p>Madame, Monsieur,</p>
      <p>Nous vous adressons cette relance officielle concernant le paiement de la scolarité de <strong>${eleve.eleveNom}</strong>.</p>
      <p>📅 Nous vous demandons de bien vouloir régulariser cette situation dans un délai de <strong>7 jours</strong>.</p>
      <p>À défaut de règlement dans les délais impartis, nous nous verrons dans l'obligation d'appliquer les mesures prévues par le règlement intérieur de l'établissement.</p>
    `
  },
  'avertissement': {
    badge: '🚨 DERNIER AVERTISSEMENT',
    badgeColor: '#fee2e2',
    badgeText: '#991b1b',
    objet: 'DERNIER AVERTISSEMENT - Paiement Scolarité',
    titre: 'Avertissement Formel',
    getMessage: (eleve) => `
      <p>Madame, Monsieur,</p>
      <p>Malgré nos relances précédentes, nous constatons que le solde de la scolarité de <strong>${eleve.eleveNom}</strong> reste impayé.</p>
      <p>⚠️ <strong>Ceci constitue notre dernier avertissement avant suspension.</strong></p>
      <p>Vous disposez d'un délai de <strong>48 heures</strong> pour régulariser la situation, faute de quoi votre enfant ne pourra plus avoir accès aux cours.</p>
    `
  },
  'felicitations': {
    badge: '🎉 FÉLICITATIONS',
    badgeColor: '#d1fae5',
    badgeText: '#065f46',
    objet: 'Remerciements - Paiements à jour',
    titre: 'Félicitations !',
    getMessage: (eleve) => `
      <p>Madame, Monsieur,</p>
      <p>Nous tenons à vous remercier chaleureusement pour votre ponctualité dans le paiement de la scolarité de <strong>${eleve.eleveNom}</strong>.</p>
      <p>🎓 Votre sérieux et votre engagement sont exemplaires et contribuent au bon fonctionnement de notre établissement.</p>
      <p>Toute l'équipe du Collège Le Mérite vous adresse ses sincères félicitations !</p>
    `
  }
};

/* ============================================================
   📧 FONCTION PRINCIPALE : Envoyer un email de relance
   ============================================================ */
async function envoyerEmailRelance(eleve, templateType = 'relance-simple') {
  try {
    console.log(`📧 Envoi relance ${templateType} vers: ${eleve.emailParent}`);

    // Validation
    if (!eleve.emailParent || !eleve.emailParent.includes('@')) {
      throw new Error(`Email parent invalide: ${eleve.emailParent}`);
    }

    // Récupérer le template
    const template = TEMPLATES[templateType] || TEMPLATES['relance-simple'];

    // Générer le HTML
    const htmlContent = genererHTMLRelance(eleve, template);

    // Envoyer l'email
    await transporter.sendMail({
      from: `"${ECOLE_CONFIG.nom}" <${process.env.SMTP_USER}>`,
      to: eleve.emailParent,
      subject: template.objet,
      html: htmlContent
    });

    console.log(`✅ Email relance envoyé à ${eleve.emailParent}`);
    return { success: true };

  } catch (err) {
    console.error(`❌ Erreur envoi relance:`, err.message);
    throw err;
  }
}

/* ============================================================
   🎨 GÉNÉRATION DU HTML DE L'EMAIL
   ============================================================ */
function genererHTMLRelance(eleve, template) {
  const message = template.getMessage(eleve);

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${template.titre}</title>
    </head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f0f4f8;">
      <div style="max-width:700px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.1);">
        
        <!-- En-tête élégant -->
        <header style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:#fff;padding:35px 40px;text-align:center;">
          <div style="background:${template.badgeColor};color:${template.badgeText};display:inline-block;padding:10px 18px;border-radius:25px;font-size:14px;font-weight:700;margin-bottom:15px;">
            ${template.badge}
          </div>
          <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">${ECOLE_CONFIG.nom}</h1>
          <p style="margin:0;font-size:14px;opacity:0.9;font-weight:300;">${ECOLE_CONFIG.slogan}</p>
        </header>

        <!-- Corps principal -->
        <main style="padding:40px;color:#1e293b;font-size:16px;line-height:1.8;">
          <div style="margin-bottom:24px;">
            ${message}
          </div>

          <!-- Informations élève -->
          <div style="background:linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);border-left:5px solid #3b82f6;padding:22px;margin:28px 0;border-radius:10px;">
            <div style="display:flex;justify-content:space-between;margin:12px 0;font-size:15px;">
              <span style="font-weight:700;color:#4b5563;">Élève :</span>
              <span style="color:#1f2937;font-weight:600;">${eleve.eleveNom}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin:12px 0;font-size:15px;">
              <span style="font-weight:700;color:#4b5563;">Matricule :</span>
              <span style="color:#1f2937;">${eleve.matricule || '—'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin:12px 0;font-size:15px;">
              <span style="font-weight:700;color:#4b5563;">Classe :</span>
              <span style="color:#1f2937;">${eleve.classe}</span>
            </div>
          </div>

          <!-- Montant dû -->
          <div style="background:linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);color:#991b1b;padding:22px 28px;border-radius:12px;text-align:center;font-size:22px;font-weight:bold;margin:28px 0;border:3px solid #ef4444;">
            💰 SOLDE DÛ : ${eleve.montantDu ? eleve.montantDu.toFixed(2) : '0.00'} USD
          </div>

          <!-- Modes de paiement -->
          <div style="background:linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);border:2px solid #93c5fd;padding:22px;border-radius:12px;margin:28px 0;">
            <p style="margin:0 0 15px 0;font-weight:700;color:#1e40af;font-size:16px;">💳 Modes de paiement acceptés :</p>
            <ul style="margin:0;padding-left:22px;color:#1f2937;line-height:1.8;">
              <li><strong>Espèces</strong> au bureau de perception</li>
              <li><strong>Virement bancaire</strong></li>
              <li><strong>Mobile Money</strong> (Airtel / M-Pesa / Orange)</li>
            </ul>
          </div>

          <p style="margin-top:28px;color:#374151;">Cordialement,</p>
          <p style="margin:5px 0;font-weight:700;color:#1f2937;font-size:16px;">Le Service de Perception</p>
          <p style="margin:5px 0;color:#6b7280;">${ECOLE_CONFIG.nom}</p>
        </main>

        <!-- Pied de page élégant -->
        <footer style="background:#0f172a;color:#94a3b8;padding:28px 40px;text-align:center;font-size:13px;line-height:1.6;">
          <p style="margin:0 0 8px 0;color:#cbd5e1;font-weight:600;">${ECOLE_CONFIG.nom}</p>
          <p style="margin:0 0 12px 0;">${ECOLE_CONFIG.quartier}, Avenue ${ECOLE_CONFIG.avenue} N°${ECOLE_CONFIG.numero}, ${ECOLE_CONFIG.commune} — ${ECOLE_CONFIG.ville}</p>
          <p style="margin:0 0 12px 0;">📞 ${ECOLE_CONFIG.telephones.join(" • ")}</p>
          <p style="margin:0 0 12px 0;">📧 ${ECOLE_CONFIG.email}</p>
          <p style="margin:0;font-size:12px;color:#64748b;">
            ${ECOLE_CONFIG.marque}<br>
            ${ECOLE_CONFIG.signatureGabkut}
          </p>
        </footer>

      </div>
    </body>
    </html>
  `;
}

// ============================================================
// 📤 EXPORTS
// ============================================================
module.exports = {
  envoyerEmailRelance,
  TEMPLATES
};

console.log("✅ Module envoyerEmailsRelances v1.0 chargé");
