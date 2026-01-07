// =============================================================
// 📊 GABKUT-ÉCOLE - CONTROLLER STATISTIQUES FINAL 🧠 ULTRA HYBRIDE
// =============================================================
const Eleve = require("../models/Eleve");
const Paiement = require("../models/Paiement");
const Classe = require("../models/Classe");
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");


/* -------------------------------------------------------------
   🔹 Statistiques globales
------------------------------------------------------------- */
exports.getStatsGlobales = async (req, res) => {
  try {
    const totalEleves = await Eleve.countDocuments();
    const totalPaiements = await Paiement.countDocuments();
    const montantTotal = await Paiement.aggregate([
      { $group: { _id: null, total: { $sum: "$montant" } } },
    ]);

    res.json({
      totalEleves,
      totalPaiements,
      montantTotal: montantTotal[0]?.total || 0,
    });
  } catch (err) {
    console.error("❌ Erreur getStatsGlobales :", err);
    res.status(500).json({
      message: "Erreur statistiques globales",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
   🔹 Statistiques par mois
------------------------------------------------------------- */
exports.getStatsParMois = async (_req, res) => {
  try {
    const data = await Paiement.aggregate([
      {
        $group: {
          _id: "$mois",
          total: { $sum: "$montant" },
          paiements: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json(data);
  } catch (err) {
    console.error("❌ Erreur getStatsParMois :", err);
    res.status(500).json({
      message: "Erreur statistiques mensuelles",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
   🔹 Statistiques par classe (VERSION OPTIMISÉE 🚀)
------------------------------------------------------------- */
/* -------------------------------------------------------------
   🔹 Statistiques par classe (VERSION OPTIMISÉE 🚀)
------------------------------------------------------------- */
exports.getStatsParClasse = async (req, res) => {
  try {
    const { cycle, annee, mois, startDate, endDate } = req.query;

    // 🔍 Filtre sur les paiements
    const filtrePaiements = {};

    // Année scolaire si tu la stockes (sinon enlève cette ligne)
    if (annee) {
      filtrePaiements.anneeScolaire = annee;
    }

    if (mois) {
      filtrePaiements.mois = mois;
    }

    if (startDate && endDate) {
      filtrePaiements.datePaiement = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Si tu as un statut (valid, annulé, etc.), tu peux filtrer ici
    // filtrePaiements.statut = "valid";

    // 1️⃣ Agréger les paiements par NOM de classe (classeNom)
    const paiementsParClasse = await Paiement.aggregate([
      { $match: filtrePaiements },
      {
        $group: {
          _id: "$classeNom",          // <- très important : string, même valeur que Classe.nom
          totalPaye: { $sum: "$montant" },
          nombrePaiements: { $sum: 1 },
        },
      },
    ]);

    // Map : "4ème Mécanique Automobile" -> montant payé
    const paiementsMap = new Map(
      paiementsParClasse.map((p) => [p._id, p.totalPaye])
    );

    // 2️⃣ Récupérer toutes les classes + effectifs par classe (via ObjectId)
    const classes = await Classe.find().lean();

    const eleves = await Eleve.aggregate([
      { $group: { _id: "$classe", totalEleves: { $sum: 1 } } },
    ]);
    const elevesMap = new Map(eleves.map((e) => [String(e._id), e.totalEleves]));

    // 3️⃣ Construire les stats pour chaque classe
    const stats = classes
      .filter((c) => !cycle || cycle === "Tous" || c.niveau === cycle)
      .map((c) => {
        const effectif = elevesMap.get(String(c._id)) || 0;

        // Ici on matche par nom de classe, identique à _id du group ($classeNom)
        const paye = paiementsMap.get(c.nom) || 0;

        const attendu = effectif * (c.montantFrais || 0);
        const solde = attendu - paye;
        const tauxRecouvrement =
          attendu > 0 ? ((paye / attendu) * 100).toFixed(1) : 0;

        return {
          classe: c.nom,
          cycle: c.niveau,
          effectif,
          attendu,
          paye,
          solde,
          tauxRecouvrement,
        };
      });

    // 4️⃣ Totaux
    const totalEffectif = stats.reduce((s, c) => s + c.effectif, 0);
    const totalAttendu = stats.reduce((s, c) => s + c.attendu, 0);
    const totalPaye = stats.reduce((s, c) => s + c.paye, 0);
    const totalSolde = stats.reduce((s, c) => s + c.solde, 0);
    const totalTaux =
      totalAttendu > 0 ? ((totalPaye / totalAttendu) * 100).toFixed(1) : 0;

    stats.push({
      classe: "Totaux",
      cycle: "",
      effectif: totalEffectif,
      attendu: totalAttendu,
      paye: totalPaye,
      solde: totalSolde,
      tauxRecouvrement: totalTaux,
    });

    res.json(stats);
  } catch (err) {
    console.error("❌ Erreur getStatsParClasse (optimisée):", err);
    res.status(500).json({
      message: "Erreur statistiques par classe",
      error: err.message,
    });
  }
};


/* -------------------------------------------------------------
   🔹 Génération PDF du rapport statistiques complet
------------------------------------------------------------- */
/* -------------------------------------------------------------
   🔹 Génération PDF du rapport statistiques complet (CORRIGÉE ✅)
------------------------------------------------------------- */
exports.exportRapportPDF = async (req, res) => {
  try {
    // 📊 Génération automatique des stats si pas fourni dans req.body
    let stats = req.body.stats;
    
    if (!stats || !Array.isArray(stats) || stats.length === 0) {
      // Génération automatique des stats globales
      stats = await generateStatsForPDF();
    }

    const outputDir = path.join(__dirname, "../public/rapports");
    fs.mkdirSync(outputDir, { recursive: true });

    const filePath = path.join(
      outputDir,
      `Rapport_Statistiques_${Date.now()}.pdf`
    );

    const doc = new PDFDocument({ 
      margin: 40,
      size: 'A4',
      layout: 'portrait'
    });
    
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // ============================================================
    // 🏫 EN-TÊTE OFFICIEL (amélioré)
    // ============================================================
    doc
      .fontSize(20)
      .fillColor("#1e293b")
      .font("Helvetica-Bold")
      .text("🏫 Collège LE MÉRITE", { align: "center" });
    
    doc.moveDown(0.3);
    doc
      .fontSize(14)
      .fillColor("#1e40af")
      .font("Helvetica")
      .text("Connaissance • Rigueur • Réussite", { align: "center" });
    
    doc.moveDown(0.4);
    doc
      .fontSize(11)
      .fillColor("#475569")
      .text("27 Frangipaniers / Bel-Air / Kampemba / Lubumbashi", { align: "center" });
    
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor("#3b82f6")
      .text("contact@collegelemerite.cd | +243 970 008 546 | www.collegelemerite.cd", {
        align: "center",
        link: "mailto:contact@collegelemerite.cd"
      });
    
    doc.moveDown(0.8);
    
    // Ligne décorative
    doc
      .strokeColor("#3b82f6")
      .lineWidth(2)
      .moveTo(40, doc.y)
      .lineTo(560, doc.y)
      .stroke();
    
    doc.moveDown(1);
    
    const dateRapport = new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    
    doc
      .fontSize(16)
      .fillColor("#1e293b")
      .font("Helvetica-Bold")
      .text("📊 Rapport des Statistiques Financières par Classe", { align: "center" });
    
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .fillColor("#64748b")
      .text(`Généré le ${dateRapport}`, { align: "center" });
    
    doc.moveDown(1.2);

    // ============================================================
    // 📄 TABLEAU PRINCIPAL (amélioré avec colonnes fixes)
    // ============================================================
    doc.fontSize(9).fillColor("#1e293b");
    
    // En-tête du tableau
    const headers = ["Classe", "Cycle", "Effectif", "Attendu ($)", "Payé ($)", "Solde ($)", "Taux (%)"];
    const headerLine = headers.map(h => h.padEnd(12)).join(" | ");
    
    doc.font("Helvetica-Bold").text(headerLine);
    doc
      .strokeColor("#cbd5e1")
      .lineWidth(1)
      .moveTo(40, doc.y + 5)
      .lineTo(560, doc.y + 5)
      .stroke();
    
    doc.moveDown(0.4);

    // Données du tableau
    const lastIndex = stats.length - 1;
    stats.forEach((row, i) => {
      const isTotal = i === lastIndex;
      
      // Formatage sécurisé des données
      const classe = (row.classe || "N/A").toString().substring(0, 15);
      const cycle = (row.cycle || "").toString().substring(0, 8);
      const effectif = Number(row.effectif || 0).toLocaleString();
      const attendu = Number(row.attendu || 0).toLocaleString('fr-FR', {minimumFractionDigits: 0});
      const paye = Number(row.paye || 0).toLocaleString('fr-FR', {minimumFractionDigits: 0});
      const solde = Number(row.solde || 0).toLocaleString('fr-FR', {minimumFractionDigits: 0});
      const taux = (row.tauxRecouvrement || 0).toFixed(1);
      
      const line = [
        classe.padEnd(15),
        cycle.padEnd(10),
        effectif.padStart(8),
        attendu.padStart(12),
        paye.padStart(12),
        solde.padStart(12),
        `${taux}%`.padStart(8)
      ].join(" | ");

      // Style conditionnel
      if (isTotal) {
        doc.moveDown(0.2);
        doc.font("Helvetica-Bold").fillColor("#1e40af");
        doc.lineWidth(2).strokeColor("#1e40af");
      } else {
        doc.font("Helvetica").fillColor("#1e293b");
        doc.lineWidth(1).strokeColor("#e2e8f0");
      }

      doc.text(line);
      
      // Ligne séparatrice
      doc.moveTo(40, doc.y + 3).lineTo(560, doc.y + 3).stroke();
    });

    doc.moveDown(1);

    // ============================================================
    // 📈 RÉSUMÉ GLOBAL (nouveau)
    // ============================================================
    if (stats.length > 1) {
      const totalRow = stats[stats.length - 1];
      doc
        .fontSize(12)
        .fillColor("#059669")
        .font("Helvetica-Bold")
        .text("🎯 RÉSUMÉ GLOBAL", { underline: true });
      
      doc.moveDown(0.4);
      doc.fontSize(11);
      doc.text(`Effectif total: ${Number(totalRow.effectif || 0).toLocaleString()}`);
      doc.text(`Frais attendus: ${Number(totalRow.attendu || 0).toLocaleString('fr-FR')} $`);
      doc.text(`Montant encaissé: ${Number(totalRow.paye || 0).toLocaleString('fr-FR')} $`);
      doc.text(`Taux de recouvrement: ${(totalRow.tauxRecouvrement || 0).toFixed(1)} %`);
      
      doc.moveDown(1);
    }

    // ============================================================
    // 📋 PIED DE PAGE OFFICIEL (amélioré)
    // ============================================================
    doc
      .fontSize(9)
      .fillColor("#64748b")
      .font("Helvetica");
    
    doc.moveDown(2);
    
    doc.text(
      "✅ Établissement agréé par le Ministère de l'Enseignement Primaire, Secondaire et Technique",
      { align: "center" }
    );
    doc.moveDown(0.3);
    doc.text(
      "Approved by the Ministry of Primary, Secondary and Technical Education",
      { align: "center" }
    );
    
    doc.moveDown(0.5);
    doc.text(
      "📍 27 Frangipaniers, Bel-Air, Kampemba, Lubumbashi, RDC",
      { align: "center" }
    );
    doc.moveDown(0.2);
    doc.text(
      "📞 +243 970 008 546 | ✉️ contact@collegelemerite.cd | 🌐 www.collegelemerite.cd",
      { align: "center" }
    );
    
    doc.moveDown(0.5);
    doc
      .fillColor("#1e293b")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("© 2025 Gabkut-Schola – Développé par Gabkut Agency LMK | +243 822 783 500", {
        align: "center",
      });

    doc.end();

    // Gestion du téléchargement
    writeStream.on("finish", () => {
      res.download(filePath, `Rapport_Statistiques_${Date.now()}.pdf`, (err) => {
        if (err) {
          console.error("❌ Erreur téléchargement PDF:", err);
          // Nettoyage en cas d'erreur
          fs.unlinkSync(filePath);
        }
        // Nettoyage automatique après 1h
        setTimeout(() => {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }, 3600000);
      });
    });

    writeStream.on("error", (err) => {
      console.error("❌ Erreur écriture PDF:", err);
      res.status(500).json({ message: "Erreur lors de la génération du PDF" });
    });

  } catch (err) {
    console.error("❌ Erreur exportRapportPDF :", err);
    res.status(500).json({
      message: "Erreur lors de la génération du PDF",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
   🔧 UTILITAIRE : Génération automatique des stats pour PDF
------------------------------------------------------------- */
async function generateStatsForPDF() {
  try {
    const classes = await Classe.find().lean();
    const paiementsParClasse = await Paiement.aggregate([
      {
        $group: {
          _id: "$classe",
          totalPaye: { $sum: "$montant" },
          nombrePaiements: { $sum: 1 }
        }
      }
    ]);

    const paiementsMap = new Map(paiementsParClasse.map(p => [p._id, p.totalPaye]));
    const elevesParClasse = await Eleve.aggregate([
      { $group: { _id: "$classe", totalEleves: { $sum: 1 } } }
    ]);
    const elevesMap = new Map(elevesParClasse.map(e => [String(e._id), e.totalEleves]));

    const stats = classes.map(c => {
      const effectif = elevesMap.get(String(c._id)) || 0;
      const paye = paiementsMap.get(c.nom) || 0;
      const attendu = effectif * (c.montantFrais || 0);
      const solde = attendu - paye;
      const tauxRecouvrement = attendu > 0 ? ((paye / attendu) * 100).toFixed(1) : 0;

      return {
        classe: c.nom,
        cycle: c.niveau || "Non défini",
        effectif,
        attendu,
        paye,
        solde,
        tauxRecouvrement
      };
    });

    // Ajout des totaux
    const totalEffectif = stats.reduce((s, c) => s + c.effectif, 0);
    const totalAttendu = stats.reduce((s, c) => s + c.attendu, 0);
    const totalPaye = stats.reduce((s, c) => s + c.paye, 0);
    const totalSolde = stats.reduce((s, c) => s + c.solde, 0);
    const totalTaux = totalAttendu > 0 ? ((totalPaye / totalAttendu) * 100).toFixed(1) : 0;

    stats.push({
      classe: "📊 TOTAUX GÉNÉRAUX",
      cycle: "",
      effectif: totalEffectif,
      attendu: totalAttendu,
      paye: totalPaye,
      solde: totalSolde,
      tauxRecouvrement: totalTaux
    });

    return stats;
  } catch (error) {
    console.error("❌ Erreur génération stats PDF:", error);
    return [{
      classe: "Erreur",
      cycle: "",
      effectif: 0,
      attendu: 0,
      paye: 0,
      solde: 0,
      tauxRecouvrement: "0"
    }];
  }
}

/* ============================================================== 
   📅 GÉNÉRATION DE RAPPORTS PAR PÉRIODE (CORRIGÉE ✅)
============================================================== */
async function genererRapport(req, res, type) {
  try {
    const now = new Date();
    let start, end;

    switch (type) {
      case "journalier":
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case "hebdomadaire":
        const lundi = new Date();
        lundi.setDate(now.getDate() - now.getDay() + 1);
        start = new Date(lundi.setHours(0, 0, 0, 0));
        end = new Date(lundi);
        end.setDate(start.getDate() + 7);
        break;
      case "mensuel":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case "trimestriel":
        const trimestre = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), trimestre * 3, 1);
        end = new Date(now.getFullYear(), trimestre * 3 + 3, 0, 23, 59, 59, 999);
        break;
      case "semestriel":
        const semestre = now.getMonth() < 6 ? 0 : 6;
        start = new Date(now.getFullYear(), semestre, 1);
        end = new Date(now.getFullYear(), semestre + 6, 0, 23, 59, 59, 999);
        break;
      case "annuel":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default:
        return res.status(400).json({ message: "Type de rapport invalide." });
    }

    // Récupération des paiements peuplés avec lean() 
const paiements = await Paiement.find({
  datePaiement: { $gte: start, $lte: end },
})
.populate({
    path: "eleveId",
    select: "nom sexe age classe",
    populate: {
      path: "classe",
      select: "nom niveau montantFrais",
    },
})
.lean();


    if (!paiements.length)
      return res.status(200).json({ message: "Aucun paiement trouvé pour cette période." });

    // On envoie directement les paiements complets peuplés à la fonction de construction
    const rapport = construireRapportStructure(paiements);

    const nomFichier = `rapport_${type}_${new Date().toISOString().split("T")[0]}.xlsx`;
    const chemin = genererExcel(rapport, nomFichier);

    res.status(200).json({
      message: `Rapport ${type} généré avec succès.`,
      fichier: chemin,
      resume: {
        totalPaiements: rapport.details.length,
        classes: Object.keys(rapport.compilation).length,
        cycles: Object.keys(rapport.centralisation).length,
      },
    });
  } catch (err) {
    console.error("❌ Erreur lors de la génération du rapport :", err);
    res.status(500).json({
      message: "Erreur lors de la génération du rapport.",
      error: err.message,
    });
  }
}

// ==========================================
// 🔧 UTILITAIRE DE FUSION HIÉRARCHIQUE
// ==========================================
function construireRapportStructure(paiements) {
  const details = [];
  const compilation = {};
  const centralisation = {};

  // 🧩 PHASE 1 – DÉTAILS ÉLÈVES
  paiements.forEach((p) => {
const nomComplet = p.eleveId?.nom || "Inconnu";
const classe = p.eleveId?.classe?.nom || "Non définie";
const cycle = p.eleveId?.classe?.niveau || "Non défini";

    const montant = p.montant || 0;
    const mois = p.mois || "";
    const reference = p.reference || "—";

    const champDate = p.datePaiement || p.date || p.createdAt || p.updatedAt;
    const datePaiement = champDate
      ? new Date(champDate).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

    details.push({
      Élève: nomComplet,
      Classe: classe,
      Cycle: cycle,
      Montant: montant,
      Mois: mois,
      Date: datePaiement,
      Référence: reference,
    });

    // 🧩 PHASE 2 – PAR CLASSE
    if (!compilation[classe]) {
      compilation[classe] = {
        cycle,
        eleves: [],
        total: 0,
      };
    }

    compilation[classe].eleves.push({
      nom: nomComplet,
      montant,
      datePaiement,
      ref: reference,
    });
    compilation[classe].total += montant;
  });

  // 🧩 PHASE 3 – CENTRALISATION PAR CYCLE
  Object.entries(compilation).forEach(([classe, obj]) => {
    const cycle = obj.cycle;
    if (!centralisation[cycle]) {
      centralisation[cycle] = { classes: {}, total: 0 };
    }
    centralisation[cycle].classes[classe] = obj;
    centralisation[cycle].total += obj.total;
  });

  return { details, compilation, centralisation };
}

// ==========================================
// 📘 UTILITAIRE GÉNÉRATION EXCEL
// ==========================================
function genererExcel(rapport, nomFichier) {
  const wb = XLSX.utils.book_new();

  // Feuille 1 – Détails
  const ws1 = XLSX.utils.json_to_sheet(rapport.details);
  XLSX.utils.book_append_sheet(wb, ws1, "Détails");

  // Feuille 2 – Compilation
  const data2 = [];
  Object.entries(rapport.compilation).forEach(([classe, obj]) => {
    obj.eleves.forEach((el, i) => {
      data2.push({
        Classe: i === 0 ? classe : "",
        Élève: el.nom,
        Montant: el.montant,
        Date: new Date(el.date).toLocaleDateString(),
        Référence: el.ref,
      });
    });
  });
  const ws2 = XLSX.utils.json_to_sheet(data2);
  XLSX.utils.book_append_sheet(wb, ws2, "Compilation");

  // Feuille 3 – Centralisation
  const data3 = [];
  Object.entries(rapport.centralisation).forEach(([cycle, obj]) => {
    Object.entries(obj.classes).forEach(([classe, cdata], i) => {
      cdata.eleves.forEach((e, j) => {
        data3.push({
          Cycle: i === 0 && j === 0 ? cycle : "",
          Classe: j === 0 ? classe : "",
          Élève: e.nom,
          Montant: e.montant,
          Date: new Date(e.date).toLocaleDateString(),
        });
      });
    });
  });
  const ws3 = XLSX.utils.json_to_sheet(data3);
  XLSX.utils.book_append_sheet(wb, ws3, "Centralisation");

  const dossier = path.join(__dirname, "../public/rapports");
  fs.mkdirSync(dossier, { recursive: true });
  const chemin = path.join(dossier, nomFichier);
  XLSX.writeFile(wb, chemin);

  return `/rapports/${nomFichier}`;
}

// =============================================================
// 📅 FILTRES DYNAMIQUES (année, mois, classe, période, avancé)
// =============================================================
const Statistique = require("../models/Statistique");

// -------------------------------------------------------------
// 🔍  Filtre global dynamique
// -------------------------------------------------------------
exports.filtrerToutesConditions = async (req, res) => {
  try {
    const { annee, mois, cycle, classe, debut, fin } = req.query;
    const query = {};

    // 🎯 Ajout dynamique des filtres selon ce qui est envoyé
    if (annee) query.annee = parseInt(annee);
    if (cycle) query.cycle = cycle;
    if (classe) query.classe = { $regex: classe, $options: "i" };
    if (mois) query.mois = mois;

    // 📅 Période
    if (debut && fin) {
      query.date = { $gte: new Date(debut), $lte: new Date(fin) };
    }

    const stats = await Statistique.find(query).lean();

    if (!stats.length) {
      return res.status(200).json([]); // pas d'erreur, mais vide
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error("❌ Erreur filtre statistiques :", error);
    res.status(500).json({ message: "Erreur lors du filtrage des statistiques." });
  }
};

// -------------------------------------------------------------
// 🗓️ Filtrer par année et mois
// -------------------------------------------------------------
exports.filtrerParAnneeMois = async (req, res) => {
  try {
    const { annee, mois } = req.query;
    const query = {};
    if (annee) query.annee = parseInt(annee);
    if (mois) query.mois = mois;

    const stats = await Statistique.find(query).lean();
    res.status(200).json(stats);
  } catch (error) {
    console.error("Erreur filtrerParAnneeMois:", error);
    res.status(500).json({ message: "Erreur lors du filtrage par année et mois." });
  }
};

// -------------------------------------------------------------
// 🏫 Filtrer par classe et cycle
// -------------------------------------------------------------
exports.filtrerParClasseCycle = async (req, res) => {
  try {
    const { classe, cycle } = req.query;
    const query = {};
    if (classe) query.classe = { $regex: classe, $options: "i" };
    if (cycle) query.cycle = cycle;

    const stats = await Statistique.find(query).lean();
    res.status(200).json(stats);
  } catch (error) {
    console.error("Erreur filtrerParClasseCycle:", error);
    res.status(500).json({ message: "Erreur lors du filtrage par classe ou cycle." });
  }
};

// -------------------------------------------------------------
// 🗓️ Filtrer par période (dates)
// -------------------------------------------------------------
exports.filtrerParPeriode = async (req, res) => {
  try {
    const { debut, fin } = req.query;
    if (!debut || !fin) {
      return res.status(400).json({ message: "Veuillez préciser les dates début et fin." });
    }

    const stats = await Statistique.find({
      date: { $gte: new Date(debut), $lte: new Date(fin) },
    }).lean();

    res.status(200).json(stats);
  } catch (error) {
    console.error("Erreur filtrerParPeriode:", error);
    res.status(500).json({ message: "Erreur lors du filtrage par période." });
  }
};

// -------------------------------------------------------------
// 🔎 Filtre avancé (tous critères)
// -------------------------------------------------------------
exports.filtrerAvance = async (req, res) => {
  try {
    const { annee, mois, cycle, classe, debut, fin } = req.query;
    const query = {};

    if (annee) query.annee = parseInt(annee);
    if (mois) query.mois = mois;
    if (cycle) query.cycle = cycle;
    if (classe) query.classe = { $regex: classe, $options: "i" };
    if (debut && fin) query.date = { $gte: new Date(debut), $lte: new Date(fin) };

    const stats = await Statistique.find(query).lean();
    res.status(200).json(stats);
  } catch (error) {
    console.error("Erreur filtre avancé:", error);
    res.status(500).json({ message: "Erreur lors du filtrage avancé." });
  }
};

// -------------------------------------------------------------
// 🔹 Statistiques d’évolution mensuelle (graphique ligne)
// -------------------------------------------------------------
exports.getEvolutionMensuelle = async (req, res) => {
  try {
    const data = await Paiement.aggregate([
      { $group: { _id: "$mois", total: { $sum: "$montant" } } },
      { $sort: { _id: 1 } },
    ]);

    const moisOrdre = [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ];

    const evolution = moisOrdre.map((m) => {
      const d = data.find((x) => x._id === m);
      return { mois: m, total: d ? d.total : 0 };
    });

    res.json(evolution);
  } catch (err) {
    console.error("❌ Erreur getEvolutionMensuelle :", err);
    res.status(500).json({
      message: "Erreur statistiques mensuelles (évolution)",
      error: err.message,
    });
  }
};

// -------------------------------------------------------------
// 🔹 Évolution hebdomadaire
// -------------------------------------------------------------
exports.getEvolutionHebdomadaire = async (req, res) => {
  try {
    const data = await Paiement.aggregate([
      {
        $group: {
          _id: { $isoWeek: "$datePaiement" },
          total: { $sum: "$montant" }
        }
      },
      { $sort: { "_id": 1 } },
      { $limit: 7 }
    ]);
    res.json(data.map(e => ({
      semaine: `Semaine ${e._id}`,
      total: e.total
    })));
  } catch (err) {
    console.error("❌ Erreur getEvolutionHebdomadaire :", err);
    res.status(500).json({ message: "Erreur statistiques hebdomadaires", error: err.message });
  }
};

// -------------------------------------------------------------
// 🔹 Évolution journalière
// -------------------------------------------------------------
exports.getEvolutionJournaliere = async (req, res) => {
  try {
    const septJours = new Date();
    septJours.setDate(septJours.getDate() - 7);
    const data = await Paiement.aggregate([
      { $match: { datePaiement: { $gte: septJours } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$datePaiement" } },
          total: { $sum: "$montant" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    res.json(data.map(d => ({ jour: d._id, total: d.total })));
  } catch (err) {
    console.error("❌ Erreur getEvolutionJournaliere :", err);
    res.status(500).json({ message: "Erreur statistiques journalières", error: err.message });
  }
};

/* -------------------------------------------------------------
   🔹 Statistiques d’une classe spécifique (par ID)
------------------------------------------------------------- */
exports.getStatsParClasseUnique = async (req, res) => {
  try {
    const classeId = req.params.id;

    // 1️⃣ Vérifier si la classe existe
    const classe = await Classe.findById(classeId);
    if (!classe) {
      return res.status(404).json({ message: "Classe non trouvée" });
    }

    // 2️⃣ Récupérer les élèves et paiements liés
    const eleves = await Eleve.find({ classe: classeId }).lean();
    const paiements = await Paiement.find({ classe: classe.nom }).lean();

    const totalEleves = eleves.length;
    const montantAttendu = totalEleves * (classe.montantFrais || 0);
    const montantPaye = paiements.reduce((s, p) => s + (p.montant || 0), 0);

    // 3️⃣ Calcul des taux
    const tauxPaiement =
      montantAttendu > 0 ? ((montantPaye / montantAttendu) * 100).toFixed(1) : 0;
    const totalRetard = totalEleves - paiements.filter(p => p.montant >= (classe.montantFrais || 0)).length;

    // 4️⃣ Réponse structurée
    res.status(200).json({
      classeNom: classe.nom,
      cycle: classe.niveau,
      totalEleves,
      montantAttendu,
      montantPaye,
      tauxPaiement,
      totalRetard,
    });
  } catch (err) {
    console.error("❌ Erreur getStatsParClasseUnique :", err);
    res.status(500).json({
      message: "Erreur lors du calcul des statistiques par classe spécifique.",
      error: err.message,
    });
  }
};

// =============================================================
// 🔁 RE-CALCUL AUTOMATIQUE DES EFFECTIFS (CLASSES)
// =============================================================

/* -------------------------------------------------------------
   🔁 RE-CALCUL AUTOMATIQUE DES EFFECTIFS (CLASSES)
------------------------------------------------------------- */
exports.recalculerEffectifs = async (req, res) => {
  try {
    const classes = await Classe.find();
    for (const c of classes) {
      const nbEleves = await Eleve.countDocuments({ "classe._id": c._id });
      await Classe.findByIdAndUpdate(c._id, { effectif: nbEleves });
    }
    res.json({ message: "✅ Recalcul des effectifs effectué avec succès !" });
  } catch (err) {
    console.error("❌ Erreur recalcul effectifs :", err);
    res.status(500).json({ message: "Erreur recalcul effectifs", error: err.message });
  }
};

// ==========================================
// 🚀 EXPORT DES ROUTES
// ==========================================
exports.rapportJournalier = (req, res) => genererRapport(req, res, "journalier");
exports.rapportHebdomadaire = (req, res) => genererRapport(req, res, "hebdomadaire");
exports.rapportMensuel = (req, res) => genererRapport(req, res, "mensuel");
exports.rapportTrimestriel = (req, res) => genererRapport(req, res, "trimestriel");
exports.rapportSemestriel = (req, res) => genererRapport(req, res, "semestriel");
exports.rapportAnnuel = (req, res) => genererRapport(req, res, "annuel");




