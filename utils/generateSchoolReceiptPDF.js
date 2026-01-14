/* ======================================================================
PDF RECU PROFESSIONNEL — Collège Le Mérite
A4 Portrait, espacé correctement, lisible et pro
====================================================================== */

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

/* ======================================================================
INFOS ÉCOLE
====================================================================== */

const SCHOOL_INFO = {
  nom: "Collège Le Mérite",
  slogan: "Connaissance - Rigueur - Reussite",
  ville: "Kinshasa",
  province: "Kinshasa",
  pays: "République Démocratique du Congo (RDC)",
  telephones: ["+243 82 278 3500", "+243 97 777 7777"],
  emails: ["collegelemerite.cd@gmail.com"],
  website: "https://collegelemerite.school",
  logo: null,
};

/* ======================================================================
COULEURS PROFESSIONNELLES
====================================================================== */

const COLORS = {
  primary: "#059669",
  secondary: "#1e3a8a",
  accent: "#f59e0b",
  text: "#111827",
  lightText: "#6b7280",
  border: "#e5e7eb",
  success: "#10b981",
  background: "#f9fafb",
};

/* ======================================================================
DOSSIER DES REÇUS
====================================================================== */

const RECEIPTS_DIR = path.join(__dirname, "../receipts");
if (!fs.existsSync(RECEIPTS_DIR)) {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

/* ======================================================================
GÉNÉRER QR CODE
====================================================================== */

async function generateQRCode(text) {
  try {
    const qrPath = path.join(RECEIPTS_DIR, `qr-${Date.now()}.png`);
    await QRCode.toFile(qrPath, text, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 100,
      margin: 1,
      color: {
        dark: COLORS.primary,
        light: COLORS.background,
      },
    });
    return qrPath;
  } catch (err) {
    console.warn("QR Code non disponible");
    return null;
  }
}

/* ======================================================================
GÉNÉRATION PDF (A4 PORTRAIT, BIEN ESPACÉ)
====================================================================== */

async function generateSchoolReceiptPDF(paiementPourPDF, reference) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!reference) {
        return reject(new Error("Référence manquante"));
      }

      const filename = `Recu-${reference}.pdf`;
      const pdfPath = path.join(RECEIPTS_DIR, filename);

      // A4 PORTRAIT (par défaut)
      const doc = new PDFDocument({
        size: "A4",
        margin: 30,
        bufferPages: true,
      });

      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      const datePaiement = paiementPourPDF.datePaiement
        ? new Date(paiementPourPDF.datePaiement)
        : new Date();

      /* ========== EN-TÊTE ÉCOLE ========== */
      doc
        .fillColor(COLORS.primary)
        .font("Helvetica-Bold")
        .fontSize(20)
        .text(SCHOOL_INFO.nom, { align: "center" });

      doc
        .fillColor(COLORS.lightText)
        .font("Helvetica-Oblique")
        .fontSize(10)
        .text(SCHOOL_INFO.slogan, { align: "center" });

      doc
        .moveTo(30, doc.y + 5)
        .lineTo(565, doc.y + 5)
        .strokeColor(COLORS.primary)
        .lineWidth(2)
        .stroke();

      doc.moveDown(2);

      /* ========== BADGE REÇU ========== */
      doc
        .rect(30, doc.y, 535, 25)
        .fillColor(COLORS.success)
        .fill();

      doc
        .fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(13)
        .text("RECU DE PAIEMENT CONFIRME", 30, doc.y + 5, { width: 535, align: "center" });

      doc.moveDown(2);

      /* ========== RÉFÉRENCE ET INFOS DATE ========== */
      doc
        .fillColor(COLORS.lightText)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Reference de transaction");

      doc
        .fillColor(COLORS.accent)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(reference);

      doc.moveDown(0.8);

      doc
        .fillColor(COLORS.lightText)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Date et heure");

      doc
        .fillColor(COLORS.text)
        .font("Helvetica")
        .fontSize(10)
        .text(
          `${datePaiement.toLocaleDateString("fr-FR")} a ${datePaiement.toLocaleTimeString("fr-FR")}`
        );

      doc.moveDown(2);

      /* ========== LIGNE SÉPARATRICE ========== */
      doc
        .moveTo(30, doc.y)
        .lineTo(565, doc.y)
        .strokeColor(COLORS.border)
        .lineWidth(1)
        .stroke();

      doc.moveDown(1.5);

      /* ========== SECTION ÉLÈVE ========== */
      doc
        .fillColor(COLORS.secondary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("INFORMATIONS DE L'ELEVE");

      doc.moveDown(0.7);

      drawInfoLine(
        doc,
        "Nom complet:",
        paiementPourPDF.eleveNom || "-"
      );

      drawInfoLine(
        doc,
        "Classe:",
        paiementPourPDF.classeNom || "-"
      );

      drawInfoLine(
        doc,
        "Annee scolaire:",
        paiementPourPDF.anneeScolaire ||
          paiementPourPDF.anneeConcernee ||
          "-"
      );

      doc.moveDown(1.5);

      /* ========== LIGNE SÉPARATRICE ========== */
      doc
        .moveTo(30, doc.y)
        .lineTo(565, doc.y)
        .strokeColor(COLORS.border)
        .lineWidth(1)
        .stroke();

      doc.moveDown(1.5);

      /* ========== TABLEAU PAIEMENT ========== */
      doc
        .fillColor(COLORS.primary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("DETAILS DE PAIEMENT");

      doc.moveDown(0.7);

      drawPaymentTable(doc, paiementPourPDF);

      doc.moveDown(1.5);

      /* ========== LIGNE SÉPARATRICE ========== */
      doc
        .moveTo(30, doc.y)
        .lineTo(565, doc.y)
        .strokeColor(COLORS.border)
        .lineWidth(1)
        .stroke();

      doc.moveDown(1.5);

      /* ========== SECTION PARENT ========== */
      doc
        .fillColor(COLORS.secondary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("PARENT / TUTEUR");

      doc.moveDown(0.7);

      drawInfoLine(
        doc,
        "Nom:",
        paiementPourPDF.parentNom || "-"
      );

      drawInfoLine(
        doc,
        "Contact:",
        paiementPourPDF.parentContact ||
          paiementPourPDF.telephoneParent ||
          "-"
      );

      drawInfoLine(
        doc,
        "Email:",
        paiementPourPDF.emailParent || "-"
      );

      doc.moveDown(1.5);

      /* ========== QR CODE ========== */
      const qrText = `${reference}|${paiementPourPDF.eleveNom}|${paiementPourPDF.montant}`;
      const qrPath = await generateQRCode(qrText);

      if (qrPath && fs.existsSync(qrPath)) {
        doc
          .fillColor(COLORS.lightText)
          .font("Helvetica-Oblique")
          .fontSize(8)
          .text("Scanner pour verifier ce recu", { align: "center" });

        doc.moveDown(0.4);

        doc.image(qrPath, 240, doc.y, { width: 80, align: "center" });
        doc.moveDown(2.8);

        setTimeout(() => {
          if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
        }, 500);
      }

      /* ========== SIGNATURES ========== */
      doc
        .moveTo(30, doc.y)
        .lineTo(565, doc.y)
        .strokeColor(COLORS.border)
        .lineWidth(1)
        .stroke();

      doc.moveDown(1);

      const sigY = doc.y;

      doc
        .fillColor(COLORS.lightText)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Signature du percepteur", 45, sigY);

      doc
        .moveTo(45, sigY + 28)
        .lineTo(180, sigY + 28)
        .strokeColor(COLORS.border)
        .lineWidth(1)
        .stroke();

      doc
        .fillColor(COLORS.lightText)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Signature du parent/tuteur", 350, sigY);

      doc
        .moveTo(350, sigY + 28)
        .lineTo(485, sigY + 28)
        .strokeColor(COLORS.border)
        .lineWidth(1)
        .stroke();

      doc.moveDown(2.5);

      /* ========== NOTE LÉGALE ========== */
      doc
        .moveTo(30, doc.y)
        .lineTo(565, doc.y)
        .strokeColor(COLORS.border)
        .lineWidth(1)
        .stroke();

      doc.moveDown(0.8);

      doc
        .fillColor(COLORS.lightText)
        .font("Helvetica-Oblique")
        .fontSize(8)
        .text(
          paiementPourPDF.noteIA ||
            "Ce recu confirme le paiement effectue. Pour toute reclamation ou question, contactez l'administration du college.",
          { width: 505, align: "justify" }
        );

      /* ========== PIED DE PAGE ========== */
      doc.moveDown(1);

      doc
        .moveTo(30, doc.y)
        .lineTo(565, doc.y)
        .strokeColor(COLORS.border)
        .lineWidth(1)
        .stroke();

      doc.moveDown(0.6);

      doc
        .fillColor(COLORS.primary)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(SCHOOL_INFO.nom, { align: "center" });

      doc
        .fillColor(COLORS.lightText)
        .font("Helvetica")
        .fontSize(8)
        .text(
          `${SCHOOL_INFO.ville} - ${SCHOOL_INFO.province} - ${SCHOOL_INFO.pays}`,
          { align: "center" }
        );

      doc.text(`Tel: ${SCHOOL_INFO.telephones[0]}`, {
        align: "center",
      });

      doc.text(`Email: ${SCHOOL_INFO.emails[0]}`, {
        align: "center",
      });

      doc.text(`Web: ${SCHOOL_INFO.website}`, {
        align: "center",
      });

      doc
        .font("Helvetica-Oblique")
        .fontSize(7)
        .fillColor("#999999")
        .text(
          "Gabkut-Schola | Gabkut Agency | +243 822 783 500",
          { align: "center" }
        );

      /* ========== FIN ========== */
      doc.end();

      writeStream.on("finish", () => {
        console.log("PDF cree:", pdfPath);
        resolve(pdfPath);
      });

      writeStream.on("error", (err) => {
        console.error("Erreur ecriture PDF:", err);
        reject(err);
      });

      doc.on("error", (err) => {
        console.error("Erreur document:", err);
        reject(err);
      });
    } catch (err) {
      console.error("Erreur generation PDF:", err);
      reject(err);
    }
  });
}

/* ======================================================================
FONCTIONS AUXILIAIRES
====================================================================== */

function drawInfoLine(doc, label, value) {
  doc
    .fillColor(COLORS.lightText)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(label, { continued: true });

  doc
    .fillColor(COLORS.text)
    .font("Helvetica")
    .fontSize(9)
    .text(` ${value}`);

  doc.moveDown(0.5);
}

function drawPaymentTable(doc, paiement) {
  const colWidth = 160;
  const col1X = 40;
  const col2X = 200;
  const col3X = 380;

  // En-tête du tableau
  doc
    .fillColor(COLORS.secondary)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("Libelle", col1X, doc.y);

  doc.text("Valeur", col2X, doc.y - 9);
  doc.text("Statut", col3X, doc.y - 9);

  doc.moveDown(0.8);

  // Ligne 1: Montant
  doc
    .fillColor(COLORS.text)
    .font("Helvetica")
    .fontSize(9)
    .text("Montant paye", col1X, doc.y);

  doc.text(
    `${(paiement.montant || 0).toFixed(2)} USD`,
    col2X,
    doc.y - 9
  );

  doc
    .fillColor(COLORS.success)
    .font("Helvetica-Bold")
    .text("Recu", col3X, doc.y - 9);

  doc.moveDown(0.8);

  // Ligne 2: Mois
  doc
    .fillColor(COLORS.text)
    .font("Helvetica")
    .fontSize(9)
    .text("Mois", col1X, doc.y);

  doc.text(paiement.mois || "-", col2X, doc.y - 9);

  doc
    .fillColor(COLORS.success)
    .font("Helvetica-Bold")
    .text("OK", col3X, doc.y - 9);

  doc.moveDown(0.8);

  // Ligne 3: Mode de paiement
  doc
    .fillColor(COLORS.text)
    .font("Helvetica")
    .fontSize(9)
    .text("Mode", col1X, doc.y);

  doc.text(
    paiement.modePaiement || paiement.moyenPaiement || "Cash",
    col2X,
    doc.y - 9
  );

  doc
    .fillColor(COLORS.success)
    .font("Helvetica-Bold")
    .text("OK", col3X, doc.y - 9);

  doc.moveDown(0.8);
}

/* ======================================================================
EXPORTS
====================================================================== */

module.exports = {
  generateSchoolReceiptPDF,
  SCHOOL_INFO,
};
