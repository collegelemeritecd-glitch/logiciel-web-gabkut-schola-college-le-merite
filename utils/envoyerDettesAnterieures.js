// ============================================================================
// 💼 UTIL — Envoi des Rapports des Dettes Antérieures (Gabkut-Schola PRO 2026)
// Automatique — envoyé à Parent + Élève + Percepteur + École
// ============================================================================

const nodemailer = require("nodemailer");
const SCHOOL_INFO = require("./schoolInfo.json"); //  Nom + Email École centralisée

// ⚙️ Transport email (même que emails intelligents)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * ⚡ Envoi automatique du rapport des dettes antérieures
 * @param {Object} paiement  — objet paiement récent
 * @param {Object} dette     — { anneePrecedente, detteN, montantPourRegularisation }
 */
exports.envoyerDettesAnterieures = async (paiement, dette) => {
  try {
    if (!dette || !dette.detteN || Number(dette.detteN) <= 0) return; // rien à envoyer

    const destinataires = [
      paiement.emailParent,
      paiement.emailEleve,
      paiement.emailPercepteur,
      SCHOOL_INFO?.email || process.env.ECOLE_EMAIL
    ].filter(x => x && x.includes("@"));

    if (destinataires.length === 0) return;

    const sujet = `📌 Rapport des dettes antérieures — ${paiement.eleveNom}`;
    const html = `
      <div style="font-family:Arial; font-size:16px; line-height:1.6;">
        <h2 style="color:#1e3a8a;">Rapport des dettes scolaires antérieures</h2>

        <p>Voici l'analyse officielle des régularisations pour l'élève :</p>

        <table cellpadding="6">
          <tr><td><b>Élève :</b></td><td>${paiement.eleveNom}</td></tr>
          <tr><td><b>Classe actuelle :</b></td><td>${paiement.classe}</td></tr>
          <tr><td><b>Année précédente :</b></td><td>${dette.anneePrecedente}</td></tr>
          <tr><td><b>Dette totale N-1 :</b></td><td><b>${dette.detteN} $</b></td></tr>
          <tr><td><b>Montant régularisé aujourd’hui :</b></td><td><b>${paiement.montantPourRegularisation || 0} $</b></td></tr>
          <tr><td><b>Solde restant après régularisation :</b></td>
            <td><b>${Math.max(Number(dette.detteN) - Number(paiement.montantPourRegularisation || 0), 0)} $</b></td>
          </tr>
        </table>
        
        <br>
        <p>
          Le système continuera automatiquement les ajustements jusqu’à extinction de la dette.
          Aucun déplacement au secrétariat n’est nécessaire.
        </p>

        <br>
        <p style="font-size:14px; color:#444; border-top:1px solid #ccc; padding-top:10px;">
          Message envoyé automatiquement par Gabkut-Schola® — Collège Le Mérite.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Collège Le Mérite" <${process.env.SMTP_USER}>`,
      to: destinataires.join(","),
      subject: sujet,
      html
    });

    console.log(`📨 Rapport dette N-1 envoyé → ${paiement.eleveNom}`);
  } catch (err) {
    console.error("⚠ Erreur envoi dettes antérieures :", err);
  }
};
