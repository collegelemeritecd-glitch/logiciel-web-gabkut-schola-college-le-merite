/* ============================================================
   📧 GABKUT-ÉCOLE — mailer.js (version stable)
   ------------------------------------------------------------
   - Configuration Nodemailer (Gmail STARTTLS)
   - Résistant aux erreurs SSL et aux timeouts
   - Journalisation automatique des envois
   ============================================================ */

const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// ============================================================
// 📁 Répertoire des logs
// ============================================================
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const mailLogFile = path.join(logsDir, "mail.log");

// ============================================================
// ⚙️ Création du transporteur SMTP STARTTLS
// ============================================================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER || "gabkutpayrdc@gmail.com",
    pass: process.env.SMTP_PASS || "motdepasse_ou_clef_application",
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: "SSLv3",
  },
  connectionTimeout: 15000,
});

// ============================================================
// 🔍 Vérification de la configuration SMTP
// ============================================================
(async () => {
  try {
    await transporter.verify();
    console.log("✅ Mailer connecté avec succès à Gmail (STARTTLS 587).");
  } catch (err) {
    console.error("⚠️ Erreur de configuration SMTP :", err.message);
  }
})();

// ============================================================
// ✉️ Fonction d'envoi universelle
// ============================================================
async function envoyerEmail({ to, subject, html, attachments = [] }) {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || `"Gabkut-École" <${process.env.SMTP_USER || "gabkutpayrdc@gmail.com"}>`,
      to,
      subject,
      html,
      attachments,
    };

    await transporter.sendMail(mailOptions);

    const logMsg = `${new Date().toISOString()} ✅ [SUCCÈS] → ${to} : ${subject}\n`;
    fs.appendFileSync(mailLogFile, logMsg);
    console.log(`📨 Email envoyé à : ${to}`);
    return true;
  } catch (err) {
    const logMsg = `${new Date().toISOString()} ❌ [ÉCHEC] → ${to} : ${subject} – ${err.message}\n`;
    fs.appendFileSync(mailLogFile, logMsg);
    console.error(`❌ Échec d'envoi e-mail (${to}) :`, err.message);
    return false;
  }
}

// ============================================================
// 🧩 Export global
// ============================================================
module.exports = { transporter, envoyerEmail };
