/* ========================================================================================
 💎 BEAUTY JOURNAL EXPORTS — Gabkut-École (PDF + Word + Excel + CSV + ZIP)
 Format : A4 paysage — Page de garde + KPI + Paiements du jour + Attendu vs Payé + Conclusion
 Style : Administratif — USD — Logo en haut à gauche
======================================================================================== */

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
} = require("docx");

/* 📁 Dossier temporaire */
const exportDir = path.join(__dirname, "../../temp-journal-exports");
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

/* 📌 Mois scolaires fixes */
const MOIS = [
  "Septembre","Octobre","Novembre","Décembre",
  "Janvier","Février","Mars","Avril","Mai","Juin"
];

/* 🎯 Fonction prorata */
function attenduMois(mensualite, moisIndex, jourDuMois, dateAnalyse) {
  const d = new Date(dateAnalyse);
  if (MOIS[moisIndex] === "Février") {
    const jours = d.getFullYear() % 4 === 0 ? 29 : 28;
    return (mensualite / jours) * jourDuMois;
  }
  const moisCourantIndex = d.getMonth() - 8; // 0 = septembre
  if (moisIndex === moisCourantIndex) {
    return (mensualite / 26) * jourDuMois;
  }
  return mensualite;
}

/* 🔎 Statut & reco */
function getStatut(solde, attendu, mensualite) {
  if (solde <= 0) return { s: "À jour", r: "Félicitations, continuez" };
  if (solde < mensualite / 3) return { s: "En retard", r: "Rappel SMS recommandé" };
  if (solde < mensualite * 2 / 3) return { s: "Risque", r: "Suivi rapproché obligatoire" };
  return { s: "Critique", r: "Appeler le parent — Plan d'urgence" };
}

/* ========================================================================================
   EXPORT PRINCIPAL
======================================================================================== */
module.exports = async function beautyJournalExports(rowsJour, rowsFull, classes, date, res, type) {
  try {
    if (!rowsJour.length) return res.status(400).send("Aucune donnée disponible");

    const base = `Rapport_Gabkut_Ecole_${date}`;
    const jourDuMois = new Date(date).getDate();

    /* ===================== Table 2 — Attendu vs Payé ===================== */
    const grouped = {};
    rowsFull.forEach(p => {
      const infoClasse = classes.find(c => c.nom === p.classe);
      if (!grouped[p.eleveNom]) {
        grouped[p.eleveNom] = {
          nom: p.eleveNom,
          classe: p.classe,
          cycle: infoClasse?.niveau || "—",
          mensualite: infoClasse?.mensualite || 0,
          paiements: {},
          payeTotal: 0
        };
      }
      const idx = MOIS.indexOf(p.mois);
      grouped[p.eleveNom].paiements[idx] = (grouped[p.eleveNom].paiements[idx] || 0) + Number(p.montant || 0);
      grouped[p.eleveNom].payeTotal += Number(p.montant || 0);
    });

    const tableau2 = [];
    for (const nom in grouped) {
      const row = grouped[nom];
      let attendu = 0;
      for (let i = 0; i <= MOIS.indexOf(MOIS[new Date(date).getMonth() - 8]); i++) {
        attendu += attenduMois(row.mensualite, i, jourDuMois, date);
      }
      const solde = attendu - row.payeTotal;
      const status = getStatut(solde, attendu, row.mensualite);
      tableau2.push({
        nom,
        classe: row.classe,
        cycle: row.cycle,
        attendu: attendu.toFixed(2),
        paye: row.payeTotal.toFixed(2),
        solde: solde.toFixed(2),
        statut: status.s,
        reco: status.r
      });
    }

    /* ===================== CSV ===================== */
    const csvPath = path.join(exportDir, base + ".csv");
    fs.writeFileSync(
      csvPath,
      "Élève;Classe;Montant;Date;Référence\n" +
      rowsJour.map(r =>
        `${r.eleveNom};${r.classe};${r.montant};${new Date(r.datePaiement).toLocaleDateString("fr-FR")};${r.reference}`
      ).join("\n")
    );

    /* ===================== EXCEL BEAUTY ===================== */
    const xlsxPath = path.join(exportDir, base + ".xlsx");
    const wb = new ExcelJS.Workbook();

    const cover = wb.addWorksheet("PAGE DE GARDE");
    cover.mergeCells("A1:H3");
    cover.getCell("A1").value = `📘 COLLÈGE LE MÉRITE — DIRECTION FINANCIÈRE`;
    cover.getCell("A1").font = { size: 24, bold: true, color: { argb: "FF0F172A" } };
    cover.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    cover.addRow([`RAPPORT JOURNALIER — ${date}`]).font = { size: 18, bold: true };

    const s1 = wb.addWorksheet("📋 Paiements du jour");
    s1.addRow(["Élève", "Classe", "Montant", "Date", "Référence"]).font = { bold: true };
    rowsJour.forEach(r => s1.addRow([r.eleveNom, r.classe, r.montant, new Date(r.datePaiement).toLocaleDateString("fr-FR"), r.reference]));
    s1.columns.forEach(c => c.width = 19);
    s1.eachRow((row, idx) => {
      if (idx === 1) row.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" }, color: { argb: "FFFFFFFF" } });
      else row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 ? "FFFFFFFF" : "FFF1F5F9" } };
      row.eachCell(c => c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } });
    });

    const s2 = wb.addWorksheet("📊 Attendu vs Payé");
    s2.addRow(["Élève","Classe",...MOIS,"Attendu total","Payé total","Solde","Statut","Reco"]).font = { bold: true };
    tableau2.forEach(t => s2.addRow([ t.nom, t.classe, ...MOIS.map((m, i) => grouped[t.nom].paiements[i] || 0), t.attendu, t.paye, t.solde, t.statut, t.reco ]));
    s2.columns.forEach(c => c.width = 14);
    s2.eachRow((row, idx) => {
      if (idx === 1) row.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" }, color: { argb: "FFFFFFFF" } });
      else row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 ? "FFFFFFFF" : "FFF1F5F9" } };
      row.eachCell(c => c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } });
    });

    await wb.xlsx.writeFile(xlsxPath);

    /* ===================== PDF ===================== */
    const pdfPath = path.join(exportDir, base + ".pdf");
    await new Promise((resolve, reject) => {
      const pdf = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
      const stream = fs.createWriteStream(pdfPath);
      pdf.pipe(stream);

      const logoPath = path.join(__dirname, "../../uploads/logo-ecole.png");
      if (fs.existsSync(logoPath)) pdf.image(logoPath, 35, 20, { width: 95 });

      pdf.fontSize(25).fillColor("#0f172a").text("📘 COLLÈGE LE MÉRITE — DIRECTION FINANCIÈRE", { align: "center" });
      pdf.fontSize(9).text("by Gabkut Agency LMK · +243822783500", { align: "center" });
      pdf.moveDown().fontSize(17).fillColor("#1e3a8a").text(`RAPPORT JOURNALIER — ${date}`, { align: "center" });

      const totalJour = rowsJour.reduce((s, x) => s + (x.montant || 0), 0);
      pdf.moveDown();
      pdf.fontSize(12).fillColor("#000").text(`Total reçu : ${totalJour.toFixed(2)} USD`);

      pdf.addPage({ layout: "landscape" });
      pdf.fontSize(18).text("📋 Paiements du jour", { align: "center" });
      pdf.moveDown();
      rowsJour.forEach(r => pdf.fontSize(9).text(`${r.eleveNom} | ${r.classe} | ${r.montant}$ | ${new Date(r.datePaiement).toLocaleDateString("fr-FR")} | ${r.reference}`));

      pdf.addPage({ layout: "landscape" });
      pdf.fontSize(18).text("📊 Attendu vs Payé", { align: "center" });
      pdf.moveDown();
      tableau2.forEach(r => pdf.fontSize(9).text(`${r.nom} | ${r.classe} | Attendu:${r.attendu} | Payé:${r.paye} | Solde:${r.solde} | ${r.statut} | ${r.reco}`));

      pdf.addPage({ layout: "landscape" });
      pdf.fontSize(13).text(`Conclusion : La journée a généré ${totalJour.toFixed(2)} USD.`, { align: "center" });
      pdf.moveDown(2);
      pdf.fontSize(14).text("Signature automatique : powered by Gabkut ✓", { align: "right" });
      pdf.fontSize(11).text("Signature manuscrite école : ________________________________", { align: "right" });

      pdf.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    /* ===================== WORD ===================== */
    const docxRows = tableau2.map(t =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(t.nom)] }),
          new TableCell({ children: [new Paragraph(t.classe)] }),
          new TableCell({ children: [new Paragraph(t.attendu)] }),
          new TableCell({ children: [new Paragraph(t.paye)] }),
          new TableCell({ children: [new Paragraph(t.solde)] }),
          new TableCell({ children: [new Paragraph(t.statut)] }),
          new TableCell({ children: [new Paragraph(t.reco)] })
        ]
      })
    );
    const docx = new Document({
      sections: [{
        properties: { page: { size: { orientation: "landscape" } } },
        children: [
          new Paragraph({ text: `📅 Rapport journalier — ${date}`, alignment: AlignmentType.CENTER }),
          new Table({
            rows: [
              new TableRow({
                children: ["Élève","Classe","Attendu","Payé","Solde","Statut","Reco"]
                  .map(x => new TableCell({ children: [new Paragraph(x)] }))
              }),
              ...docxRows
            ]
          })
        ]
      }]
    });
    const docxPath = path.join(exportDir, base + ".docx");
    fs.writeFileSync(docxPath, await Packer.toBuffer(docx));

    /* ===================== ZIP ===================== */
    if (type === "zip") {
      const archive = archiver("zip");
      res.setHeader("Content-Disposition", `attachment; filename=${base}.zip`);
      archive.pipe(res);
      archive.file(csvPath, { name: base + ".csv" });
      archive.file(xlsxPath, { name: base + ".xlsx" });
      archive.file(pdfPath, { name: base + ".pdf" });
      archive.file(docxPath, { name: base + ".docx" });
      return archive.finalize();
    }

    /* ===================== Téléchargement d’un seul fichier ===================== */
    const fileMap = { csv: csvPath, xlsx: xlsxPath, pdf: pdfPath, docx: docxPath };
    return res.download(fileMap[type]);

  } catch (e) {
    console.error("💥 beautyJournalExports ERROR :", e);
    return res.status(500).send("Erreur export journalier.");
  }
};
