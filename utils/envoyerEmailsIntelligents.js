/* ======================================================================
📧 EMAILS INTELLIGENTS — VERSION FINALE 2026
Collège Le Mérite - IA-3 + Prorata dans MAIL UNIQUEMENT
Aucun calcul dans le PDF
====================================================================== */

const path = require("path");
const nodemailer = require("nodemailer");

const Paiement = require("../models/Paiement");
const Classe = require("../models/Classe");
const { SCHOOL_INFO } = require("./generateSchoolReceiptPDF");

/* ======================================================================
📧 TRANSPORTER SMTP (GMAIL STARTTLS)
====================================================================== */

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST2 || "smtp-relay.brevo.com",
  port: Number(process.env.SMTP_PORT2) || 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER2,
    pass: process.env.SMTP_PASS2,
  },
  logger: true,
  debug: true,
});

function creerTransporter() {
  return transporter;
}

/* ======================================================================
📅 CALCUL ANNUEL (Septembre → date réelle du paiement)
====================================================================== */

const MOIS_ANNEE = [
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
];

// retourne le mois scolaire (Sept–Juin) correspondant à la date réelle
function obtenirMoisScolaire(datePaiement) {
  const m = datePaiement.getMonth(); // 0–11
  // Sept (8) → index 0, Octobre (9) → 1, ... Décembre (11) → 3
  // Janvier (0) → 4, Février (1) → 5, ... Juin (5) → 9
  if (m >= 8) return MOIS_ANNEE[m - 8];
  return MOIS_ANNEE[m + 4];
}

// cumul de Septembre jusqu'à la *date réelle* du paiement
function calculerFraisAttendus(mensualite, datePaiement) {
  const JOURS_OUVRABLES = 26;

  if (!mensualite || mensualite <= 0) {
    return {
      totalAttendu: 0,
      moisComplets: 0,
      fraisProrata: 0,
      detailCalcul: "Mensualité non définie pour cette classe.",
    };
  }

  const moisActuelNom = obtenirMoisScolaire(datePaiement);
  const moisIndexActuel = MOIS_ANNEE.indexOf(moisActuelNom);
  const jourActuel = datePaiement.getDate();

  if (moisIndexActuel === -1) {
    return {
      totalAttendu: 0,
      moisComplets: 0,
      fraisProrata: 0,
      detailCalcul: "Mois scolaire actuel inconnu.",
    };
  }

  let total = 0;
  const detail = [];

  // Mois complets de Septembre jusqu'au mois précédent
  const moisComplets = Math.max(0, moisIndexActuel);
  const moisCompletsNoms = MOIS_ANNEE.slice(0, moisComplets);

  if (moisComplets > 0) {
    const montantMoisComplets = mensualite * moisComplets;
    total += montantMoisComplets;
    detail.push(
      `📌 Mois complets écoulés : ${moisComplets} mois (${moisCompletsNoms.join(
        ", "
      )})`
    );
    detail.push(
      `   Calcul : ${moisComplets} × ${mensualite.toFixed(
        2
      )} USD = ${montantMoisComplets.toFixed(2)} USD`
    );
  } else {
    detail.push("📌 Aucun mois complet écoulé avant le mois actuel.");
  }

  // Mois courant au prorata (jusqu'à la date réelle)
  const joursOuvrables = JOURS_OUVRABLES;
  const joursPrisEnCompte = Math.min(jourActuel, joursOuvrables);
  const fraisParJour = mensualite / joursOuvrables;
  const fraisProrata = fraisParJour * joursPrisEnCompte;

  detail.push(
    `\n📅 Mois en cours : ${moisActuelNom} (jour ${joursPrisEnCompte}/${joursOuvrables})`
  );
  detail.push(
    `   - Mensualité ÷ 26 jours = ${fraisParJour.toFixed(4)} USD/jour`
  );
  detail.push(
    `   - ${fraisParJour.toFixed(4)} × ${joursPrisEnCompte} jours = ${fraisProrata.toFixed(
      2
    )} USD`
  );

  total += fraisProrata;

  detail.push(
    `\n💰 TOTAL ATTENDU (Septembre → ${moisActuelNom} / jour ${jourActuel}) : ${total.toFixed(
      2
    )} USD`
  );

  return {
    totalAttendu: parseFloat(total.toFixed(2)),
    moisComplets,
    fraisProrata: parseFloat(fraisProrata.toFixed(2)),
    detailCalcul: detail.join("\n"),
    moisActuelNom,
    jourActuel,
  };
}

/* ======================================================================
📊 ANALYSE DU MOIS DE PAIEMENT (mois choisi dans le formulaire)
====================================================================== */

function analyserMoisPaiement(paiementsEleve, moisChoisi, mensualite) {
  const paiementsCeMois = paiementsEleve.filter((p) => p.mois === moisChoisi);
  const totalPayeCeMois = paiementsCeMois.reduce(
    (s, p) => s + (p.montant || 0),
    0
  );
  const ecartMois = totalPayeCeMois - (mensualite || 0);

  let analyseMois = "";

  if (!mensualite) {
    analyseMois = "Mensualité non définie pour cette classe.";
  } else if (totalPayeCeMois === 0) {
    analyseMois = `❌ Le mois de ${moisChoisi} n'a pas encore été payé.`;
  } else if (ecartMois >= 0) {
    analyseMois = `✅ Le mois de ${moisChoisi} est totalement couvert (${totalPayeCeMois.toFixed(
      2
    )} USD sur ${mensualite.toFixed(2)} USD).`;
  } else {
    analyseMois = `⚠️ Le mois de ${moisChoisi} est partiellement payé : ${totalPayeCeMois.toFixed(
      2
    )} USD sur ${mensualite.toFixed(
      2
    )} USD. Il manque ${Math.abs(ecartMois).toFixed(2)} USD.`;
  }

  return {
    totalPayeCeMois,
    ecartMois,
    analyseMois,
  };
}

/* ======================================================================
🔥 GÉNÉRATION HTML UNIFIÉ (selon destinataire)
====================================================================== */

function genererHTMLUnifie({
  paiement,
  reference,
  destinataire,
  calcul,
  analyseM,
  totalPaye,
  mensualite,
}) {
  const lienLocal = "http://localhost:8080/public-onlinepaiements.html";
  const lienProd =
    "https://www.collegelemerite.school/public-onlinepaiements.html";

  let salutation = "";
  let contexte = "";
  let couleurHeader = "";

  if (destinataire === "eleve") {
    salutation = `Bonjour <strong>${
      paiement.eleveNom || "Cher(e) élève"
    }</strong>,`;
    contexte = "Nous te confirmons la réception de ton paiement :";
    couleurHeader = "#1e3a8a";
  } else if (destinataire === "parent") {
    salutation = `Bonjour <strong>${
      paiement.parentNom || "Cher parent"
    }</strong>,`;
    contexte = `Nous vous informons qu'un paiement a été effectué pour <strong>${
      paiement.eleveNom || "votre enfant"
    }</strong> :`;
    couleurHeader = "#059669";
  } else if (destinataire === "percepteur") {
    salutation = `Bonjour <strong>${
      paiement.percepteurNom || "cher percepteur"
    }</strong>,`;
    contexte = "Voici une copie du reçu que vous avez émis :";
    couleurHeader = "#3b82f6";
  } else {
    salutation = "Équipe administrative,";
    contexte = "Un nouveau paiement a été enregistré :";
    couleurHeader = "#0f172a";
  }

  const reste = calcul.totalAttendu - totalPaye;
  const statutPaiement =
    reste <= 0
      ? "✅ À jour dans les paiements (par rapport au calendrier en cours)."
      : `⚠️ Reste à payer : ${reste.toFixed(
          2
        )} USD sur la période analysée (Septembre → ${
          calcul.moisActuelNom || "mois actuel"
        }).`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reçu - ${reference}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f4f7fc; margin: 0; padding: 20px; }
    .container { max-width: 700px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, ${couleurHeader} 0%, ${couleurHeader}dd 100%); color: white; padding: 26px 30px; text-align: left; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 4px 0 0 0; font-size: 13px; color: #e5e7eb; }
    .content { padding: 26px 30px 24px 30px; line-height: 1.7; color: #111827; font-size: 14px; }
    .box { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px 18px; margin: 18px 0; border-radius: 8px; }
    .calcul-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px 18px; margin: 18px 0; border-radius: 8px; font-size: 13px; white-space: pre-wrap; }
    .title { font-weight: 600; margin: 0 0 6px 0; }
    .btn { display:inline-block; margin: 12px 0 6px 0; padding: 10px 16px; background:#15803d; color:white; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; }
    .footer { background: #f9fafb; padding: 14px 20px 16px 20px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${SCHOOL_INFO.nom}</h1>
      <p>${SCHOOL_INFO.slogan}</p>
    </div>
    
    <div class="content">
      <p>${salutation}</p>
      <p>${contexte}</p>
      
      <div class="box">
        <p class="title">📋 Détails du paiement</p>
        <p><strong>Référence :</strong> ${reference}</p>
        <p><strong>Élève :</strong> ${paiement.eleveNom || "—"}</p>
        <p><strong>Classe :</strong> ${paiement.classeNom || "—"}</p>
        <p><strong>Mois concerné :</strong> ${paiement.mois || "—"}</p>
        <p><strong>Montant payé :</strong> ${(paiement.montant || 0).toFixed(
          2
        )} USD</p>
        <p><strong>Date :</strong> ${new Date(
          paiement.datePaiement || new Date()
        ).toLocaleDateString("fr-FR")}</p>
        <p><strong>Mode de paiement :</strong> ${
          paiement.modePaiement || paiement.moyenPaiement || "Cash"
        }</p>
      </div>

      <p class="title">👨‍👩‍👧 Coordonnées parent / tuteur</p>
      <p><strong>${paiement.parentNom || "—"}</strong><br>${
    paiement.emailParent || paiement.parentContact || "—"
  }</p>

      <div class="calcul-box">
        <p class="title">📊 Analyse du mois de paiement : ${
          paiement.mois || "—"
        }</p>
${analyseM.analyseMois}

- Total payé pour ${paiement.mois} : ${analyseM.totalPayeCeMois.toFixed(
    2
  )} USD
- Mensualité attendue : ${mensualite ? mensualite.toFixed(2) : "0.00"} USD
- Écart : ${analyseM.ecartMois.toFixed(2)} USD

        <p class="title">📊 Calcul annuel (Prorata temporis)</p>
${calcul.detailCalcul}

        <p class="title">📈 Situation globale</p>
- Total payé jusqu'à ce jour : ${totalPaye.toFixed(2)} USD
- Total attendu (Septembre → ${calcul.moisActuelNom}) : ${calcul.totalAttendu.toFixed(
    2
  )} USD
- ${statutPaiement}
      </div>

      <p><strong>Note :</strong> Le reçu officiel est joint à cet email en format PDF.</p>

      <p style="margin-top:14px;margin-bottom:4px;">💳 Pour payer ou compléter votre paiement en ligne :</p>
      <a class="btn" href="${lienProd}" target="_blank">Payer / compléter en ligne</a>
      <p style="font-size:11px;color:#6b7280;margin:4px 0 12px 0;">
        Si le bouton ne fonctionne pas, utilisez ce lien manuellement :<br>
        <a href="${lienProd}" target="_blank" style="color:#2563eb;">${lienProd}</a>
      </p>

      <p>📞 ${SCHOOL_INFO.telephones.join(
        " / "
      )}<br>✉️ ${SCHOOL_INFO.emails[0]}</p>
    </div>

    <div class="footer">
      <p style="margin:0 0 4px 0;">
        Propulsé par <strong>Gabkut-Schola</strong> – Solution digitale pour écoles modernes<br>
        Conçu par <strong>Gabkut Agency LMK</strong> – 
        <a href="https://gabkut.com" target="_blank" style="color:#2563eb;text-decoration:none;">www.gabkut.com</a> – +243 822 783 500
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/* ======================================================================
📧 FONCTIONS D'ENVOI PAR DESTINATAIRE
====================================================================== */

async function preparerContexteCalculs(paiement) {
  // 1) Mensualité de la classe
  let mensualite = 0;
  if (paiement.classeRef || paiement.classe) {
    const classeId = paiement.classeRef || paiement.classe;
    const classeObj = await Classe.findById(classeId);
    mensualite =
      (classeObj && (classeObj.mensualite || classeObj.montantFrais)) || 0;
  }

  // 2) Date réelle du paiement
  const datePaiement = paiement.datePaiement
    ? new Date(paiement.datePaiement)
    : new Date();

  // 3) Calcul annuel
  const calcul = calculerFraisAttendus(mensualite, datePaiement);

  // 4) Tous les paiements de l'élève sur l'année concernée
  const paiementsEleve = await Paiement.find({
    $or: [{ eleve: paiement.eleveId }, { eleveId: paiement.eleveId }],
    anneeConcernee: paiement.anneeConcernee || paiement.anneeScolaire,
  });
  const totalPaye = paiementsEleve.reduce(
    (s, p) => s + (p.montant || 0),
    0
  );

  // 5) Analyse du mois choisi dans le formulaire
  const analyseM = analyserMoisPaiement(
    paiementsEleve,
    paiement.mois,
    mensualite
  );

  return { mensualite, calcul, totalPaye, analyseM };
}

async function envoyerEmailEleve(paiement, reference, pdfPath) {
  if (!paiement.emailEleve) {
    console.log("⚠️ Pas d'email élève configuré");
    return;
  }

  const { mensualite, calcul, totalPaye, analyseM } =
    await preparerContexteCalculs(paiement);

  const html = genererHTMLUnifie({
    paiement,
    reference,
    destinataire: "eleve",
    calcul,
    analyseM,
    totalPaye,
    mensualite,
  });

  const trans = creerTransporter();

  console.log("📤 Envoi mail élève vers:", paiement.emailEleve);
  await trans.sendMail({
    from: `"${SCHOOL_INFO.nom}" <${process.env.SMTP_USER}>`,
    to: paiement.emailEleve,
    subject: `✅ Confirmation paiement - ${reference}`,
    html,
    attachments: pdfPath
      ? [{ filename: `Recu-${reference}.pdf`, path: pdfPath }]
      : [],
  });
  console.log(`📧 Mail élève envoyé à ${paiement.emailEleve}`);
}

async function envoyerEmailParent(paiement, reference, pdfPath) {
  if (!paiement.emailParent) {
    console.log("⚠️ Pas d'email parent configuré");
    return;
  }

  const { mensualite, calcul, totalPaye, analyseM } =
    await preparerContexteCalculs(paiement);

  const html = genererHTMLUnifie({
    paiement,
    reference,
    destinataire: "parent",
    calcul,
    analyseM,
    totalPaye,
    mensualite,
  });

  const trans = creerTransporter();

  console.log("📤 Envoi mail parent vers:", paiement.emailParent);
  await trans.sendMail({
    from: `"${SCHOOL_INFO.nom}" <${process.env.SMTP_USER}>`,
    to: paiement.emailParent,
    subject: `✅ Paiement reçu pour ${paiement.eleveNom} - ${reference}`,
    html,
    attachments: pdfPath
      ? [{ filename: `Recu-${reference}.pdf`, path: pdfPath }]
      : [],
  });
  console.log(`📧 Mail parent envoyé à ${paiement.emailParent}`);
}

async function envoyerEmailPercepteur(paiement, reference, pdfPath) {
  if (!paiement.emailPercepteur) {
    console.log("⚠️ Pas d'email percepteur configuré");
    return;
  }

  const { mensualite, calcul, totalPaye, analyseM } =
    await preparerContexteCalculs(paiement);

  const html = genererHTMLUnifie({
    paiement,
    reference,
    destinataire: "percepteur",
    calcul,
    analyseM,
    totalPaye,
    mensualite,
  });

  const trans = creerTransporter();

  console.log("📤 Envoi mail percepteur vers:", paiement.emailPercepteur);
  await trans.sendMail({
    from: `"${SCHOOL_INFO.nom}" <${process.env.SMTP_USER}>`,
    to: paiement.emailPercepteur,
    subject: `📋 Copie reçu ${reference}`,
    html,
    attachments: pdfPath
      ? [{ filename: `Recu-${reference}.pdf`, path: pdfPath }]
      : [],
  });
  console.log(`📧 Mail percepteur envoyé à ${paiement.emailPercepteur}`);
}

async function envoyerEmailEcole(paiement, reference) {
  const { mensualite, calcul, totalPaye, analyseM } =
    await preparerContexteCalculs(paiement);

  const html = genererHTMLUnifie({
    paiement,
    reference,
    destinataire: "ecole",
    calcul,
    analyseM,
    totalPaye,
    mensualite,
  });

  const destinataires = [
    ...(SCHOOL_INFO.emails || []),
    process.env.ADMIN_EMAIL,
  ].filter(Boolean);

  const trans = creerTransporter();

  console.log("📤 Envoi mail école vers:", destinataires.join(", "));
  await trans.sendMail({
    from: `"${SCHOOL_INFO.nom}" <${process.env.SMTP_USER}>`,
    to: destinataires.join(","),
    subject: `📊 Nouveau paiement - ${reference}`,
    html,
  });
  console.log("📨 Mail école (journal interne) envoyé");
}

/* ======================================================================
🚀 FONCTION PRINCIPALE — ENVOI DES 4 EMAILS
====================================================================== */

async function envoyerEmailsIntelligents(paiement, pdfPath) {
  try {
    // on utilise la référence déjà générée par le modèle Paiement
    const reference = paiement.reference || "REF-INCONNUE";

    await Promise.all([
      envoyerEmailEleve(paiement, reference, pdfPath).catch((e) =>
        console.error("❌ Erreur mail élève:", e)
      ),
      envoyerEmailParent(paiement, reference, pdfPath).catch((e) =>
        console.error("❌ Erreur mail parent:", e)
      ),
      envoyerEmailPercepteur(paiement, reference, pdfPath).catch((e) =>
        console.error("❌ Erreur mail percepteur:", e)
      ),
      envoyerEmailEcole(paiement, reference).catch((e) =>
        console.error("❌ Erreur mail école:", e)
      ),
    ]);

    console.log(`✅ Tous les emails envoyés avec succès (Ref: ${reference})`);
  } catch (err) {
    console.error("❌ Erreur globale emails intelligents:", err);
    throw err;
  }
}

/* ======================================================================
EXPORTS
====================================================================== */

module.exports = {
  SCHOOL_INFO,
  calculerFraisAttendus,
  analyserMoisPaiement,
  genererHTMLUnifie,
  envoyerEmailsIntelligents,
};
