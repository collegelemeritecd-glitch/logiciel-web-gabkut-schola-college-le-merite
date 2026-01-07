// ========================================================================
// 💌 GABKUT-SCHOLA – Envoi Multiples Emails Professionnels
// utils/envoyerEmailsMultiples.js
// ========================================================================
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const { logEmailActivity } = require("./logEmailActivity");

// ============================================================
// 🏫 CONFIGURATION INSTITUTIONNELLE
// ============================================================
const ECOLE_INFO = {
  nom: "Collège Le Mérite",
  ville: "Lubumbashi",
  commune: "Kampemba",
  quartier: "Bel-Air",
  avenue: "Frangipanier",
  numero: "27",
  telephones: ["+243970008546", "+243829607488"],
  emails: [
    "gabkutpayrdc@gmail.com",
    "bannierebusiness@gmail.com",
    "genevievetulengi@gmail.com",
    "kutalagael@gmail.com",
  ],
  siteWeb: "www.collegelemerite.cd",
  signatureGabkut: "© Gabkut Agency LMK – Signature électronique vérifiée / +243822783500",
  marque: "Gabkut-Schola – propulsé par Gabkut Agency LMK",
};

// ============================================================
// ⚙️ CONFIGURATION DU TRANSPORTEUR (Gmail STARTTLS 587)
// ============================================================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

// ============================================================================
// 💌 ENVOI DES EMAILS (École → Élève → Parent → Percepteur)
// ============================================================================
async function envoyerEmailsMultiples(paiement, pdfPath, rapportPath) {
  try {
    const {
      eleveNom,
      emailEleve,
      parentNom,
      emailParent,
      parentContact,
      percepteurNom,
      emailPercepteur,
      classe,
      mois,
      montant,
      reference,
    } = paiement;

    // VALIDATION PDF
    if (!fs.existsSync(pdfPath)) {
      console.warn("⚠️ PDF introuvable pour l’envoi :", pdfPath);
      return false;
    }

    const nomRecu = `Reçu_${eleveNom}.pdf`;

    // ============================================================
    // 1️⃣ EMAIL À L'ÉCOLE (copie administrative)
    // ============================================================
    await transporter.sendMail({
      from: `"${ECOLE_INFO.nom}" <${process.env.SMTP_USER}>`,
      to: ECOLE_INFO.emails.join(","),
      subject: `🏫 Copie administrative – Paiement ${eleveNom} (${mois})`,
      text: `
      Nouveau paiement enregistré :
      • Élève : ${eleveNom}
      • Classe : ${classe}
      • Mois : ${mois}
      • Montant : ${montant} USD
      • Référence : ${reference}
      
      Document généré automatiquement par Gabkut-Schola.
      `,
      attachments: [{ filename: nomRecu, path: pdfPath }],
    });

    await logEmailActivity({
      reference,
      destinataire: ECOLE_INFO.emails.join(","),
      sujet: `🏫 Copie administrative – ${eleveNom}`,
      statut: "succès",
    });

    console.log("📨 Mail école envoyé ✔");

    // ============================================================
    // 2️⃣ EMAIL À L'ÉLÈVE
    // ============================================================
    if (emailEleve) {
      await transporter.sendMail({
        from: `"${ECOLE_INFO.nom}" <${process.env.SMTP_USER}>`,
        to: emailEleve,
        subject: `🎓 Confirmation de paiement – ${eleveNom}`,
        html: `
          <p>Bonjour ${eleveNom},</p>
          <p>Ton paiement du mois de <strong>${mois}</strong> (${montant} USD) a été enregistré.</p>
          <p>${ECOLE_INFO.signatureGabkut}</p>
        `,
        attachments: [{ filename: nomRecu, path: pdfPath }],
      });

      await logEmailActivity({
        reference,
        destinataire: emailEleve,
        sujet: `🎓 Confirmation – ${eleveNom}`,
        statut: "succès",
      });

      console.log("📘 Mail élève envoyé ✔");
    } else {
      console.log("⚠️ Aucun email élève fourni.");
    }

    // ============================================================
    // 3️⃣ EMAIL AU PARENT
    // ============================================================
    const destParent = emailParent || parentContact;
    if (destParent) {
      await transporter.sendMail({
        from: `"${ECOLE_INFO.nom}" <${process.env.SMTP_USER}>`,
        to: destParent,
        subject: `👨‍👩‍👧 Copie parent – ${eleveNom}`,
        html: `
          <p>Bonjour ${parentNom || "Parent"},</p>
          <p>Votre paiement pour <strong>${eleveNom}</strong> (${classe}) a été dûment enregistré.</p>
          <p>Mois : ${mois} — Montant : ${montant} USD.</p>
          <p>${ECOLE_INFO.marque}</p>
        `,
        attachments: [{ filename: nomRecu, path: pdfPath }],
      });

      await logEmailActivity({
        reference,
        destinataire: destParent,
        sujet: `👨‍👩‍👧 Copie parent – ${eleveNom}`,
        statut: "succès",
      });

      console.log("📧 Mail parent envoyé ✔");
    } else {
      console.log("⚠️ Aucun email parent fourni.");
    }

    // ============================================================
    // 4️⃣ EMAIL AU PERCEPTEUR
    // ============================================================
    if (emailPercepteur) {
      await transporter.sendMail({
        from: `"${ECOLE_INFO.nom}" <${process.env.SMTP_USER}>`,
        to: emailPercepteur,
        subject: `💼 Copie percepteur – Paiement ${reference}`,
        html: `
          <p>Bonjour ${percepteurNom || "Percepteur"},</p>
          <p>Un nouveau paiement a été enregistré et validé.</p>
          <p>Référence : <strong>${reference}</strong></p>
          <p>${ECOLE_INFO.marque}</p>
        `,
        attachments: [{ filename: nomRecu, path: pdfPath }],
      });

      await logEmailActivity({
        reference,
        destinataire: emailPercepteur,
        sujet: `💼 Copie percepteur – ${percepteurNom}`,
        statut: "succès",
      });

      console.log("📤 Mail percepteur envoyé ✔");
    } else {
      console.log("⚠️ Aucun email percepteur fourni.");
    }

    console.log("✅ Tous les emails ont été envoyés !");

    

    // ============================================================
// ✉ Envoi aux 4 destinataires automatiquement
// ============================================================
if (paiement.emailParent) {
  await transporter.sendMail(mailParent);
  console.log("📨 Mail parent envoyé");
}

if (paiement.emailEleve) {
  await transporter.sendMail(mailEleve);
  console.log("📨 Mail élève envoyé");
}

if (paiement.emailPercepteur) {
  await transporter.sendMail(mailPercepteur);
  console.log("📨 Mail percepteur envoyé");
}

// ⚠ Mail école toujours envoyé même si plusieurs destinataires manquent
await transporter.sendMail(mailEcole);
console.log("📨 Mail école (journal interne) envoyé avec succès");


  } catch (err) {
    console.error("❌ ERREUR ENVOI MAILS :", err);
    return false;
  }
}

module.exports = { envoyerEmailsMultiples };
