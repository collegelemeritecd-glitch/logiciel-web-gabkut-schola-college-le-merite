const nodemailer = require("nodemailer");

/* ==========================================================
   📨 Mail automatique aux parents — Module officiel PRO MAX
========================================================== */
async function envoyerEmailParent(to, subject, message) {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Gabkut-École – IA Paiements" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: `
        <div style="font-family:Segoe UI, sans-serif; font-size:15px; line-height:1.6;">
          ${message.replace(/\n/g, "<br/>")}
          <br/><br/>
          <hr/>
          <b style="color:#0A58CA;">Gabkut-École — Système IA automatisé</b><br/>
          <span style="font-size:13px; color:#555;">Ne pas répondre à ce message généré automatiquement.</span>
        </div>
      `,
    });

    console.log(`📨 Email envoyé au parent : ${to}`);
    return true;
  } catch (e) {
    console.error("❌ Erreur mail parent :", e.message);
    return false;
  }
}

module.exports = envoyerEmailParent;
