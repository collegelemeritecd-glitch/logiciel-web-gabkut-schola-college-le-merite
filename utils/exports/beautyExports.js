/* ============================================================================================
 💎 BEAUTY EXPORTS PRO MAX — Gabkut-Schola 2026
 Formats générés : CSV • Excel Dashboard • PDF PRO MAX • Word PRO MAX • ZIP
 Contenu : Page de garde • Tableau filtré • Graphiques PNG • Conclusion IA • Double signature
 Style : Administratif — Fond blanc — Bleu scolaire + Or
============================================================================================ */

const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} = require("docx");

const generateCharts = require("./generateCharts");
const financeConclusionIA = require("./financeConclusionIA");

/* 🎨 Couleurs officielles */
const COLOR_PRIMARY = "#0f172a";  // bleu scolaire
const COLOR_ACCENT = "#d4af37";   // or

/* 📁 Dossier temporaire */
const exportDir = path.join(__dirname, "../../temp-exports");
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

module.exports = async function beautyExports(rows, type, res) {
  try {
    if (!rows || rows.length === 0) {
      return res.status(400).send("Aucune donnée à exporter.");
    }

    /* =========================================================================
       1) Graphiques PNG
    ========================================================================= */
    const { camembertPath, histogramPath } = await generateCharts(rows);

    /* =========================================================================
       2) CSV
    ========================================================================= */
    const csvPath = path.join(exportDir, "paiements.csv");
    const header = Object.keys(rows[0]).join(";") + "\n";
    const body = rows.map(r => Object.values(r).join(";")).join("\n");
    fs.writeFileSync(csvPath, header + body);

    /* =========================================================================
       3) EXCEL — Page de garde + Dashboard + IA
    ========================================================================= */
    const xlsxPath = path.join(exportDir, "paiements.xlsx");
    const workbook = new ExcelJS.Workbook();

    // PAGE DE GARDE — Fond blanc administratif
    const cover = workbook.addWorksheet("Page de garde");
    cover.addRow(["📘 COLLÈGE LE MÉRITE"]);
    cover.getRow(1).font = { size: 32, bold: true, color: { argb: "FF0F172A" } };
    cover.addRow(["DIRECTION FINANCIÈRE — Rapport des paiements scolaires"]).font = { size: 18 };
    cover.addRow(["Année académique 2025"]).font = { size: 14 };
    cover.addRow([]);
    cover.addRow(["Unité — Discipline — Excellence"]).font = { bold: true, size: 16 };
    cover.addRow([]);
    cover.addRow(["Directeur Financier : ____________________"]);
    cover.addRow(["Préfet des Études : ____________________"]);
    cover.addRow([]);
    cover.addRow(["Powered by Gabkut-Schola — Gabkut-École — Gabkut Agency LMK — +243 822 783 500"]);

    // TABLEAU
    const sheet1 = workbook.addWorksheet("Tableau paiements");
    sheet1.addRow(Object.keys(rows[0]));
    sheet1.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet1.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    rows.forEach(r => sheet1.addRow(Object.values(r)));
    sheet1.columns.forEach(col => (col.width = 24));

    // DASHBOARD & GRAPHIQUES
    const sheet2 = workbook.addWorksheet("Dashboard financier");
    sheet2.addImage(workbook.addImage({ filename: camembertPath, extension: "png" }),
      { tl: { col: 0, row: 0 }, ext: { width: 640, height: 380 } });
    sheet2.addImage(workbook.addImage({ filename: histogramPath, extension: "png" }),
      { tl: { col: 10, row: 0 }, ext: { width: 640, height: 380 } });

    // ANALYSE IA
    const sheet3 = workbook.addWorksheet("Analyse IA");
    sheet3.addRow(["📌 Analyse IA des paiements"]).font = { bold: true, size: 16 };
    sheet3.addRow([]);
    sheet3.addRow([financeConclusionIA(rows)]);

    await workbook.xlsx.writeFile(xlsxPath);

    /* =========================================================================
       4) PDF PRO MAX — 5 Pages
    ========================================================================= */
    /* =========================================================================
   4) PDF PRO MAX — 5 Pages (corrigé avec stream.on("finish"))
========================================================================= */
/* =========================================================================
   4) PDF PRO MAX — 5 Pages (VERSION CORRIGÉE 2026)
========================================================================= */
const pdfPath = path.join(exportDir, "paiements.pdf");

await new Promise((resolve, reject) => {
  try {
    const stream = fs.createWriteStream(pdfPath);
    const pdf = new PDFDocument({
      margin: 50,
      size: "A4"
    });

    pdf.pipe(stream);

    /* ================================
       PAGE 1 : PAGE DE GARDE
    ================================= */
    pdf.fillColor(COLOR_PRIMARY)
      .fontSize(26)
      .text("COLLÈGE LE MÉRITE", { align: "center" });

    pdf.moveDown();
    pdf.fillColor("#000")
      .fontSize(18)
      .text("Direction Financière — Rapport des paiements scolaires", {
        align: "center"
      });

    pdf.moveDown(2);
    pdf.fontSize(14).fillColor("#444")
      .text("Année académique 2025-2026", { align: "center" });

    pdf.moveDown(4);
    pdf.fillColor(COLOR_PRIMARY).fontSize(14)
      .text("Unité — Discipline — Excellence", { align: "center" });

    /* ================================
       PAGE 2 : TABLEAU PROFESSIONNEL
    ================================= */
    pdf.addPage();
    pdf.fontSize(20).fillColor(COLOR_PRIMARY)
      .text("Tableau des paiements filtrés", { align: "center" });
    pdf.moveDown(1.5);

    // colonnes définies
    const columns = [
      "Élève", "Classe", "Mois", "Montant",
      "Mode", "Référence", "Percepteur",
      "Parent", "Date"
    ];

    const colWidths = [90, 80, 60, 60, 60, 120, 80, 80, 70];

    // header
    pdf.fontSize(10).fillColor("#FFF");
    pdf.rect(pdf.x, pdf.y, pdf.page.width - 100, 20)
      .fill(COLOR_PRIMARY);
    pdf.fillColor("#FFF");

    let x = pdf.x + 2;
    columns.forEach((c, idx) => {
      pdf.text(c, x, pdf.y + 5, { width: colWidths[idx], align: "left" });
      x += colWidths[idx];
    });

    pdf.moveDown();
    pdf.fillColor("#000");

    // rows
    rows.forEach(r => {
      let xx = pdf.x + 2;
      const line = [
        r.eleve, r.classe, r.mois,
        r.montant + " $", r.mode,
        r.reference,
        r.percepteur,
        r.parent,
        r.date
      ];
      line.forEach((cell, idx) => {
        pdf.text(String(cell), xx, pdf.y + 5, {
          width: colWidths[idx],
          align: "left"
        });
        xx += colWidths[idx];
      });
      pdf.moveDown();
    });

    /* ================================
       PAGE 3 : GRAPH CAMEMBERT
    ================================= */
    pdf.addPage();
    pdf.fontSize(18).fillColor(COLOR_PRIMARY)
      .text("Répartition des paiements par classe", { align: "center" });
    pdf.moveDown(1);

    pdf.image(camembertPath, {
      fit: [480, 380],
      align: "center",
      valign: "center"
    });

    /* ================================
       PAGE 4 : HISTOGRAMME
    ================================= */
    pdf.addPage();
    pdf.fontSize(18).fillColor(COLOR_PRIMARY)
      .text("Paiements mensuels — Histogramme", { align: "center" });
    pdf.moveDown(1);

    pdf.image(histogramPath, {
      fit: [480, 380],
      align: "center",
      valign: "center"
    });

    /* ================================
       PAGE 5 : ANALYSE IA + SIGNATURES
    ================================= */
    pdf.addPage();
    pdf.fontSize(20).fillColor(COLOR_PRIMARY)
      .text("Analyse & Conclusion Financière", { align: "center" });

    pdf.moveDown(2);
    pdf.fontSize(12).fillColor("#000")
      .text(financeConclusionIA(rows), {
        align: "left"
      });

    pdf.moveDown(3);
    pdf.fontSize(14).fillColor(COLOR_PRIMARY)
      .text("Unité — Discipline — Excellence", { align: "center" });

    pdf.moveDown(3);
    pdf.fillColor("#000").fontSize(12)
      .text("Directeur Financier", { continued: true })
      .text("                     Préfet des Études");

    pdf.moveDown(1.5);
    pdf.text("Signature : ____________________", { continued: true })
       .text("          Signature : ____________________");

    pdf.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  } catch (err) {
    reject(err);
  }
});


    /* =========================================================================
       5) WORD — Paysage — Conclusion — Signatures — Branding
    ========================================================================= */
   /* =========================================================================
   5) WORD — Version PRO MAX 2026
========================================================================= */
const docxPath = path.join(exportDir, "paiements.docx");

const headerStyle = {
  bold: true,
  size: 32,
  color: "0F172A",
};

const tableHeaderRow = new TableRow({
  children: Object.keys(rows[0]).map(k =>
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: k.toUpperCase(), bold: true, color: "FFFFFF" })]
      })],
      shading: { fill: "0F172A" }
    })
  )
});

const tableBody = rows.map(r =>
  new TableRow({
    children: Object.values(r).map(val =>
      new TableCell({
        children: [new Paragraph(String(val))]
      })
    )
  })
);

const doc = new Document({
  sections: [{
    properties: { page: { size: { orientation: "landscape" } } },
    children: [
      new Paragraph({
        children: [new TextRun({ text: "COLLÈGE LE MÉRITE — Rapport financier complet", ...headerStyle })],
        alignment: AlignmentType.CENTER
      }),

      new Table({
        rows: [tableHeaderRow, ...tableBody],
        width: { size: 100, type: WidthType.PERCENTAGE }
      }),

      new Paragraph({ text: " " }),
      new Paragraph({
        children: [new TextRun({ text: financeConclusionIA(rows) })]
      }),

      new Paragraph({ text: " " }),

      new Paragraph({
        children: [new TextRun({
          text: "Unité — Discipline — Excellence",
          bold: true, size: 28, color: "0F172A"
        })],
        alignment: AlignmentType.CENTER
      }),

      new Paragraph({ text: " " }),

      new Paragraph({
        children: [new TextRun({
          text: "Directeur Financier — Préfet des Études",
          size: 22
        })],
        alignment: AlignmentType.CENTER
      }),

      new Paragraph({
        children: [new TextRun({
          text: "Signature : ____________________      Signature : ____________________",
          size: 20
        })],
        alignment: AlignmentType.CENTER
      }),

      new Paragraph({
        children: [new TextRun({
          text: "Powered by Gabkut-Schola — Gabkut-École — Gabkut Agency LMK • +243 822 783 500",
          italics: true, color: "0F172A"
        })],
        alignment: AlignmentType.CENTER
      })
    ]
  }]
});

const bufferW = await Packer.toBuffer(doc);
fs.writeFileSync(docxPath, bufferW);


    /* =========================================================================
       7) Téléchargement individuel
    ========================================================================= */
 /* =========================================================================
   6) ZIP — si demandé
 ========================================================================== */
if (type === "zip") {
  const archive = archiver("zip");
  res.setHeader("Content-Disposition", "attachment; filename=exports-financiers.zip");
  archive.pipe(res);
  archive.file(csvPath, { name: "paiements.csv" });
  archive.file(xlsxPath, { name: "paiements.xlsx" });
  archive.file(pdfPath, { name: "paiements.pdf" });
  archive.file(docxPath, { name: "paiements.docx" });
  return archive.finalize();
}

/* =========================================================================
   7) Téléchargement individuel
 ========================================================================== */
const map = {
  csv: csvPath,
  xlsx: xlsxPath,
  pdf: pdfPath,
  docx: docxPath
};

if (!map[type]) {
  console.error("❌ Type d’export inconnu :", type);
  return res.status(400).send("Type d’export inconnu.");
}

return res.download(map[type]);


  } catch (e) {
    console.error("💥 beautyExports ERROR :", e);
    return res.status(500).send("Erreur export.");
  }
};
