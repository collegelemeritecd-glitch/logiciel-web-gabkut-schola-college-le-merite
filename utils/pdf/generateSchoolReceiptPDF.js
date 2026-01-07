// ======================================================================
// 📘 GABKUT-SCHOLA – Générateur PDF Professionnel (Style Gabkut Pay)
// ======================================================================

const fs = require("fs");
const path = require("path");
const PdfPrinter = require("pdfmake");
const QRCode = require("qrcode");

// ======================================================================
// 📌 Polices officielles (Tinos)
// ======================================================================
const fonts = {
  Tinos: {
    normal: path.join(__dirname, "../fonts/tinos/Tinos-Regular.ttf"),
    bold: path.join(__dirname, "../fonts/tinos/Tinos-Bold.ttf"),
    italics: path.join(__dirname, "../fonts/tinos/Tinos-Italic.ttf"),
    bolditalics: path.join(__dirname, "../fonts/tinos/Tinos-BoldItalic.ttf"),
  },
};

const printer = new PdfPrinter(fonts);

// ======================================================================
// 📌 Informations Officielles École
// ======================================================================
const SCHOOL_INFO = {
  nom: "Collège Le Mérite",
  slogan: "Discipline – Travail – Excellence",
  ville: "Lubumbashi",
  commune: "Kampemba",
  quartier: "Bel-Air",
  avenue: "Frangipanier",
  numero: "27",
  telephones: ["+243970008546", "+243822783500"],
  emails: [
    "gabkutpayrdc@gmail.com",
    "bannierebusiness@gmail.com",
    "secretariat@collegelemerite.cd",
    "kutalagael@gmail.com",
  ],
  siteWeb: "www.collegelemerite.cd",
  signatureGabkut:
    "© Gabkut Agency LMK — Signature électronique vérifiée / +243822783500",
  marque: "Gabkut-Schola – propulsé par Gabkut Agency LMK",
  logo: path.join(__dirname, "../assets/logo.jpg"),
};

// ======================================================================
// 🔵 Génération du PDF Professionnel
// ======================================================================
async function generateSchoolReceiptPDF(paiement, reference) {
  try {
    // QR code dynamique
    const qrData = await QRCode.toDataURL(
      `http://localhost:9090/api/verif/${reference}`
    );

    const outputDir = path.join(__dirname, "../receipts");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    const filePath = path.join(outputDir, `Recu-${reference}.pdf`);

    // ===========================
    // 📄 DOCUMENT DEFINITION
    // ===========================
    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 80],

      defaultStyle: {
        font: "Tinos",
        fontSize: 11,
        lineHeight: 1.25,
      },

      // ===========================
      // HEADER
      // ===========================
      header: {
        margin: [40, 20, 40, 0],
        columns: [
          [
            {
              text: SCHOOL_INFO.nom,
              fontSize: 20,
              bold: true,
              color: "#0f172a",
            },
            {
              text: SCHOOL_INFO.slogan,
              fontSize: 10,
              margin: [0, -2],
            },
          ],
          {
            image: SCHOOL_INFO.logo,
            fit: [70, 70],
            alignment: "right",
          },
        ],
      },

      // ===========================
      // FOOTER
      // ===========================
      footer: () => ({
        margin: [40, 10, 40, 0],
        stack: [
          {
            canvas: [
              {
                type: "line",
                x1: 0,
                y1: 0,
                x2: 515,
                y2: 0,
                lineWidth: 1,
                color: "#4154e3ff",
              },
            ],
          },
          {
            text:
              `Ce document est généré électroniquement et authentifié par Gabkut-Schola.\n` +
              `${SCHOOL_INFO.signatureGabkut}\n${SCHOOL_INFO.marque}`,
            alignment: "center",
            fontSize: 9,
            margin: [0, 5, 0, 0],
          },
        ],
      }),

      // ================================================================
      // CONTENU PRINCIPAL
      // ================================================================
      content: [
        // TITRE
        {
          text: "REÇU OFFICIEL DE PAIEMENT",
          alignment: "center",
          fontSize: 15,
          bold: true,
          color: "#1e3a8a",
          margin: [0, 10, 0, 25],
        },

        // TABLEAU PRINCIPAL
        {
          table: {
            widths: ["35%", "65%"],
            body: [
              ["Référence", reference],
              ["Élève", paiement.eleveNom],
              ["Classe", paiement.classe],
              ["Mois", paiement.mois],
              ["Montant", `${paiement.montant.toFixed(2)} USD`],
              ["Mode de paiement", paiement.modePaiement || "Cash"],
              [
                "Date",
                new Date(paiement.datePaiement).toLocaleDateString("fr-FR"),
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 25],
        },

        // ===========================
        // 👨‍👩‍👦 INFORMATIONS PARENTALES
        // ===========================
        {
          text: "INFORMATIONS PARENTALES / TUTEUR",
          fontSize: 12,
          bold: true,
          margin: [0, 15, 0, 8],
          color: "#0f172a",
        },
        {
          table: {
            widths: ["35%", "65%"],
            body: [
              ["Parent / Tuteur", paiement.parentNom || "—"],
              ["Contact parent", paiement.parentContact || "—"],
              ["Email parent", paiement.emailParent || "—"],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 20],
        },

        // ===========================
        // 👨‍💼 INFORMATIONS PERCEPTEUR
        // ===========================
        {
          text: "INFORMATIONS DU PERCEPTEUR",
          fontSize: 12,
          bold: true,
          margin: [0, 10, 0, 8],
          color: "#0f172a",
        },
        {
          table: {
            widths: ["35%", "65%"],
            body: [
              ["Nom", paiement.percepteurNom || "—"],
              ["Email", paiement.emailPercepteur || "—"],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 25],
        },

        // ===========================
        // 🧠 NOTE IA
        // ===========================
        {
          text: paiement.noteIA || "Analyse IA : Paiement enregistré.",
          italics: true,
          color: "#2563eb",
          margin: [0, 10, 0, 25],
        },

        // ===========================
        // 📅 Lieu + Date officielle
        // ===========================
        {
          text: `Fait à ${SCHOOL_INFO.ville}, le ${new Date().toLocaleDateString(
            "fr-FR"
          )}`,
          alignment: "left",
          italics: true,
          color: "#0f172a",
          margin: [0, 10, 0, 20],
        },

        // ===========================
        // ✍️ SIGNATURE + QR
        // ===========================
        {
          columns: [
            {
              width: "*",
              stack: [
                { text: "Signature du percepteur", margin: [0, 0, 0, 8] },
                paiement.signaturePath
                  ? { image: paiement.signaturePath, fit: [120, 70] }
                  : { text: "—", italics: true },
              ],
            },
            {
              width: "auto",
              stack: [
                {
                  text: "QR Code de vérification",
                  alignment: "center",
                  margin: [0, 0, 0, 5],
                },
                { image: qrData, width: 100, alignment: "center" },
              ],
            },
          ],
        },
      ],
    };

    // ================================================================
    // 🎯 EXPORT PDF
    // ================================================================
    return await new Promise((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const stream = fs.createWriteStream(filePath);

      pdfDoc.pipe(stream);
      pdfDoc.end();

      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    });
  } catch (err) {
    console.error("❌ Erreur génération PDF :", err);
    throw err;
  }
}

module.exports = { generateSchoolReceiptPDF };
