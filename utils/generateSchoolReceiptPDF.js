/* ======================================================================
📘 GÉNÉRATION DES REÇUS PDF – Collège Le Mérite
Version PRO MAX 2026 — CORRECTION FINALE
====================================================================== */

const fs = require("fs");
const path = require("path");
const PdfPrinter = require("pdfmake");
const QRCode = require("qrcode");

/* ======================================================================
🔤 POLICES OFFICIELLES (Tinos — Gabkut-Schola)
====================================================================== */

function getFontsPath() {
  const paths = [
    path.join(__dirname, "../fonts"),
    path.join(process.cwd(), "netlify/fonts"),
    path.join(__dirname, "../../fonts"),
  ];

  for (const p of paths) {
    const tinosPath = path.join(p, "tinos", "Tinos-Regular.ttf");
    if (fs.existsSync(tinosPath)) {
      console.log("✅ Polices trouvées:", p);
      return p;
    }
  }

  console.warn("⚠️ Polices Tinos non trouvées, utilisation polices système");
  return null;
}

const fontsPath = getFontsPath();
const fonts = fontsPath
  ? {
      Tinos: {
        normal: path.join(fontsPath, "tinos", "Tinos-Regular.ttf"),
        bold: path.join(fontsPath, "tinos", "Tinos-Bold.ttf"),
        italics: path.join(fontsPath, "tinos", "Tinos-Italic.ttf"),
        bolditalics: path.join(fontsPath, "tinos", "Tinos-BoldItalic.ttf"),
      },
    }
  : {
      Roboto: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
    };

const printer = new PdfPrinter(fonts);
const defaultFont = fontsPath ? "Tinos" : "Roboto";

console.log(`📝 Police PDF: ${defaultFont}`);

/* ======================================================================
🏫 INFORMATIONS OFFICIELLES ÉCOLE
====================================================================== */

const SCHOOL_INFO = {
  nom: "Collège Le Mérite",
  slogan: "Discipline – Travail – Excellence",
  ville: "Lubumbashi",
  commune: "Kampemba",
  quartier: "Bel-Air",
  avenue: "Frangipanier",
  numero: "27",
  telephones: ["+243970008546", "+243829607488"],
  emails: ["collegelemerite5@gmail.com", "gabkutpayrdc@gmail.com"],
  siteWeb: "www.collegelemerite.cd",
  signatureGabkut: "© Gabkut Agency LMK — Signature électronique vérifiée / +243822783500",
  marque: "Gabkut-Schola – propulsé par Gabkut Agency LMK",
  siteAgence: "www.gabkut.com",
  logo: path.join(__dirname, "../assets/logo.jpg"),
};

/* ======================================================================
🔥 GÉNÉRATION DU PDF (CORRECTION FINALE)
====================================================================== */

async function generateSchoolReceiptPDF(paiement, reference) {
  try {
    console.log("📄 Génération PDF pour:", reference);

    // 🔗 QR Code du reçu
    const qrData = await QRCode.toDataURL(
      `https://collegelemerite.school/verif/${reference}`
    );

    const fileName = `Recu-${reference}.pdf`;
    
    // ✅ CORRECTION: Utiliser un seul chemin principal absolu
    const receiptsDir = path.join(__dirname, "..", "receipts");
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(receiptsDir)) {
      console.log("📁 Création dossier receipts:", receiptsDir);
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const pdfPath = path.join(receiptsDir, fileName);

    /* ------------------------------------------------------------------
    🧾 CONTENU PDF (IDENTIQUE À TON CODE ACTUEL)
    ------------------------------------------------------------------ */

    const dd = {
      pageSize: "A4",
      pageMargins: [32, 65, 32, 65],
      defaultStyle: {
        font: defaultFont,
        fontSize: 10.5,
        lineHeight: 1.18,
      },
      header: (currentPage, pageCount) => ({
        margin: [40, 12, 40, 8],
        columns: [
          {
            width: "*",
            stack: [
              {
                text: SCHOOL_INFO.nom,
                fontSize: 18,
                bold: true,
                color: "#0f172a",
              },
              {
                text: SCHOOL_INFO.slogan,
                fontSize: 8.5,
                color: "#475569",
                margin: [0, 1, 0, 0],
              },
            ],
          },
          {
            width: "auto",
            stack: fs.existsSync(SCHOOL_INFO.logo)
              ? [{ image: SCHOOL_INFO.logo, width: 60, alignment: "right" }]
              : [{ text: "🏫", fontSize: 32, alignment: "right" }],
          },
        ],
      }),
      footer: (currentPage, pageCount) => ({
        margin: [32, 3, 32, 8],
        stack: [
          {
            canvas: [
              {
                type: "line",
                x1: 0,
                y1: 0,
                x2: 535,
                y2: 0,
                lineWidth: 0.5,
                color: "#cbd5e1",
              },
            ],
          },
          {
            text: `${SCHOOL_INFO.avenue} n°${SCHOOL_INFO.numero}, ${SCHOOL_INFO.quartier} · ${SCHOOL_INFO.ville} · ${SCHOOL_INFO.telephones[0]}`,
            alignment: "center",
            fontSize: 7,
            margin: [0, 2, 0, 1],
            color: "#475569",
          },
          {
            text: `Email: ${SCHOOL_INFO.emails[0]} · ${SCHOOL_INFO.siteWeb}`,
            alignment: "center",
            fontSize: 7,
            margin: [0, 0, 0, 1],
            color: "#475569",
          },
          {
            text: `${SCHOOL_INFO.marque} · ${SCHOOL_INFO.signatureGabkut}`,
            alignment: "center",
            fontSize: 6,
            margin: [0, 0, 0, 0],
            color: "#64748b",
          },
        ],
      }),
      content: [
        {
          text: "REÇU OFFICIEL DE PAIEMENT",
          alignment: "center",
          fontSize: 14,
          bold: true,
          color: "#1e3a8a",
          margin: [0, 0, 0, 14],
        },

        // BLOC PRINCIPAL - Infos paiement
        {
          table: {
            widths: ["32%", "68%"],
            body: [
              [
                { text: "Référence", bold: true },
                { text: reference, bold: true, color: "#dc2626" },
              ],
              ["Élève", paiement.eleveNom || "—"],
              ["Classe", paiement.classe || "—"],
              ["Mois", paiement.mois || "—"],
              [
                "Montant",
                {
                  text: `${(paiement.montant || 0).toFixed(2)} USD`,
                  bold: true,
                  color: "#16a34a",
                  fontSize: 11,
                },
              ],
              ["Mode de paiement", paiement.modePaiement || "Cash"],
              [
                "Date",
                new Date(paiement.datePaiement || new Date()).toLocaleDateString("fr-FR"),
              ],
              [
                "Année scolaire",
                paiement.anneeScolaire || "2025-2026",
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 15],
        },

        // BLOC 2 - Infos Parent/Tuteur
        {
          text: "INFORMATIONS PARENTALES / TUTEUR",
          fontSize: 11,
          bold: true,
          color: "#1e3a8a",
          margin: [0, 8, 0, 5],
        },
        {
          table: {
            widths: ["32%", "68%"],
            body: [
              ["Nom parent / tuteur", paiement.parentNom || "—"],
              ["Contact parent", paiement.parentContact || "—"],
              ["Lieu de paiement", paiement.lieuPaiement || "Bureau principal"],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 14],
        },

        // BLOC 3 - Infos Percepteur
        {
          text: "INFORMATIONS DU PERCEPTEUR",
          fontSize: 11,
          bold: true,
          color: "#1e3a8a",
          margin: [0, 8, 0, 5],
        },
        {
          table: {
            widths: ["32%", "68%"],
            body: [
              ["Nom du percepteur", paiement.percepteurNom || "—"],
              ["Contact", paiement.percepteurContact || "—"],
              ["Statut", "Agent agréé Collège Le Mérite"],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 14],
        },

        // NOTE ADMINISTRATIVE
        {
          text:
            paiement.noteAdministrative ||
            paiement.noteIA ||
            "✓ Paiement enregistré avec succès dans le système.",
          italics: true,
          color: "#2563eb",
          fontSize: 9.5,
          margin: [0, 5, 0, 8],
        },

        // Date de signature
        {
          text: `Fait à ${SCHOOL_INFO.ville}, le ${new Date().toLocaleDateString("fr-FR")}`,
          alignment: "left",
          italics: true,
          fontSize: 9.5,
          margin: [0, 4, 0, 8],
        },

        // Signature & QR Code
        {
          columns: [
            {
              width: "*",
              stack: [
                { text: "Signature du percepteur", fontSize: 9, margin: [0, 0, 0, 4] },
                paiement.signaturePath && fs.existsSync(paiement.signaturePath)
                  ? { image: paiement.signaturePath, width: 120 }
                  : { text: "_____________________", italics: true, color: "#cbd5e1" },
              ],
            },
            {
              width: "auto",
              stack: [
                {
                  text: "QR Code",
                  alignment: "center",
                  fontSize: 8,
                  margin: [0, 0, 0, 3],
                },
                { image: qrData, width: 75, alignment: "center" },
              ],
            },
          ],
          margin: [0, 0, 0, 0],
        },
      ],
    };

    /* ------------------------------------------------------------------
    🖨️ EXPORT PDF AVEC VÉRIFICATION FINALE
    ------------------------------------------------------------------ */

    return await new Promise((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(dd);
      const writeStream = fs.createWriteStream(pdfPath);

      pdfDoc.pipe(writeStream);
      pdfDoc.end();

      writeStream.on("finish", () => {
        // ✅ VÉRIFICATION QUE LE FICHIER EXISTE VRAIMENT
        if (fs.existsSync(pdfPath)) {
          console.log("✅ PDF créé et vérifié:", pdfPath);
          resolve(pdfPath);
        } else {
          console.error("❌ PDF introuvable après écriture:", pdfPath);
          reject(new Error(`PDF généré mais introuvable: ${pdfPath}`));
        }
      });

      writeStream.on("error", (err) => {
        console.error("❌ Erreur écriture PDF:", err);
        reject(err);
      });

      // Timeout de sécurité (15 secondes)
      setTimeout(() => {
        if (!fs.existsSync(pdfPath)) {
          reject(new Error(`Timeout génération PDF: ${pdfPath}`));
        }
      }, 15000);
    });
  } catch (err) {
    console.error("❌ Erreur génération PDF:", err);
    throw err;
  }
}

/* ======================================================================
🧾 EXPORTS
====================================================================== */

module.exports = {
  generateSchoolReceiptPDF,
  SCHOOL_INFO,
};
