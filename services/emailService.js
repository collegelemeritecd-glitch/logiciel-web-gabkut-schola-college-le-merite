// services/emailService.js
const nodemailer = require('nodemailer');

// Transporteur SMTP (adapte avec tes vraies variables d'env)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Labels de rôles pour les emails (backend)
const ROLE_LABELS = {
  admin: 'Administrateur',
  percepteur: 'Percepteur',
  rh: 'Ressources Humaines',
  comptable: 'Comptable',
  teacher: 'Enseignant',
  student: 'Élève',
  parent: 'Parent',
};

const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Gabkut Schola - Collège Le Mérite';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@collegelemerite.school';

async function sendMail({ to, subject, html }) {
  await transporter.sendMail({
    from: `${FROM_NAME} <${SUPPORT_EMAIL}>`,
    to,
    subject,
    html,
  });
}

exports.sendUserWelcomeEmail = async ({ fullName, email, role, tempPassword }) => {
  const subject = 'Bienvenue sur Gabkut Schola';
  const html = `
    <p>Bonjour ${fullName},</p>
    <p>Un compte vient d'être créé pour vous sur la plateforme <strong>Gabkut Schola</strong>.</p>
    <p><strong>Rôle :</strong> ${ROLE_LABELS[role] || role}</p>
    <p>Identifiants de connexion :</p>
    <ul>
      <li>Email : <strong>${email}</strong></li>
      <li>Mot de passe temporaire : <strong>${tempPassword}</strong></li>
    </ul>
    <p>Pour des raisons de sécurité, vous devrez <strong>obligatoirement changer votre mot de passe</strong> dès votre première connexion.</p>
    <p>Après connexion, allez dans <strong>Mon profil &gt; Sécurité</strong> pour définir un nouveau mot de passe.</p>
  `;
  await sendMail({ to: email, subject, html });
};

exports.sendUserDeletedEmail = async ({ fullName, email, role }) => {
  const subject = 'Modification de votre accès à Gabkut Schola';
  const html = `
    <p>Bonjour ${fullName},</p>
    <p>Votre compte <strong>${ROLE_LABELS[role] || role}</strong> sur Gabkut Schola a été supprimé ou révoqué par l'administration.</p>
    <p>Si vous pensez qu'il s'agit d'une erreur, contactez le secrétariat ou le support.</p>
  `;
  await sendMail({ to: email, subject, html });
};

exports.sendUserStatusChangedEmail = async ({ fullName, email, role, newStatus }) => {
  const subject = 'Mise à jour de votre compte Gabkut Schola';
  const html = `
    <p>Bonjour ${fullName},</p>
    <p>Le statut de votre compte <strong>${ROLE_LABELS[role] || role}</strong> a été mis à jour :</p>
    <p><strong>Nouveau statut :</strong> ${newStatus}</p>
    <p>Si vous avez des questions, contactez le secrétariat.</p>
  `;
  await sendMail({ to: email, subject, html });
};
