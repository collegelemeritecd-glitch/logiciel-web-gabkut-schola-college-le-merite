// services/mailingService.js

// Ici tu pourras brancher Brevo / SendGrid / SMTP...
// Pour l'instant on logge juste en console.

async function sendEmail({ to, subject, html, text }) {
  if (!to) {
    console.warn('[mailingService] sendEmail sans destinataire, ignoré.');
    return;
  }

  // TODO: remplacer par ton provider réel
  console.log('[mailingService] SEND EMAIL', {
    to,
    subject,
    textPreview: text ? text.slice(0, 120) : '',
  });

  // Exemple Brevo :
  // await brevoClient.sendTransactionalEmail({ to: [{ email: to }], subject, htmlContent: html, textContent: text });

  return true;
}

/**
 * Envoi d'un mail d'avertissement d'assiduité aux parents.
 * student: { fullName, parentEmail }
 * payload: { classLabel, month, year, absenceDays, lateDays }
 */
async function sendAttendanceWarningToParents(student, payload) {
  const { fullName, parentEmail } = student;
  if (!parentEmail) {
    console.warn('[mailingService] Pas de parentEmail pour', fullName);
    return;
  }

  const { classLabel, month, year, absenceDays, lateDays } = payload;

  const subject = `Avertissement d'assiduité - ${fullName} (${classLabel}, ${month}/${year})`;

  const text = `
Bonjour,

Nous avons constaté des problèmes d'assiduité pour l'élève ${fullName} dans la classe ${classLabel} pour le mois ${month}/${year}.

Absences: ${absenceDays}
Retards: ${lateDays}

Nous vous invitons à prendre contact avec l'établissement pour discuter de la situation.

Cordialement,
La direction
`.trim();

  const html = `
<p>Bonjour,</p>
<p>Nous avons constaté des problèmes d'assiduité pour l'élève <strong>${fullName}</strong> dans la classe <strong>${classLabel}</strong> pour le mois <strong>${month}/${year}</strong>.</p>
<ul>
  <li>Absences: <strong>${absenceDays}</strong></li>
  <li>Retards: <strong>${lateDays}</strong></li>
</ul>
<p>Nous vous invitons à prendre contact avec l'établissement pour discuter de la situation.</p>
<p>Cordialement,<br/>La direction</p>
`;

  return sendEmail({ to: parentEmail, subject, html, text });
}

module.exports = {
  sendEmail,
  sendAttendanceWarningToParents,
};
