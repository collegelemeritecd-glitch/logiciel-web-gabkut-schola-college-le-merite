/* ======================================================================
   📘 GÉNÉRATION PDF RELEVÉ DE PAIEMENT – Collège Le Mérite
   Version Gabkut-Schola 2026 — Compatible Email + QR Code
====================================================================== */

const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');
const QRCode = require('qrcode');

/* ======================================================================
   🔤 POLICES (fallback si Tinos absent)
====================================================================== */
const fontsPath = path.join(__dirname, '../fonts/tinos');
const useTinos = fs.existsSync(fontsPath);

const fonts = useTinos
  ? {
      Tinos: {
        normal: path.join(fontsPath, 'Tinos-Regular.ttf'),
        bold: path.join(fontsPath, 'Tinos-Bold.ttf'),
        italics: path.join(fontsPath, 'Tinos-Italic.ttf'),
        bolditalics: path.join(fontsPath, 'Tinos-BoldItalic.ttf'),
      },
    }
  : {
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };

const printer = new PdfPrinter(fonts);

/* ======================================================================
   🏫 INFORMATIONS OFFICIELLES ÉCOLE
====================================================================== */
const SCHOOL_INFO = {
  nom: 'Collège Le Mérite',
  slogan: 'Discipline – Travail – Excellence',
  ville: 'Kinshasa',
  commune: 'Kampemba',
  quartier: 'Bel-Air',
  avenue: 'Frangipanier',
  numero: '27',
  telephones: ['+243 970 008 546', '+243 829 607 488'],
  emails: ['collegelemerite5@gmail.com', 'contact@gabkut-schola.com'],
  siteWeb: 'www.collegelemerite.cd',
  signatureGabkut: '© Gabkut Agency LMK — +243 822 783 500',
  marque: 'Gabkut-Schola – propulsé par Gabkut Agency LMK',
};

/* ======================================================================
   🔥 GÉNÉRATION DU PDF
====================================================================== */
async function generatePaymentPDF(student, paiements, attendu) {
  try {
    // 🔗 QR Code (données élève)
    const qrData = await QRCode.toDataURL(
      JSON.stringify({
        nom: `${student.prenom} ${student.nom}`,
        classe: student.classe?.nom || 'N/A',
        matricule: student.matricule || 'N/A',
        solde: attendu.montantAnnuel - paiements.reduce((s, p) => s + (p.montantPaye || p.montant || 0), 0),
      })
    );

    const montantPaye = paiements.reduce((sum, p) => sum + (p.montantPaye || p.montant || 0), 0);
    const solde = attendu.montantAnnuel - montantPaye;

    /* ------------------------------------------------------------------
       🧾 CONTENU PDF
    ------------------------------------------------------------------ */
    const dd = {
      pageSize: 'A4',
      pageMargins: [40, 70, 40, 100],
      defaultStyle: {
        font: useTinos ? 'Tinos' : 'Roboto',
        fontSize: 10,
        lineHeight: 1.3,
      },

      // ========== HEADER ==========
      header: {
        margin: [40, 20, 40, 10],
        columns: [
          {
            stack: [
              {
                text: SCHOOL_INFO.nom,
                fontSize: 18,
                bold: true,
                color: '#1e3a8a',
              },
              {
                text: SCHOOL_INFO.slogan,
                fontSize: 9,
                italics: true,
                color: '#64748b',
                margin: [0, 2, 0, 0],
              },
            ],
          },
          {
            text: '🎓',
            fontSize: 40,
            alignment: 'right',
            margin: [0, -10, 0, 0],
          },
        ],
      },

      // ========== FOOTER ==========
      footer: (currentPage, pageCount) => ({
        margin: [40, 10, 40, 20],
        stack: [
          {
            canvas: [
              {
                type: 'line',
                x1: 0,
                y1: 0,
                x2: 515,
                y2: 0,
                lineWidth: 1.5,
                color: '#4154e3',
              },
            ],
          },
          {
            text: [
              { text: '📍 ', bold: true },
              `${SCHOOL_INFO.avenue} n°${SCHOOL_INFO.numero}, ${SCHOOL_INFO.quartier}, ${SCHOOL_INFO.commune}, ${SCHOOL_INFO.ville}`,
            ],
            alignment: 'center',
            fontSize: 8,
            margin: [0, 6, 0, 2],
          },
          {
            text: `☎ ${SCHOOL_INFO.telephones.join(' / ')}   ·   ✉ ${SCHOOL_INFO.emails[0]}   ·   🌍 ${SCHOOL_INFO.siteWeb}`,
            alignment: 'center',
            fontSize: 8,
            margin: [0, 0, 0, 6],
          },
          {
            text: `${SCHOOL_INFO.signatureGabkut}\n${SCHOOL_INFO.marque}`,
            alignment: 'center',
            fontSize: 7,
            color: '#64748b',
            margin: [0, 3, 0, 3],
          },
          {
            text: `Page ${currentPage} / ${pageCount}`,
            alignment: 'center',
            fontSize: 7,
            margin: [0, 2, 0, 0],
          },
        ],
      }),

      // ========== CONTENU ==========
      content: [
        // Titre principal
        {
          text: 'RELEVÉ DE PAIEMENT',
          alignment: 'center',
          fontSize: 16,
          bold: true,
          color: '#1e3a8a',
          margin: [0, 10, 0, 25],
        },

        // Section élève
        {
          text: 'INFORMATIONS ÉLÈVE',
          fontSize: 12,
          bold: true,
          color: '#0f172a',
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            widths: ['35%', '65%'],
            body: [
              ['Nom complet', `${student.prenom} ${student.nom}`],
              ['Classe', student.classe?.nom || 'N/A'],
              ['Matricule', student.matricule || 'N/A'],
              ['Année scolaire', student.anneeScolaire || '2025-2026'],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#e2e8f0',
            paddingLeft: () => 12,
            paddingRight: () => 12,
            paddingTop: () => 8,
            paddingBottom: () => 8,
          },
          margin: [0, 0, 0, 20],
        },

        // Résumé financier
        {
          text: 'RÉSUMÉ FINANCIER',
          fontSize: 12,
          bold: true,
          color: '#0f172a',
          margin: [0, 10, 0, 8],
        },
        {
          table: {
            widths: ['50%', '50%'],
            body: [
              [
                { text: 'Montant annuel attendu', bold: true },
                { text: `${attendu.montantAnnuel.toFixed(2)} USD`, alignment: 'right' },
              ],
              [
                { text: 'Total payé', bold: true, color: '#16a34a' },
                { text: `${montantPaye.toFixed(2)} USD`, alignment: 'right', color: '#16a34a' },
              ],
              [
                { text: 'Solde restant', bold: true, color: solde > 0 ? '#dc2626' : '#16a34a' },
                {
                  text: `${solde.toFixed(2)} USD`,
                  alignment: 'right',
                  bold: true,
                  fontSize: 12,
                  color: solde > 0 ? '#dc2626' : '#16a34a',
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#e2e8f0',
            paddingLeft: () => 12,
            paddingRight: () => 12,
            paddingTop: () => 8,
            paddingBottom: () => 8,
          },
          margin: [0, 0, 0, 25],
        },

        // Historique des paiements
        paiements.length > 0
          ? {
              text: 'HISTORIQUE DES PAIEMENTS',
              fontSize: 12,
              bold: true,
              color: '#0f172a',
              margin: [0, 10, 0, 8],
            }
          : {},
        paiements.length > 0
          ? {
              table: {
                widths: ['25%', '30%', '25%', '20%'],
                headerRows: 1,
                body: [
                  [
                    { text: 'Date', bold: true, fillColor: '#f1f5f9' },
                    { text: 'Type', bold: true, fillColor: '#f1f5f9' },
                    { text: 'Montant', bold: true, fillColor: '#f1f5f9', alignment: 'right' },
                    { text: 'Statut', bold: true, fillColor: '#f1f5f9' },
                  ],
                  ...paiements.map((p) => [
                    new Date(p.datePaiement || p.dateEcheance).toLocaleDateString('fr-FR'),
                    (p.typeFrais || 'Frais scolaires').substring(0, 25),
                    { text: `${(p.montantPaye || p.montant || 0).toFixed(2)} USD`, alignment: 'right' },
                    p.statut || 'Payé',
                  ]),
                ],
              },
              layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0,
                hLineColor: () => '#e2e8f0',
                paddingLeft: () => 10,
                paddingRight: () => 10,
                paddingTop: () => 6,
                paddingBottom: () => 6,
              },
              margin: [0, 0, 0, 25],
            }
          : {
              text: 'Aucun paiement enregistré pour cette année scolaire.',
              italics: true,
              color: '#64748b',
              alignment: 'center',
              margin: [0, 10, 0, 25],
            },

        // Bas de page avec QR
        {
          columns: [
            {
              width: '*',
              stack: [
                {
                  text: `Fait à ${SCHOOL_INFO.ville}, le ${new Date().toLocaleDateString('fr-FR')}`,
                  italics: true,
                  fontSize: 9,
                  margin: [0, 20, 0, 0],
                },
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'QR Code de vérification', alignment: 'center', fontSize: 8, margin: [0, 0, 0, 5] },
                { image: qrData, width: 80, alignment: 'center' },
              ],
            },
          ],
        },
      ],
    };

    /* ------------------------------------------------------------------
       🖨️ EXPORT PDF EN BUFFER
    ------------------------------------------------------------------ */
    return new Promise((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(dd);
      const chunks = [];

      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);

      pdfDoc.end();
    });
  } catch (err) {
    console.error('❌ Erreur génération PDF:', err);
    throw err;
  }
}

module.exports = { generatePaymentPDF, SCHOOL_INFO };
