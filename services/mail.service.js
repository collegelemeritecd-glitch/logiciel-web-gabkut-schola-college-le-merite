const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,      // ex: smtp.gmail.com ou ton SMTP
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,                    // true si port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendNewsletterConfirmation(email) {
  const appName = 'Gabkut Schola';
  const schoolName = 'Collège Le Mérite';

  const html = `
  <div style="background:#f4f4f4;padding:20px 0;font-family:Arial,sans-serif;">
    <table align="center" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background:#ffbc3b;padding:20px;text-align:center;">
          <h1 style="margin:0;color:#1e1e4b;font-size:24px;">${appName}</h1>
          <p style="margin:4px 0 0;color:#1e1e4b;font-size:14px;">${schoolName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 24px 10px;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#1e1e4b;">
            Vous êtes maintenant abonné à notre newsletter
          </h2>
          <p style="margin:0 0 10px;font-size:14px;color:#5c5c77;line-height:1.6;">
            Bonjour,<br>
            Nous confirmons votre inscription à la newsletter de <strong>${schoolName}</strong>.
          </p>
          <p style="margin:0 0 10px;font-size:14px;color:#5c5c77;line-height:1.6;">
            Vous recevrez désormais nos actualités, informations importantes et annonces directement sur cette adresse e‑mail.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 20px;">
          <p style="margin:0 0 8px;font-size:13px;color:#5c5c77;">
            Si vous n’êtes pas à l’origine de cette inscription, vous pouvez ignorer ce message ou
            nous contacter pour toute question.
          </p>
          <p style="margin:0;font-size:13px;color:#5c5c77;">
            Contact : <a href="mailto:contact@gabkut.com" style="color:#ffbc3b;text-decoration:none;">contact@gabkut.com</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#1a1a37;padding:12px 24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#d6d6e0;">
            © ${new Date().getFullYear()} ${appName} – Tous droits réservés.
          </p>
        </td>
      </tr>
    </table>
  </div>
  `;

  await transporter.sendMail({
    from: `"Gabkut Schola" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: 'Confirmation d’inscription à la newsletter',
    html,
  });
}

module.exports = {
  sendNewsletterConfirmation,
};
