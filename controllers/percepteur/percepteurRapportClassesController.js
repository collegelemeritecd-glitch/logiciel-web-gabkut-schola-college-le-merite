/************************************************************
 📊 CONTROLLER RAPPORT CLASSES - PERCEPTEUR
 Collège Le Mérite - Backend Node.js
 Gabkut Agency LMK +243822783500
*************************************************************/

const path = require('path');
const fs = require('fs');
const XlsxPopulate = require('xlsx-populate');
const PDFDocument = require('pdfkit');

const Paiement = require('../../models/Paiement');
const Eleve = require('../../models/Eleve');
const Classe = require('../../models/Classe');

const ANNEE_SCOLAIRE_DEFAUT = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';

/**
 * GET /api/percepteur/rapport-classes
 * Rapport complet avec élèves et paiements
 */
exports.getRapportClasses = async (req, res) => {
  try {
    const { anneeScolaire, classeId, niveau, statut, tri, affichage } = req.query;
    const annee = anneeScolaire || ANNEE_SCOLAIRE_DEFAUT;

    console.log(`📊 GET /rapport-classes - Année: ${annee}`);

    // 1️⃣ Récupérer toutes les classes actives
    const classes = await Classe.find({ isActive: true })
      .select('nom niveau montantFrais effectif')
      .lean();

    if (!classes.length) {
      return res.json({
        success: true,
        anneeScolaire: annee,
        classes: [],
        overview: {
          classesTotal: 0,
          effectifTotal: 0,
          elevesAjour: 0,
          elevesRetard: 0,
          tauxGlobal: 0,
          montantTotalPaye: 0,
          totalAttendu: 0
        }
      });
    }

    // 2️⃣ Récupérer tous les élèves
    const eleves = await Eleve.find({
      anneeScolaire: annee,
      isActive: true
    })
      .select('classe nom prenom postnom totalPaye resteAPayer')
      .lean();

    console.log(`👨‍🎓 ${eleves.length} élèves trouvés`);

    // 3️⃣ Récupérer tous les paiements
    const eleveIds = eleves.map(e => e._id);
    const paiements = await Paiement.find({
      eleveId: { $in: eleveIds },
      anneeConcernee: annee,
      statut: 'validé'
    }).lean();

    console.log(`💳 ${paiements.length} paiements trouvés`);

    // 4️⃣ Regrouper élèves par classe
    const elevesMap = {};
    eleves.forEach(e => {
      const classeIdKey = e.classe?.toString();
      if (!classeIdKey) return;
      if (!elevesMap[classeIdKey]) elevesMap[classeIdKey] = [];
      elevesMap[classeIdKey].push(e);
    });

    // 5️⃣ Regrouper paiements par élève
    const paiementsMap = {};
    paiements.forEach(p => {
      const eleveIdKey = p.eleveId?.toString();
      if (!eleveIdKey) return;
      if (!paiementsMap[eleveIdKey]) {
        paiementsMap[eleveIdKey] = { total: 0, count: 0, mois: {} };
      }
      paiementsMap[eleveIdKey].total += p.montant || 0;
      paiementsMap[eleveIdKey].count += 1;

      const moisField = p.mois || p.moisConcerne || p.periode || p.moisPaiement;
      if (moisField) {
        paiementsMap[eleveIdKey].mois[moisField] =
          (paiementsMap[eleveIdKey].mois[moisField] || 0) + (p.montant || 0);
      }
    });

    // 6️⃣ Calculer stats par classe
    const classesStats = classes.map(c => {
      const classeIdKey = c._id.toString();
      const elevesClasse = elevesMap[classeIdKey] || [];

      const nbEleves = elevesClasse.length;
      const montantFrais = c.montantFrais || 0;

      let totalAttendu = 0;
      let totalPaye = 0;
      let totalImpaye = 0;
      let elevesAjour = 0;
      let elevesRetard = 0;
      let nombrePaiementsTotal = 0;

      const elevesAvecPaiements = elevesClasse.map(e => {
        const eleveIdKey = e._id.toString();
        const pData = paiementsMap[eleveIdKey] || { total: 0, count: 0, mois: {} };

        const attendu = montantFrais;
        const paye = e.totalPaye !== undefined ? e.totalPaye : pData.total;
        const reste = e.resteAPayer !== undefined
          ? e.resteAPayer
          : Math.max(0, attendu - paye);

        totalAttendu += attendu;
        totalPaye += paye;
        totalImpaye += reste;
        nombrePaiementsTotal += pData.count;

        if (reste <= 0) elevesAjour += 1;
        else elevesRetard += 1;

        return {
          _id: e._id,
          nom: e.nom,
          prenom: e.prenom,
          postnom: e.postnom,
          nomComplet: [e.nom, e.prenom, e.postnom].filter(Boolean).join(' '),
          totalPaye: paye,
          resteAPayer: reste,
          nombrePaiements: pData.count,
          paiementsMois: pData.mois
        };
      });

      const taux = totalAttendu > 0 ? (totalPaye / totalAttendu) * 100 : 0;

      let statutPaiement = 'moyen';
      if (taux < 50) statutPaiement = 'critique';
      else if (taux >= 80) statutPaiement = 'bon';

      return {
        id: c._id,
        _id: c._id,
        nom: c.nom,
        niveau: c.niveau,
        effectif: nbEleves,
        montantFrais,
        totalAttendu,
        totalPaye,
        totalImpaye,
        elevesAjour,
        elevesRetard,
        taux,
        statutPaiement,
        nombrePaiementsTotal,
        eleves: elevesAvecPaiements
      };
    });

    // 7️⃣ Filtres
    let list = classesStats;

    if (classeId) {
      list = list.filter(c => c.id.toString() === classeId);
    }
    if (niveau) {
      list = list.filter(c => c.niveau === niveau);
    }
    if (statut) {
      list = list.filter(c => c.statutPaiement === statut);
    }
    if (affichage === 'problemes') {
      list = list.filter(c => c.elevesRetard > 0);
    } else if (affichage === 'ajour') {
      list = list.filter(c => c.elevesRetard === 0);
    }

    // 8️⃣ Tri
    switch (tri) {
      case 'nom':
        list.sort((a, b) => a.nom.localeCompare(b.nom));
        break;
      case 'effectif':
        list.sort((a, b) => (b.effectif || 0) - (a.effectif || 0));
        break;
      case 'taux':
        list.sort((a, b) => a.taux - b.taux);
        break;
      case 'dette':
        list.sort((a, b) => (b.totalImpaye || 0) - (a.totalImpaye || 0));
        break;
      case 'retards':
      default:
        list.sort((a, b) => (b.elevesRetard || 0) - (a.elevesRetard || 0));
        break;
    }

    // 9️⃣ Overview global
    const overview = list.reduce(
      (acc, c) => {
        acc.classesTotal += 1;
        acc.effectifTotal += c.effectif || 0;
        acc.elevesAjour += c.elevesAjour || 0;
        acc.elevesRetard += c.elevesRetard || 0;
        acc.montantTotalPaye += c.totalPaye || 0;
        acc.totalAttendu += c.totalAttendu || 0;
        acc.nombrePaiementsTotal += c.nombrePaiementsTotal || 0;
        return acc;
      },
      {
        classesTotal: 0,
        effectifTotal: 0,
        elevesAjour: 0,
        elevesRetard: 0,
        montantTotalPaye: 0,
        totalAttendu: 0,
        nombrePaiementsTotal: 0
      }
    );

    overview.tauxGlobal = overview.totalAttendu > 0
      ? (overview.montantTotalPaye / overview.totalAttendu) * 100
      : 0;

    console.log(`✅ ${list.length} classes avec paiements chargées`);

    res.json({
      success: true,
      anneeScolaire: annee,
      classes: list,
      overview
    });

  } catch (error) {
    console.error('❌ Erreur rapport classes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement du rapport classes',
      error: error.message
    });
  }
};

/**
 * GET /api/percepteur/rapport-classes/export-excel
 */
exports.exportExcel = async (req, res) => {
  try {
    const { anneeScolaire, classeId, niveau, statut } = req.query;
    const percepteur = req.user;
    const annee = anneeScolaire || ANNEE_SCOLAIRE_DEFAUT;

    console.log(`📊 Export Excel - Année: ${annee}`);

    const classes = await Classe.find({ isActive: true })
      .select('nom niveau montantFrais effectif')
      .lean();

    const eleves = await Eleve.find({
      anneeScolaire: annee,
      isActive: true
    })
      .select('classe nom prenom postnom totalPaye resteAPayer')
      .lean();

    const eleveIds = eleves.map(e => e._id);
    const paiements = await Paiement.find({
      eleveId: { $in: eleveIds },
      anneeConcernee: annee,
      statut: 'validé'
    }).lean();

    const elevesMap = {};
    eleves.forEach(e => {
      const key = e.classe?.toString();
      if (!key) return;
      if (!elevesMap[key]) elevesMap[key] = [];
      elevesMap[key].push(e);
    });

    const paiementsMap = {};
    paiements.forEach(p => {
      const key = p.eleveId?.toString();
      if (!key) return;
      if (!paiementsMap[key]) {
        paiementsMap[key] = { total: 0, count: 0 };
      }
      paiementsMap[key].total += p.montant || 0;
      paiementsMap[key].count += 1;
    });

    let classesStats = classes.map(c => {
      const key = c._id.toString();
      const elevesClasse = elevesMap[key] || [];
      const montantFrais = c.montantFrais || 0;

      let totalAttendu = 0;
      let totalPaye = 0;
      let totalImpaye = 0;
      let elevesAjour = 0;
      let elevesRetard = 0;

      elevesClasse.forEach(e => {
        const eleveKey = e._id.toString();
        const pData = paiementsMap[eleveKey] || { total: 0, count: 0 };
        const attendu = montantFrais;
        const paye = e.totalPaye !== undefined ? e.totalPaye : pData.total;
        const reste = e.resteAPayer !== undefined ? e.resteAPayer : Math.max(0, attendu - paye);

        totalAttendu += attendu;
        totalPaye += paye;
        totalImpaye += reste;
        if (reste <= 0) elevesAjour += 1;
        else elevesRetard += 1;
      });

      const taux = totalAttendu > 0 ? (totalPaye / totalAttendu) * 100 : 0;

      return {
        nom: c.nom,
        niveau: c.niveau,
        effectif: elevesClasse.length,
        montantFrais,
        totalPaye,
        totalImpaye,
        elevesAjour,
        elevesRetard,
        taux
      };
    });

    if (classeId) {
      classesStats = classesStats.filter(c => c.id?.toString() === classeId);
    }
    if (niveau) {
      classesStats = classesStats.filter(c => c.niveau === niveau);
    }

    const workbook = await XlsxPopulate.fromBlankAsync();

    const sheet1 = workbook.sheet(0);
    sheet1.name('Résumé');

    sheet1.cell('A1').value('📊 RAPPORT CLASSES - PERCEPTEUR')
      .style({ bold: true, fontSize: 14, fontColor: '1F527F' });

    sheet1.cell('A2').value(`Année: ${annee}`);
    sheet1.cell('A3').value(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`);
    sheet1.cell('A4').value(`Percepteur: ${percepteur.fullName || percepteur.email || 'Inconnu'}`);

    const overview = classesStats.reduce(
      (acc, c) => {
        acc.effectifTotal += c.effectif || 0;
        acc.elevesAjour += c.elevesAjour || 0;
        acc.elevesRetard += c.elevesRetard || 0;
        acc.montantTotalPaye += c.totalPaye || 0;
        return acc;
      },
      { effectifTotal: 0, elevesAjour: 0, elevesRetard: 0, montantTotalPaye: 0 }
    );

    sheet1.cell('A6').value('Statistiques Globales').style({ bold: true });
    sheet1.cell('A7').value('Nombre de classes:');
    sheet1.cell('B7').value(classesStats.length);
    sheet1.cell('A8').value('Effectif total:');
    sheet1.cell('B8').value(overview.effectifTotal);
    sheet1.cell('A9').value('Élèves à jour:');
    sheet1.cell('B9').value(overview.elevesAjour);
    sheet1.cell('A10').value('Élèves en retard:');
    sheet1.cell('B10').value(overview.elevesRetard);
    sheet1.cell('A11').value('Montant total payé (USD):');
    sheet1.cell('B11').value(overview.montantTotalPaye);

    sheet1.column('A').width(30);
    sheet1.column('B').width(20);

    const sheet2 = workbook.addSheet('Détail Classes');
    const headers = ['Classe', 'Niveau', 'Effectif', 'Retards', 'Payé (USD)', 'Impayé (USD)', 'Taux %'];

    headers.forEach((h, i) => {
      sheet2.cell(1, i + 1).value(h).style({
        bold: true,
        fill: '4472C4',
        fontColor: 'FFFFFF',
        horizontalAlignment: 'center'
      });
    });

    classesStats.forEach((c, rowIdx) => {
      const row = rowIdx + 2;
      sheet2.cell(row, 1).value(c.nom);
      sheet2.cell(row, 2).value(c.niveau || '');
      sheet2.cell(row, 3).value(c.effectif || 0);
      sheet2.cell(row, 4).value(c.elevesRetard || 0);
      sheet2.cell(row, 5).value(c.totalPaye || 0);
      sheet2.cell(row, 6).value(c.totalImpaye || 0);
      sheet2.cell(row, 7).value(parseFloat((c.taux || 0).toFixed(1)));

      const taux = c.taux || 0;
      let color = 'FFC7CE';
      if (taux >= 80) color = 'C6EFCE';
      else if (taux >= 50) color = 'FFEB9C';
      sheet2.cell(row, 7).style({ fill: color });
    });

    sheet2.column(1).width(25);
    sheet2.column(2).width(15);
    sheet2.column(3).width(12);
    sheet2.column(4).width(12);
    sheet2.column(5).width(15);
    sheet2.column(6).width(15);
    sheet2.column(7).width(10);

    const fileName = `rapport-classes-${annee}-${Date.now()}.xlsx`;
    const buffer = await workbook.outputAsync();

    console.log(`✅ Excel généré: ${fileName} (${buffer.length} bytes)`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.send(buffer);

  } catch (err) {
    console.error('❌ Export Excel error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erreur export Excel: ' + err.message
      });
    }
  }
};

/**
 * GET /api/percepteur/rapport-classes/export-pdf
 */
exports.exportPDF = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const percepteur = req.user;
    const annee = anneeScolaire || ANNEE_SCOLAIRE_DEFAUT;

    const classes = await Classe.find({ isActive: true })
      .select('nom niveau effectif')
      .lean();

    const fileName = `rapport-classes-${annee}-${Date.now()}.pdf`;
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('📊 RAPPORT CLASSES');
    doc.moveDown();
    doc.fontSize(12).font('Helvetica');
    doc.text(`Année: ${annee}`);
    doc.text(`Percepteur: ${percepteur.fullName || percepteur.email || 'Inconnu'}`);
    doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`);

    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('Statistiques Globales');
    const effectifTotal = classes.reduce((sum, c) => sum + (c.effectif || 0), 0);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Nombre de classes: ${classes.length}`);
    doc.text(`Effectif total: ${effectifTotal}`);

    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('Détail des Classes');
    doc.moveDown();

    const headers = ['Classe', 'Niveau', 'Effectif'];
    const colWidths = [220, 120, 100];
    const rowHeight = 20;

    let y = doc.y;
    let x = 40;

    doc.fontSize(10).font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, x, y, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    });

    y += rowHeight;
    doc.strokeColor('#CCCCCC').moveTo(40, y).lineTo(540, y).stroke();

    doc.font('Helvetica').fontSize(9);
    classes.forEach(classe => {
      y += rowHeight;
      x = 40;
      if (y > 750) {
        doc.addPage();
        y = 60;
      }
      doc.text(classe.nom, x, y, { width: colWidths[0] });
      x += colWidths[0];
      doc.text(classe.niveau || '', x, y, { width: colWidths[1] });
      x += colWidths[1];
      doc.text((classe.effectif || 0).toString(), x, y, { width: colWidths[2], align: 'right' });
      doc.strokeColor('#EEEEEE').moveTo(40, y + rowHeight - 5).lineTo(540, y + rowHeight - 5).stroke();
    });

    doc.end();

    console.log(`✅ PDF généré: ${fileName}`);

  } catch (err) {
    console.error('❌ Export PDF error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erreur export PDF: ' + err.message
      });
    }
  }
};

module.exports = exports;
