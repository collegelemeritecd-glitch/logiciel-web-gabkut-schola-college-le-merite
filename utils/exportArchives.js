const Archive = require("../models/Archive");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");

module.exports = async function exportArchives(type, res) {
  try {
    const rows = await Archive.find().lean();

    if (type === "pdf") {
      const doc = new PDFDocument();
      const filename = "archives.pdf";
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      doc.pipe(res);

      doc.fontSize(20).text("ARCHIVES — Paiements scolaires", { underline: true });
      doc.moveDown();

      rows.forEach(r => {
        doc.fontSize(12).text(`${r.eleve} — ${r.classe} — ${r.montant} USD — ${r.annee}`);
      });

      doc.end();
      return;
    }

    if (type === "excel") {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet("Archives");
      sheet.addRow(["Élève", "Classe", "Montant", "Date", "Année", "Référence"]);

      rows.forEach(r => {
        sheet.addRow([
          r.eleve, r.classe, r.montant,
          new Date(r.date).toLocaleDateString(),
          r.annee, r.reference
        ]);
      });

      const file = "archives.xlsx";
      await wb.xlsx.writeFile(file);
      return res.download(file);
    }

    if (type === "zip") {
      const file = "archives.zip";
      const output = fs.createWriteStream(file);
      const zip = archiver("zip");
      zip.pipe(output);

      rows.forEach(r => {
        if (r.recuPath && fs.existsSync(r.recuPath)) {
          zip.file(r.recuPath, { name: path.basename(r.recuPath) });
        }
      });

      await zip.finalize();
      output.on("close", () => res.download(file));
    }
  } catch (err) {
    res.status(500).json({ message: "Erreur export archives" });
  }
};
