/* =============================================================================================
 💎 BEAUTY JOURNAL EXPORTS PRO MAX — Gabkut-École 2026
 Formats générés : CSV • Excel Dashboard • PDF PRO MAX • Word PRO MAX • ZIP
 Contenu : Page de garde • KPI • Tableau du jour • Tableau Attendu vs Payé • Graphiques • Conclusion
 Style : Administratif — Bleu #0f172a — Or #facc15 — Professionnel paysage
 Signature électronique : powered by Gabkut
============================================================================================= */

const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  TextRun,
} = require("docx");

const exportDir = path.join(__dirname, "../..", "temp-exports");
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

const COLOR_PRIMARY = "#0f172a"; // bleu
const COLOR_ACCENT = "#facc15";  // or

// =====================================================
// 🔥 CALCUL PRORATA
// =====================================================
function calculerProrata(mensualite, datePaiement) {
  const d = new Date(datePaiement);
  const mois = d.getMonth() + 1; // 1–12
  const jour = d.getDate();

  // mois complet pour février mais prorata basé sur 28 ou 29 jours
  if (mois === 2) {
    const joursFev = new Date(d.getFullYear(), 2, 0).getDate(); // 28 ou 29
    return mensualite * (jour / joursFev);
  }

  return mensualite * (Math.min(jour, 26) / 26);
}

// =====================================================
// 🔥 FONCTION PRINCIPALE
// =====================================================
module.exports = async function beautyJournalExports(data, kpi, dateTxt, res, type = "zip") {
  try {
    if (!data || !data.length) return res.status(400).send("Aucune donnée.");

    // =====================================================================
    // 1️⃣ CSV
    // =====================================================================
    const csvPath = path.join(exportDir, "rapport_journalier.csv");
    const csvHeader = Object.keys(data[0]).join(";") + "\n";
    const csvBody = data.map(r => Object.values(r).join(";")).join("\n");
    fs.writeFileSync(csvPath, csvHeader + csvBody);

    // =====================================================================
    // 2️⃣ EXCEL (3 feuilles)
    // =====================================================================
    const xlsxPath = path.join(exportDir, "rapport_journalier.xlsx");
    const wb = new ExcelJS.Workbook();

    // PAGE 1 — GARDE
    const cover = wb.addWorksheet("Page de garde");
    cover.addRow(["📘 COLLÈGE LE MÉRITE — DIRECTION FINANCIÈRE"]);
    cover.getRow(1).font = { size: 26, bold: true, color: { argb: "FF0F172A" } };
    cover.addRow([`Rapport journalier du ${dateTxt}`]).font = { size: 14 };
    cover.addRow([" "]);
    cover.addRow([`Total reçu : ${kpi.total} USD`]);
    cover.addRow([`Nombre paiements : ${kpi.nb}`]);
    cover.addRow([`Classe dominante : ${kpi.classe}`]);
    cover.addRow([`Heure la plus active : ${kpi.heure}h`]);
    cover.addRow([" "]);
    cover.addRow(["by Gabkut Agency LMK  +243822783500"]);
    cover.addRow(["Signature électronique : powered by Gabkut"]);

    // PAGE 2 — Tableau journal complet
    const sh2 = wb.addWorksheet("Paiements du jour");
    sh2.addRow(Object.keys(data[0]));
    data.forEach(r => sh2.addRow(Object.values(r)));
    sh2.columns.forEach(c => c.width = 22);

    // PAGE 3 — Attendu vs payé
    const sh3 = wb.addWorksheet("Attendu vs Payé");
    sh3.addRow(["Élève", "Classe", "Attendu", "Payé", "Solde", "Statut", "Recommandation"]);
    data.forEach(p => {
      sh3.addRow([
        p.nom,
        p.classe,
        p.attenduTotal.toFixed(2),
        p.payeTotal.toFixed(2),
        p.solde.toFixed(2),
        p.statut,
        p.recommandation,
      ]);
    });

    await wb.xlsx.writeFile(xlsxPath);

    // =====================================================================
    // 3️⃣ PDF PRO MAX PAYSAGE
    // =====================================================================
    const pdfPath = path.join(exportDir, "rapport_journalier.pdf");
    const pdf = new PDFDocument({ layout: "landscape", margin: 35 });
    const pdfStream = fs.createWriteStream(pdfPath);
    pdf.pipe(pdfStream);

    // 🔹 Page garde
    pdf.fillColor(COLOR_PRIMARY).fontSize(28).text("📘 COLLÈGE LE MÉRITE — DIRECTION FINANCIÈRE", { align: "center" });
    pdf.moveDown();
    pdf.fontSize(16).fillColor("#000").text(`Rapport journalier — ${dateTxt}`, { align: "center" });
    pdf.moveDown(2);
    pdf.fontSize(12).fillColor("#000")
      .text(`Total reçu : ${kpi.total} USD  —  Paiements : ${kpi.nb}  —  Classe du jour : ${kpi.classe}  —  Pic : ${kpi.heure}h`, { align: "center" });
    pdf.moveDown(2);
    pdf.fontSize(10).fillColor(COLOR_PRIMARY).text("by Gabkut Agency LMK  +243822783500", { align: "center" });
    pdf.moveDown();
    pdf.fontSize(10).fillColor(COLOR_PRIMARY).text("Signature électronique : powered by Gabkut", { align: "center" });

    // Nouvelle page — Tableau Attendu vs Payé
    pdf.addPage();
    pdf.fontSize(18).fillColor(COLOR_PRIMARY).text("📊 Attendu vs Payé — Rapport comparatif", { align: "center" });
    pdf.moveDown();
    data.forEach(r => {
      pdf.fontSize(10).fillColor("#000")
        .text(`${r.nom} | ${r.classe} | Attendu: ${r.attenduTotal} | Payé: ${r.payeTotal} | Solde: ${r.solde} | ${r.statut} | ${r.recommandation}`);
      pdf.moveDown(0.22);
    });

    pdf.end();
    await new Promise(resolve => pdfStream.on("finish", resolve));

    // =====================================================================
    // 4️⃣ WORD PAYSAGE
    // =====================================================================
    const docxPath = path.join(exportDir, "rapport_journalier.docx");

    const tableRows = data.map(p =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(p.nom)] }),
          new TableCell({ children: [new Paragraph(p.classe)] }),
          new TableCell({ children: [new Paragraph(p.attenduTotal.toFixed(2))] }),
          new TableCell({ children: [new Paragraph(p.payeTotal.toFixed(2))] }),
          new TableCell({ children: [new Paragraph(p.solde.toFixed(2))] }),
          new TableCell({ children: [new Paragraph(p.statut)] }),
          new TableCell({ children: [new Paragraph(p.recommandation)] }),
        ]
      })
    );

    const doc = new Document({
      sections: [{
        properties: { page: { size: { orientation: "landscape" } } },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `📘 COLLÈGE LE MÉRITE — Rapport journalier ${dateTxt}`, bold: true, size: 36 })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["Élève", "Classe", "Attendu", "Payé", "Solde", "Statut", "Recommandation"].map(h =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })] })],
                    shading: { fill: "0F172A" }
                  })
                )
              }),
              ...tableRows
            ]
          }),
          new Paragraph(""),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Signature électronique : powered by Gabkut", italics: true })]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Signature & cachet de l’école : ______________________________", bold: true })]
          })
        ]
      }]
    });

    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(docxPath, buf);

    // =====================================================================
    // 5️⃣ ZIP FINAL
    // =====================================================================
    if (type === "zip") {
      const archive = archiver("zip");
      res.setHeader("Content-Disposition", `attachment; filename="Rapport_Journalier_${dateTxt}.zip"`);
      archive.pipe(res);
      archive.file(csvPath, { name: csvPath.split("\\").pop() });
      archive.file(xlsxPath, { name: xlsxPath.split("\\").pop() });
      archive.file(pdfPath, { name: pdfPath.split("\\").pop() });
      archive.file(docxPath, { name: docxPath.split("\\").pop() });
      return archive.finalize();
    }

    // Téléchargement simple
    const map = { csv: csvPath, xlsx: xlsxPath, pdf: pdfPath, docx: docxPath };
    return res.download(map[type]);

  } catch (e) {
    console.error("💥 beautyJournalExports ERROR :", e);
    return res.status(500).send("Erreur export journal.");
  }
};
