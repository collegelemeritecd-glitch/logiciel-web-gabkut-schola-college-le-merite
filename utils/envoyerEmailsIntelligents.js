/* ======================================================================
   📧 EMAILS INTELLIGENTS ULTRA PRO MAX 2026 — VERSION FUSION TOTALE
   Collège Le Mérite - IA-3 + Prorata temporis + 4 mails séparés
   Gabkut Agency LMK +243822783500
   
   ✅ 4 emails séparés (Parent, Élève, Percepteur, École)
   ✅ Calcul prorata temporis pédagogique
   ✅ Analyse du mois de paiement (mensualité vs payé)
   ✅ Référence propre (sans chemin D:\...)
   ✅ Synchronisation IA-3
   ✅ Analyse situation élève
   ✅ Génération rapport financier automatique
====================================================================== */

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

const Paiement = require("../models/Paiement");
const Eleve = require("../models/Eleve");
const Classe = require("../models/Classe");

const enregistrerActivite = require("./enregistrerActivite");

const receiptsDir = path.join(__dirname, "../public/receipts");
fs.mkdirSync(receiptsDir, { recursive: true });

/* ======================================================================
   🏫 CONFIGURATION ÉCOLE
====================================================================== */
const ECOLE_CONFIG = {
  nom: "Collège Le Mérite",
  slogan: "Connaissance • Rigueur • Réussite",
  devise: "Travail et Excellence",
  logoPath: path.join(__dirname, "../public/assets/ecole/logo.jpg"),
  cachetPath: path.join(__dirname, "../public/assets/ecole/cachet.jpg"),
  signaturePath: path.join(__dirname, "../public/assets/ecole/signature.jpg"),
  ville: "Lubumbashi",
  commune: "Kampemba",
  quartier: "Bel-Air",
  avenue: "Frangipanier",
  numero: "27",
  telephones: ["+243970008546", "+243829607488"],
  emails: [
    "gabkutpayrdc@gmail.com",
    "bannierebusiness@gmail.com",
    "collegelemerite5@gmail.com",
    "Kabululumwembomarcel00@gmail.com",
    "kutalagael@gmail.com",
  ],
  siteWeb: "www.collegelemerite.cd",
  signatureGabkut:
    "© Gabkut Agency LMK – Signature électronique vérifiée / +243822783500",
  marque: "Gabkut-Schola – propulsé par Gabkut Agency LMK",
};

const SCHOOL_INFO = ECOLE_CONFIG;

/* ======================================================================
   📅 CALCUL PRORATA TEMPORIS PÉDAGOGIQUE
====================================================================== */
function calculerFraisAttendus(mensualite, dateActuelle = new Date()) {
  const moisActuel = dateActuelle.getMonth();
  const jourActuel = dateActuelle.getDate();
  
  const moisSeptembre = 8;
  
  let total = 0;
  let detailCalcul = [];
  
  let moisEcoules = 0;
  
  if (moisActuel >= moisSeptembre) {
    moisEcoules = moisActuel - moisSeptembre;
  } else {
    moisEcoules = (12 - moisSeptembre) + moisActuel;
  }
  
  total = moisEcoules * mensualite;
  
  const moisListe = ["Septembre", "Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];
  const moisPayes = moisListe.slice(0, moisEcoules);
  
  detailCalcul.push(`📌 **Mois complets écoulés** : ${moisEcoules} mois (${moisPayes.join(", ")})`);
  detailCalcul.push(`   Calcul : ${moisEcoules} × ${mensualite} USD = **${total} USD**`);
  
  const joursOuvrables = 26;
  const fraisParJour = mensualite / joursOuvrables;
  const fraisProrata = fraisParJour * jourActuel;
  
  const moisEnCoursNom = moisListe[moisEcoules] || "Mois inconnu";
  
  detailCalcul.push(`\n📅 **Mois en cours** : ${moisEnCoursNom} (jour ${jourActuel}/${joursOuvrables})`);
  detailCalcul.push(`   Prorata temporis :`);
  detailCalcul.push(`   - Mensualité ÷ 26 jours ouvrables = ${fraisParJour.toFixed(2)} USD/jour`);
  detailCalcul.push(`   - ${fraisParJour.toFixed(2)} USD/jour × ${jourActuel} jours = **${fraisProrata.toFixed(2)} USD**`);
  
  total += fraisProrata;
  
  detailCalcul.push(`\n💰 **TOTAL ATTENDU** : ${total.toFixed(2)} USD`);
  
  return {
    totalAttendu: parseFloat(total.toFixed(2)),
    moisComplets: moisEcoules,
    fraisProrata: parseFloat(fraisProrata.toFixed(2)),
    detailCalcul: detailCalcul.join("\n"),
    joursOuvrables,
    jourActuel,
    moisEnCoursNom
  };
}

/* ======================================================================
   🔥 FONCTION ANALYSE DU MOIS DE PAIEMENT
====================================================================== */
function analyserMoisPaiement(paiements, moisPaye, mensualite) {
  const paiementsCeMois = paiements.filter(p => p.mois === moisPaye);
  const totalPayeCeMois = paiementsCeMois.reduce((s, p) => s + (p.montant || 0), 0);
  const ecartMois = totalPayeCeMois - mensualite;
  
  let analyseMois = "";
  
  if (totalPayeCeMois === 0) {
    analyseMois = `❌ **Le mois de ${moisPaye}** n'a pas encore été payé.`;
  } else if (ecartMois >= 0) {
    analyseMois = `✅ **Le mois de ${moisPaye}** est **totalement couvert** (${totalPayeCeMois.toFixed(2)} USD sur ${mensualite} USD attendus).`;
  } else {
    analyseMois = `⚠️ **Le mois de ${moisPaye}** est **partiellement payé** : ${totalPayeCeMois.toFixed(2)} USD sur ${mensualite} USD. Il manque **${Math.abs(ecartMois).toFixed(2)} USD**.`;
  }
  
  return {
    totalPayeCeMois,
    ecartMois,
    analyseMois
  };
}

/* ======================================================================
   📧 TRANSPORTER SMTP
====================================================================== */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.gabkut.com",
  port: 465,
  secure: true,
  tls: { rejectUnauthorized: false },
  auth: {
    user: process.env.SMTP_USER || "admin@gabkut.com",
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || "Gabkut@2024",
  },
});

function creerTransporter() {
  return transporter;
}

/* ======================================================================
   🔥 GÉNÉRATION HTML UNIFIÉ (POUR LES 4 DESTINATAIRES)
====================================================================== */
function genererHTMLUnifie(paiement, reference, pdfPath, destinataire, calcul, analyseM, paiementsEleve, totalPaye, mensualite) {
  const pdfFilename = pdfPath && typeof pdfPath === 'string'
    ? path.basename(pdfPath, '.pdf').replace('Recu-', '')
    : reference || 'REF-MANQUANTE';
  
  const reste = calcul.totalAttendu - totalPaye;
  
  let salutation = "";
  let contexte = "";
  let couleurHeader = "";
  
  if (destinataire === "eleve") {
    salutation = `Bonjour <strong>${paiement.eleveNom || "Cher(e) élève"}</strong>,`;
    contexte = "Nous te confirmons la réception de ton paiement :";
    couleurHeader = "#1e3a8a";
  } else if (destinataire === "parent") {
    salutation = `Bonjour <strong>${paiement.parentNom || "Cher parent"}</strong>,`;
    contexte = `Nous vous informons qu'un paiement a été effectué pour <strong>${paiement.eleveNom || "votre enfant"}</strong> :`;
    couleurHeader = "#059669";
  } else if (destinataire === "percepteur") {
    salutation = `Bonjour <strong>${paiement.percepteurNom || "cher percepteur"}</strong>,`;
    contexte = "Voici une copie du reçu que vous avez émis :";
    couleurHeader = "#3b82f6";
  } else {
    salutation = "Équipe administrative,";
    contexte = "Un nouveau paiement a été enregistré :";
    couleurHeader = "#0f172a";
  }
  
  const statutPaiement = reste <= 0 
    ? "✅ **À jour** dans les paiements !" 
    : `⚠️ Il reste **${reste.toFixed(2)} USD** à payer.`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f4f7fc; margin: 0; padding: 20px; }
    .container { max-width: 650px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, ${couleurHeader} 0%, ${couleurHeader}dd 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; }
    .content { padding: 30px; line-height: 1.8; color: #333; }
    .receipt-box { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .receipt-box h3 { margin-top: 0; color: ${couleurHeader}; }
    .detail-line { margin: 8px 0; padding: 8px; background: white; border-radius: 4px; }
    .calcul-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px; white-space: pre-wrap; font-family: monospace; font-size: 13px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 ${SCHOOL_INFO.nom}</h1>
      <p style="margin: 5px 0; font-size: 14px;">${SCHOOL_INFO.slogan}</p>
    </div>
    
    <div class="content">
      <h2 style="color: ${couleurHeader};">${salutation}</h2>
      
      <p>${contexte}</p>
      
      <div class="receipt-box">
        <h3>📋 Détails du paiement</h3>
        <div class="detail-line"><strong>Référence:</strong> ${pdfFilename}</div>
        <div class="detail-line"><strong>Montant payé:</strong> ${paiement.montant} USD</div>
        <div class="detail-line"><strong>Mois concerné:</strong> ${paiement.mois}</div>
        <div class="detail-line"><strong>Classe:</strong> ${paiement.classe}</div>
        <div class="detail-line"><strong>Date:</strong> ${new Date(paiement.datePaiement).toLocaleDateString("fr-FR")}</div>
      </div>
      
      <div class="calcul-box">
        <strong>📊 ANALYSE DU MOIS DE PAIEMENT : ${paiement.mois}</strong>
        
${analyseM.analyseMois}

- Total payé pour ${paiement.mois} : ${analyseM.totalPayeCeMois.toFixed(2)} USD
- Mensualité attendue : ${mensualite.toFixed(2)} USD
- Écart : ${analyseM.ecartMois.toFixed(2)} USD

        <strong>📊 CALCUL ANNUEL (Prorata Temporis)</strong>
        
${calcul.detailCalcul}
        
<strong>📈 SITUATION GLOBALE</strong>
- Total payé jusqu'à ce jour : ${totalPaye.toFixed(2)} USD
- Total attendu : ${calcul.totalAttendu.toFixed(2)} USD
- ${statutPaiement}
      </div>
      
      <p><strong>Note:</strong> Le reçu officiel est joint à cet email en format PDF.</p>
      
      <p>Pour toute question, contactez-nous :</p>
      <p>📞 ${SCHOOL_INFO.telephones.join(" / ")}<br>
      ✉️ ${SCHOOL_INFO.emails[0]}</p>
      
      <p style="margin-top: 30px;">Cordialement,<br>
      <strong>L'administration</strong><br>
      ${SCHOOL_INFO.nom}</p>
    </div>
    
    <div class="footer">
      <p>${SCHOOL_INFO.signatureGabkut}</p>
      <p>${SCHOOL_INFO.marque}</p>
    </div>
  </div>
</body>
</html>
  `;
}

/* ======================================================================
   📧 EMAIL ÉLÈVE
====================================================================== */
async function envoyerEmailEleve(paiement, reference, pdfPath) {
  const trans = creerTransporter();
  
  if (!paiement.emailEleve) {
    console.log("⚠️ Pas d'email élève configuré");
    return;
  }
  
  const classeObj = await Classe.findOne({ nom: paiement.classe });
  const mensualite = classeObj?.mensualite || classeObj?.montantFrais || 40;
  
  const calcul = calculerFraisAttendus(mensualite, new Date(paiement.datePaiement));
  
  const paiementsEleve = await Paiement.find({ eleveNom: paiement.eleveNom });
  const totalPaye = paiementsEleve.reduce((s, p) => s + (p.montant || 0), 0);
  
  const analyseM = analyserMoisPaiement(paiementsEleve, paiement.mois, mensualite);
  
  const htmlEleve = genererHTMLUnifie(paiement, reference, pdfPath, "eleve", calcul, analyseM, paiementsEleve, totalPaye, mensualite);
  
  const pdfFilename = pdfPath && typeof pdfPath === 'string'
    ? path.basename(pdfPath, '.pdf').replace('Recu-', '')
    : reference || 'REF-MANQUANTE';

  await trans.sendMail({
    from: `"${SCHOOL_INFO.nom}" <${process.env.SMTP_USER || "admin@gabkut.com"}>`,
    to: paiement.emailEleve,
    subject: `✅ Confirmation paiement - ${pdfFilename}`,
    html: htmlEleve,
    attachments: [{ filename: `Recu-${pdfFilename}.pdf`, path: pdfPath }],
  });

  console.log(`📧 Mail élève envoyé à ${paiement.emailEleve}`);
}

/* ======================================================================
   📧 EMAIL PARENT
====================================================================== */
async function envoyerEmailParent(paiement, reference, pdfPath) {
  const trans = creerTransporter();
  
  if (!paiement.emailParent) {
    console.log("⚠️ Pas d'email parent configuré");
    return;
  }
  
  const classeObj = await Classe.findOne({ nom: paiement.classe });
  const mensualite = classeObj?.mensualite || classeObj?.montantFrais || 40;
  
  const calcul = calculerFraisAttendus(mensualite, new Date(paiement.datePaiement));
  
  const paiementsEleve = await Paiement.find({ eleveNom: paiement.eleveNom });
  const totalPaye = paiementsEleve.reduce((s, p) => s + (p.montant || 0), 0);
  
  const analyseM = analyserMoisPaiement(paiementsEleve, paiement.mois, mensualite);
  
  const htmlParent = genererHTMLUnifie(paiement, reference, pdfPath, "parent", calcul, analyseM, paiementsEleve, totalPaye, mensualite);
  
  const pdfFilename = pdfPath && typeof pdfPath === 'string'
    ? path.basename(pdfPath, '.pdf').replace('Recu-', '')
    : reference || 'REF-MANQUANTE';

  await trans.sendMail({
    from: `"${SCHOOL_INFO.nom}" <${process.env.SMTP_USER || "admin@gabkut.com"}>`,
    to: paiement.emailParent,
    subject: `✅ Paiement reçu pour ${paiement.eleveNom} - ${pdfFilename}`,
    html: htmlParent,
    attachments: [{ filename: `Recu-${pdfFilename}.pdf`, path: pdfPath }],
  });

  console.log(`📧 Mail parent envoyé à ${paiement.emailParent}`);
}

/* ======================================================================
   📧 EMAIL PERCEPTEUR
====================================================================== */
async function envoyerEmailPercepteur(paiement, reference, pdfPath) {
  const trans = creerTransporter();
  
  if (!paiement.emailPercepteur) {
    console.log("⚠️ Pas d'email percepteur configuré");
    return;
  }

  const classeObj = await Classe.findOne({ nom: paiement.classe });
  const mensualite = classeObj?.mensualite || classeObj?.montantFrais || 40;
  
  const calcul = calculerFraisAttendus(mensualite, new Date(paiement.datePaiement));
  const paiementsEleve = await Paiement.find({ eleveNom: paiement.eleveNom });
  const totalPaye = paiementsEleve.reduce((s, p) => s + (p.montant || 0), 0);
  
  const analyseM = analyserMoisPaiement(paiementsEleve, paiement.mois, mensualite);
  
  const htmlPercepteur = genererHTMLUnifie(paiement, reference, pdfPath, "percepteur", calcul, analyseM, paiementsEleve, totalPaye, mensualite);
  
  const pdfFilename = pdfPath && typeof pdfPath === 'string'
    ? path.basename(pdfPath, '.pdf').replace('Recu-', '')
    : reference || 'REF-MANQUANTE';

  await trans.sendMail({
    from: `"${SCHOOL_INFO.nom}" <${process.env.SMTP_USER || "admin@gabkut.com"}>`,
    to: paiement.emailPercepteur,
    subject: `📋 Copie reçu ${pdfFilename}`,
    html: htmlPercepteur,
    attachments: [{ filename: `Recu-${pdfFilename}.pdf`, path: pdfPath }],
  });

  console.log(`📧 Mail percepteur envoyé à ${paiement.emailPercepteur}`);
}

/* ======================================================================
   📧 EMAIL ÉCOLE
====================================================================== */
async function envoyerEmailEcole(paiement, reference, pdfPath) {
  const trans = creerTransporter();
  
  const classeObj = await Classe.findOne({ nom: paiement.classe });
  const mensualite = classeObj?.mensualite || classeObj?.montantFrais || 0;
  const paiementsEleve = await Paiement.find({ eleveNom: paiement.eleveNom });
  
  const totalPaye = paiementsEleve.reduce((s, p) => s + (p.montant || 0), 0);
  const calcul = calculerFraisAttendus(mensualite, new Date(paiement.datePaiement));
  
  const analyseM = analyserMoisPaiement(paiementsEleve, paiement.mois, mensualite);
  
  const htmlEcole = genererHTMLUnifie(paiement, reference, pdfPath, "ecole", calcul, analyseM, paiementsEleve, totalPaye, mensualite);

  const destinataires = [
    ...ECOLE_CONFIG.emails,
    "kutalagael@gmail.com",
    "bannierebusiness@gmail.com",
  ].filter(Boolean);
  
  const pdfFilename = pdfPath && typeof pdfPath === 'string'
    ? path.basename(pdfPath, '.pdf').replace('Recu-', '')
    : reference || 'REF-MANQUANTE';

  await trans.sendMail({
    from: `"${SCHOOL_INFO.nom}" <${process.env.SMTP_USER || "admin@gabkut.com"}>`,
    to: destinataires.join(","),
    subject: `📊 Nouveau paiement - ${pdfFilename}`,
    html: htmlEcole,
  });

  console.log(`📨 Mail école (journal interne) envoyé avec succès`);
}

/* ======================================================================
   🚀 FONCTION PRINCIPALE - ENVOI SIMULTANÉ DES 4 EMAILS
====================================================================== */
async function envoyerEmailsIntelligents(paiement, reference, pdfPath) {
  try {
    await Promise.all([
      envoyerEmailEleve(paiement, reference, pdfPath).catch(e => console.error("❌ Erreur mail élève:", e)),
      envoyerEmailParent(paiement, reference, pdfPath).catch(e => console.error("❌ Erreur mail parent:", e)),
      envoyerEmailPercepteur(paiement, reference, pdfPath).catch(e => console.error("❌ Erreur mail percepteur:", e)),
      envoyerEmailEcole(paiement, reference, pdfPath).catch(e => console.error("❌ Erreur mail école:", e)),
    ]);

    console.log("✅ Tous les emails envoyés avec succès");
  } catch (err) {
    console.error("❌ Erreur globale emails:", err);
    throw err;
  }
}

/* ======================================================================
   🧠 SYNCHRONISATION IA-3
====================================================================== */
async function synchroniserIA3(paiement) {
  try {
    const { eleveNom, classe, montant } = paiement;

    const paiementsEleve = await Paiement.find({ eleveNom });
    const totalPaye = paiementsEleve.reduce((s, p) => s + (p.montant || 0), 0);

    const eleve = await Eleve.findOne({ nom: eleveNom });
    if (eleve) {
      const classeObj = await Classe.findOne({ nom: classe });
      const mensualite = classeObj?.mensualite || classeObj?.montantFrais || 0;

      const calcul = calculerFraisAttendus(mensualite);
      const ecart = totalPaye - calcul.totalAttendu;

      let statut = "Partiel";
      if (totalPaye === 0) statut = "En retard";
      if (totalPaye >= calcul.totalAttendu) statut = "À jour";
      if (totalPaye > calcul.totalAttendu + mensualite) statut = "Anticipé / Avancé";

      await Eleve.findByIdAndUpdate(eleve._id, {
        montantPaye: totalPaye,
        montantAttenduIA: calcul.totalAttendu.toFixed(2),
        ecartIA: ecart.toFixed(2),
        statut,
        derniereMaj: new Date(),
      });

      console.log(
        `🤖 IA-3 : Mise à jour élève ${eleveNom} (Paye ${totalPaye}$ / Attendu ${calcul.totalAttendu.toFixed(
          2
        )}$ → ${statut})`
      );
    }

    const paiementsClasse = await Paiement.find({ classe });
    const totalClasse = paiementsClasse.reduce((s, p) => s + (p.montant || 0), 0);
    const classeObj = await Classe.findOne({ nom: classe });

    if (classeObj) {
      await Classe.findByIdAndUpdate(classeObj._id, {
        revenuActuel: totalClasse,
        derniereMaj: new Date(),
      });
      console.log(
        `📊 IA-3 : Statistiques classe synchronisées → ${classe} (${totalClasse}$)`
      );
    }

    const seuilMontantInhabituel = 1000;
    if (montant > seuilMontantInhabituel) {
      await enregistrerActivite({
        type: "Alerte",
        nature: "Anomalie financière",
        details: `Montant inhabituel détecté : ${montant} USD – Élève ${eleveNom}`,
        montant,
        classeNom: classe,
        eleveNom,
        auteur: "Gabkut-Schola-IA-3",
      });

      console.log(
        `🚨 IA-3 : Montant suspect signalé — ${montant}$ (élève ${eleveNom})`
      );
    }

    console.log("✅ Synchronisation IA-3 terminée avec succès");
  } catch (err) {
    console.error("⚠️ Erreur synchronisation IA-3 :", err);
  }
}

/* ======================================================================
   🔍 ANALYSE FINANCIÈRE DÉTAILLÉE
====================================================================== */
async function analyserSituationEleve(eleveNom, classeNom, moisActuel) {
  try {
    const classeObj = await Classe.findOne({ nom: classeNom });
    const paiementsEleve = await Paiement.find({ eleveNom });
    const mensualite = classeObj?.mensualite || classeObj?.montantFrais || 0;

    const MOIS = [
      "Septembre", "Octobre", "Novembre", "Décembre",
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    ];

    const moisIndex = MOIS.indexOf(moisActuel);
    const moisPayes = paiementsEleve.map((p) => p.mois);

    const retards = MOIS.filter(
      (m) => !moisPayes.includes(m) && MOIS.indexOf(m) < moisIndex
    );

    const totalPaye = paiementsEleve.reduce((s, p) => s + (p.montant || 0), 0);
    const calcul = calculerFraisAttendus(mensualite);
    const ecart = totalPaye - calcul.totalAttendu;

    let conclusion = "";
    let tendance = "";
    let projection = "";

    if (retards.length === 0 && ecart >= 0) {
      conclusion = "Paiement complet et régulier, conformité au calendrier scolaire.";
      tendance = "positive";
      projection = "Aucune difficulté prévue pour la prochaine échéance.";
    } else if (retards.length === 0 && ecart < 0) {
      conclusion = "Léger retard dans le paiement actuel – à surveiller.";
      tendance = "fragile";
      projection = "Un risque de retard persiste si aucune régularisation n'est effectuée.";
    } else if (retards.length === 1 && ecart < 0) {
      conclusion = `Un mois en retard détecté (${retards[0]}) – situation partielle à régulariser.`;
      tendance = "négative";
      projection = "Probabilité élevée d'impayé si aucune intervention n'a lieu.";
    } else if (retards.length > 1) {
      conclusion = `Retards cumulés : ${retards.join(", ")} – Situation critique nécessitant un suivi administratif.`;
      tendance = "critique";
      projection = "Risque d'exclusion ou de blocage si aucune mesure immédiate n'est prise.";
    } else if (ecart > mensualite) {
      conclusion = "Paiement très avancé – discipline financière excellente.";
      tendance = "exceptionnelle";
      projection = "Aucune inquiétude prévue pour toute la durée scolaire si ce rythme continue.";
    } else {
      conclusion = "Paiement partiel – la régularisation est recommandée pour éviter l'accumulation.";
      tendance = ecart >= 0 ? "positive" : "négative";
      projection =
        ecart >= 0
          ? "La situation est stable pour le moment."
          : "Un soutien administratif peut être requis.";
    }

    let niveauRisque = "Faible";
    if (tendance === "fragile") niveauRisque = "Moyen";
    if (tendance === "négative") niveauRisque = "Élevé";
    if (tendance === "critique") niveauRisque = "Très élevé";

    let indiceStabilite = 100;
    indiceStabilite -= retards.length * 18;
    if (ecart < 0) indiceStabilite -= Math.min(Math.abs(ecart) / mensualite * 10, 30);
    if (indiceStabilite < 1) indiceStabilite = 1;

    const probaPaiementHeure = Math.max(0, Math.min(100, indiceStabilite + 5));
    const probaPaiementRetard = Math.max(0, 100 - probaPaiementHeure);

    return {
      eleveNom,
      classeNom,
      moisActuel,
      totalPaye,
      totalAttenduAjuste: calcul.totalAttendu,
      ecart: Number(ecart.toFixed(2)),
      mensualite,
      prorata: calcul.fraisProrata,
      retards,
      conclusion,
      tendance,
      projection,
      niveauRisque,
      indiceStabilite,
      probaPaiementHeure: Number(probaPaiementHeure.toFixed(2)),
      probaPaiementRetard: Number(probaPaiementRetard.toFixed(2)),
    };
  } catch (err) {
    console.error("⚠️ Erreur analyse IA-3 :", err);
    return null;
  }
}

/* ======================================================================
   📊 RAPPORT FINANCIER AUTOMATIQUE
====================================================================== */
async function genererEtEnvoyerRapportFinancier() {
  try {
    const maintenant = new Date();
    const dateLocale = maintenant.toLocaleDateString("fr-FR");
    const moisCourant = maintenant.toLocaleString("fr-FR", { month: "long" });

    const debutJour = new Date();
    debutJour.setHours(0, 0, 0, 0);
    const finJour = new Date();
    finJour.setHours(23, 59, 59, 999);

    const paiementsJour = await Paiement.find({
      datePaiement: { $gte: debutJour, $lte: finJour },
    }).sort({ datePaiement: 1 });

    const totalJour = paiementsJour.reduce((s, p) => s + (p.montant || 0), 0);

    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
    const finMois = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const paiementsMois = await Paiement.find({
      datePaiement: { $gte: debutMois, $lte: finMois },
    }).sort({ datePaiement: 1 });

    const totalMois = paiementsMois.reduce((s, p) => s + (p.montant || 0), 0);
    const moyennePaiement = paiementsMois.length
      ? Number((totalMois / paiementsMois.length).toFixed(2))
      : 0;

    let tendanceGlobale = "Stable";
    const moyenneHistorique = paiementsMois.length > 10 ? moyennePaiement * 0.95 : moyennePaiement;

    if (totalMois > moyenneHistorique * 1.1) tendanceGlobale = "En hausse 📈";
    else if (totalMois < moyenneHistorique * 0.9) tendanceGlobale = "En baisse 📉";

    const projectionMoisSuivant = (totalMois * 1.03).toFixed(2);

    const classes = await Classe.find({});
    const eleves = await Eleve.find({});
    const JOURS_OUVRABLES = 26;

    let attenduJourEcole = 0;
    let attenduMoisEcole = 0;
    let resumeClasses = "";

    const jourActuel = maintenant.getDate();
    const prorata = Math.min(jourActuel, JOURS_OUVRABLES) / JOURS_OUVRABLES;

    for (const cls of classes) {
      const mensualite = cls?.mensualite || cls?.montantFrais || 0;
      const nbElevesClasse = eleves.filter((e) => e.classe === cls.nom).length;
      if (!nbElevesClasse || !mensualite) continue;

      const attenduJourClasse = (mensualite / JOURS_OUVRABLES) * nbElevesClasse;
      const attenduMoisClasse = mensualite * prorata * nbElevesClasse;

      attenduJourEcole += attenduJourClasse;
      attenduMoisEcole += attenduMoisClasse;

      resumeClasses += `
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;">${cls.nom}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${nbElevesClasse}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${mensualite.toFixed(
            2
          )} USD</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${attenduJourClasse.toFixed(
            2
          )} USD</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${attenduMoisClasse.toFixed(
            2
          )} USD</td>
        </tr>
      `;
    }

    if (!resumeClasses) {
      resumeClasses = `
        <tr>
          <td colspan="5" style="padding:10px;border:1px solid #e5e7eb;text-align:center;color:#64748b;">
            Aucune donnée de classe disponible pour ce rapport.
          </td>
        </tr>
      `;
    }

    const ecartJour = (totalJour - attenduJourEcole) || 0;
    const ecartMois = (totalMois - attenduMoisEcole) || 0;

    const realisationJour = attenduJourEcole > 0 ? (totalJour / attenduJourEcole) * 100 : 0;
    const realisationMois = attenduMoisEcole > 0 ? (totalMois / attenduMoisEcole) * 100 : 0;

    let tendanceJour = "Stable";
    if (realisationJour >= 120) tendanceJour = "Très au-dessus des attentes 🚀";
    else if (realisationJour >= 100) tendanceJour = "Au-dessus des attentes ✅";
    else if (realisationJour >= 80) tendanceJour = "Proche de l'objectif 🤝";
    else if (realisationJour >= 50) tendanceJour = "Sous le niveau attendu ⚠️";
    else tendanceJour = "Risque de sous-réalisation 🟥";

    let tendanceMois = "Stable";
    if (realisationMois >= 120) tendanceMois = "Très au-dessus des attentes 🚀";
    else if (realisationMois >= 100) tendanceMois = "Au-dessus des attentes ✅";
    else if (realisationMois >= 80) tendanceMois = "Proche de l'objectif 🤝";
    else if (realisationMois >= 50) tendanceMois = "Sous le niveau attendu ⚠️";
    else tendanceMois = "Risque de sous-réalisation 🟥";

    const fileName = `Rapport-Financier-${moisCourant}-${maintenant.getFullYear()}.pdf`;
    const filePath = path.join(receiptsDir, fileName);
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    const bleuNuit = "#0f172a";
    const doré = "#d6b85f";

    doc.rect(0, 0, 595, 70).fill(bleuNuit);
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(15).text("Collège Le Mérite", 60, 22);
    doc.fontSize(10).text(ECOLE_CONFIG.slogan, 60, 42);
    if (fs.existsSync(ECOLE_CONFIG.logoPath)) doc.image(ECOLE_CONFIG.logoPath, 490, 15, { width: 60 });

    doc.moveTo(50, 90).lineTo(545, 90).strokeColor(doré).stroke();
    doc.moveDown(2);
    doc.font("Helvetica-Bold").fontSize(14).fillColor(bleuNuit).text(
      "RAPPORT FINANCIER AUTOMATIQUE – IA-3",
      { align: "center" }
    );

    doc.moveDown(1.5);
    doc.fontSize(11).fillColor(bleuNuit);
    doc.text(`📅 Date : ${dateLocale}`);
    doc.text(`🧮 Mois : ${moisCourant}`);
    doc.moveDown(0.5);
    doc.rect(50, doc.y, 495, 90).strokeColor("#e5e7eb").lineWidth(0.8).stroke();

    const y = doc.y + 8;
    doc.fontSize(10).fillColor("#0f172a");
    doc.text(`💰 Total du jour : ${totalJour.toFixed(2)} USD`, 60, y);
    doc.text(`📌 Attendu du jour : ${attenduJourEcole.toFixed(2)} USD`, 60, y + 14);
    doc.text(`⚖️ Écart du jour : ${ecartJour.toFixed(2)} USD`, 60, y + 28);
    doc.text(`🎯 Réalisation jour : ${realisationJour.toFixed(2)} %`, 60, y + 42);
    doc.text(`🤖 Tendance IA jour : ${tendanceJour}`, 60, y + 56);

    doc.text(`💳 Total du mois : ${totalMois.toFixed(2)} USD`, 320, y);
    doc.text(`📌 Attendu du mois : ${attenduMoisEcole.toFixed(2)} USD`, 320, y + 14);
    doc.text(`⚖️ Écart mois : ${ecartMois.toFixed(2)} USD`, 320, y + 28);
    doc.text(`🎯 Réalisation mois : ${realisationMois.toFixed(2)} %`, 320, y + 42);
    doc.text(`📈 Tendance globale : ${tendanceGlobale}`, 320, y + 56);

    doc.moveDown(7);
    doc.fontSize(10).text(
      `🔮 Projection prochaine période : ${projectionMoisSuivant} USD`,
      { align: "left" }
    );

    doc.moveDown(2);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(bleuNuit)
      .text("🧾 Paiements du jour", { underline: true });

    doc.moveDown(0.5);
    if (paiementsJour.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor("#475569")
        .text("Aucun paiement enregistré aujourd'hui.");
    } else {
      paiementsJour.forEach((p, idx) => {
        doc.font("Helvetica").fontSize(10).fillColor("#333")
          .text(`${idx + 1}. ${p.eleveNom} (${p.classe}) — ${p.montant} USD – ${p.mois} – ${p.statut}`);
      });
    }

    doc.moveDown(3);
    doc.fontSize(9).fillColor("#555")
      .text("Rapport généré automatiquement par Gabkut-Schola (IA-3)", { align: "center" })
      .text(ECOLE_CONFIG.signatureGabkut, { align: "center" })
      .text(ECOLE_CONFIG.marque, { align: "center" });

    doc.end();

    writeStream.on("finish", async () => {
      const attachment = [{ filename: fileName, path: filePath }];

      const corps = `
<p>Bonjour à toute l'équipe de direction,</p>
<p>
  Veuillez trouver ci-joint le <strong>rapport financier automatique</strong>
  du <strong>${dateLocale}</strong>, généré par le module IA-3 de
  <strong>Gabkut-Schola</strong>.
</p>

<h3 style="color:#0f172a;margin-top:20px;">📊 Synthèse Globale</h3>
<p>
  <strong>Total du jour :</strong> ${totalJour.toFixed(2)} USD<br/>
  <strong>Total attendu du jour :</strong> ${attenduJourEcole.toFixed(2)} USD<br/>
  <strong>Écart du jour :</strong> ${ecartJour.toFixed(2)} USD<br/>
  <strong>Taux de réalisation du jour :</strong> ${realisationJour.toFixed(2)} %<br/>
  <strong>Tendance IA (jour) :</strong> ${tendanceJour}
</p>

<p>
  <strong>Total du mois :</strong> ${totalMois.toFixed(2)} USD<br/>
  <strong>Total attendu du mois :</strong> ${attenduMoisEcole.toFixed(2)} USD<br/>
  <strong>Écart mensuel :</strong> ${ecartMois.toFixed(2)} USD<br/>
  <strong>Taux de réalisation mensuel :</strong> ${realisationMois.toFixed(2)} %<br/>
  <strong>Tendance IA (mois) :</strong> ${tendanceMois}<br/>
  <strong>Projection prochaine période :</strong> ${projectionMoisSuivant} USD
</p>

<h3 style="color:#0f172a;margin-top:30px;">📘 Détail par Classe</h3>
<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:14px;">
  <thead>
    <tr style="background:#0f172a;color:#fff;text-align:left;">
      <th style="padding:8px;border:1px solid #334155;">Classe</th>
      <th style="padding:8px;border:1px solid #334155;text-align:right;">Élèves</th>
      <th style="padding:8px;border:1px solid #334155;text-align:right;">Mensualité</th>
      <th style="padding:8px;border:1px solid #334155;text-align:right;">Attendu Jour</th>
      <th style="padding:8px;border:1px solid #334155;text-align:right;">Attendu Mois</th>
    </tr>
  </thead>
  <tbody>
    ${resumeClasses}
  </tbody>
</table>

<p style="margin-top:15px;font-style:italic;color:#555;">
  Ce rapport est généré automatiquement par le module IA-3 de Gabkut-Schola,
  propulsé par <strong>Gabkut Agency LMK</strong> / +243822783500.
</p>`;

      const destinataires = [
        ...ECOLE_CONFIG.emails,
        "kutalagael@gmail.com",
        "bannierebusiness@gmail.com",
        "gabkutpayrdc@gmail.com",
      ].filter(Boolean);

      await transporter.sendMail({
        from: `"Gabkut-Schola – IA-3 Automate" <${process.env.SMTP_USER || "admin@gabkut.com"}>`,
        to: destinataires.join(","),
        subject: `📊 Rapport Financier – ${dateLocale}`,
        html: `
          <div style="font-family:'Segoe UI',sans-serif;background:#f8fafc;padding:25px;">
            <div style="max-width:700px;margin:auto;background:#fff;border-radius:12px;
              border:1px solid #e5e7eb;box-shadow:0 4px 10px rgba(0,0,0,0.05)">
              <header style="background:#0f172a;color:#fff;padding:18px 25px;border-radius:12px 12px 0 0">
                <h2 style="margin:0;font-size:20px;">Rapport Financier Automatique – IA-3</h2>
              </header>
              <main style="padding:20px 25px;color:#0f172a;font-size:15px;line-height:1.7;">
                ${corps}
              </main>
              <footer style="background:#0f172a;color:#d6b85f;text-align:center;padding:12px;
                border-radius:0 0 12px 12px;font-size:13px;">
                © ${new Date().getFullYear()} Collège Le Mérite – Propulsé par Gabkut-Schola
              </footer>
            </div>
          </div>
        `,
        attachments: attachment,
      });

      console.log("📧 Rapport financier envoyé avec succès :", fileName);
    });

  } catch (err) {
    console.error("❌ Erreur lors de la génération du rapport financier :", err);
  }
}

/* ======================================================================
   📧 EMAIL DE CONTACT
====================================================================== */
async function envoyerEmailContact(data) {
  const { nom, email, telephone, sujet, message } = data;

  const sujetEmail = `Nouveau message de contact : ${sujet}`;
  const contenu = `
<h2>Nouveau message reçu via le site Collège Le Mérite</h2>
<p><strong>Nom :</strong> ${nom}</p>
<p><strong>Email :</strong> ${email}</p>
<p><strong>Téléphone :</strong> ${telephone || "Non renseigné"}</p>
<p><strong>Sujet :</strong> ${sujet}</p>
<h3>Message :</h3>
<p>${message}</p>
<br>
<p style="color:gray;">Notification automatique — Gabkut Agency LMK +243 822 783 500, votre partenaire digital</p>`;

  await transporter.sendMail({
    from: `"Site Collège Le Mérite" <${process.env.SMTP_USER}>`,
    to: ECOLE_CONFIG.emails,
    subject: sujetEmail,
    html: contenu,
  });
}

module.exports = {
  ECOLE_CONFIG,
  SCHOOL_INFO,
  calculerFraisAttendus,
  envoyerEmailsIntelligents,
  synchroniserIA3,
  analyserSituationEleve,
  genererEtEnvoyerRapportFinancier,
  envoyerEmailContact,
};
