console.log('🔥🔥🔥 NOUVEAU CODE CHARGÉ - percepteurClasseDetailController.js 🔥🔥🔥');

/************************************************************
 📊 CONTROLLER DÉTAIL CLASSE - PERCEPTEUR
 Collège Le Mérite - Backend Node.js
 Gabkut Agency LMK +243822783500
*************************************************************/

const path = require('path');
const fs = require('fs');
const Classe = require('../../models/Classe');
const Eleve = require('../../models/Eleve');
const Paiement = require('../../models/Paiement');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const ANNEE_SCOLAIRE_DEFAUT = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';

/**
 * GET /api/percepteur/classes/:id/detail
 * Détail complet d'une classe avec stats et liste élèves
 */
exports.getClasseDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { anneeScolaire } = req.query;
    const annee = anneeScolaire || ANNEE_SCOLAIRE_DEFAUT;

    console.log(`📊 GET /classes/${id}/detail - Année: ${annee}`);

    // 1️⃣ Récupérer la classe
    const classe = await Classe.findById(id).lean();
    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe non trouvée'
      });
    }

    // 2️⃣ Récupérer les élèves avec leurs champs totalPaye et resteAPayer
    const eleves = await Eleve.find({
      classe: id,
      anneeScolaire: annee,
      isActive: true
    })
      .select('nom prenom postnom matricule codeEleve code totalPaye resteAPayer')
      .lean();

    console.log(`👨‍🎓 ${eleves.length} élèves trouvés pour la classe ${classe.nom}`);

    // 3️⃣ Récupérer les paiements - TOUS LES CHAMPS pour debug
    const eleveIds = eleves.map(e => e._id);
    const paiements = await Paiement.find({
      eleveId: { $in: eleveIds },
      anneeConcernee: annee,
      statut: 'validé'
    })
      .lean(); // ⬅️ ENLEVER .select() pour récupérer TOUS les champs

    console.log(`💳 ${paiements.length} paiements trouvés`);
    if (paiements.length > 0) {
      console.log('🔍 Premier paiement (debug):', paiements[0]);
    }

    // 4️⃣ Créer une MAP des paiements par élève et par mois
    const mapPaiements = {};
    paiements.forEach(p => {
      const key = p.eleveId?.toString();
      if (!key) return;

      if (!mapPaiements[key]) {
        mapPaiements[key] = { total: 0, mois: {} };
      }
      mapPaiements[key].total += p.montant || 0;

      // ⬇️ Chercher le champ qui contient le mois (peut être 'mois', 'moisConcerne', 'periode', etc.)
      const moisField = p.mois || p.moisConcerne || p.periode || p.moisPaiement;
      if (moisField) {
        mapPaiements[key].mois[moisField] =
          (mapPaiements[key].mois[moisField] || 0) + (p.montant || 0);
      }
    });

    // 5️⃣ Log pour debug
    if (eleves.length > 0) {
      const premier = eleves[0];
      const premierKey = premier._id.toString();
      console.log('Exemple élève:', {
        nom: premier.nom,
        totalPaye_BDD: premier.totalPaye,
        resteAPayer_BDD: premier.resteAPayer,
        paiements_calcules: mapPaiements[premierKey]?.total || 0,
        mois: mapPaiements[premierKey]?.mois || {}
      });
    }

    // 6️⃣ Enrichir avec les stats
    const montantFrais = classe.montantFrais || 0;

    const elevesAvecStats = eleves.map(e => {
      const eleveKey = e._id.toString();
      const pData = mapPaiements[eleveKey] || { total: 0, mois: {} };

      const totalPaye = e.totalPaye !== undefined ? e.totalPaye : pData.total;
      const resteAPayer = e.resteAPayer !== undefined 
        ? e.resteAPayer 
        : Math.max(0, montantFrais - totalPaye);

      const taux = montantFrais > 0 ? (totalPaye / montantFrais) * 100 : 0;

      const parts = [];
      if (e.nom) parts.push(e.nom);
      if (e.prenom) parts.push(e.prenom);
      if (e.postnom) parts.push(e.postnom);
      const nomComplet = parts.join(' ');

      return {
        _id: e._id,
        nom: e.nom,
        prenom: e.prenom,
        nomComplet,
        matricule: e.matricule,
        code: e.codeEleve || e.code || '',
        montantAttendu: montantFrais,
        totalPaye,
        resteAPayer,
        taux,
        statut: resteAPayer <= 0 ? 'À jour' : 'En retard',
        paiementsMois: pData.mois
      };
    });

    // 7️⃣ Stats globales de la classe
    const totalAttendu = elevesAvecStats.length * montantFrais;
    const totalPaye = elevesAvecStats.reduce((sum, e) => sum + (e.totalPaye || 0), 0);
    const totalImpaye = elevesAvecStats.reduce((sum, e) => sum + (e.resteAPayer || 0), 0);
    const elevesAjour = elevesAvecStats.filter(e => e.resteAPayer <= 0).length;
    const elevesRetard = elevesAvecStats.filter(e => e.resteAPayer > 0).length;
    const tauxRecouvrement = totalAttendu > 0 ? (totalPaye / totalAttendu) * 100 : 0;

    console.log(`💰 Stats calculées - Total payé: ${totalPaye}, Total reste: ${totalImpaye}`);

    res.json({
      success: true,
      classe: {
        _id: classe._id,
        nom: classe.nom,
        niveau: classe.niveau,
        montantFrais: classe.montantFrais,
        effectif: classe.effectif || elevesAvecStats.length
      },
      anneeScolaire: annee,
      stats: {
        totalAttendu,
        totalPaye,
        totalImpaye,
        elevesAjour,
        elevesRetard,
        tauxRecouvrement,
        nombreEleves: elevesAvecStats.length
      },
      eleves: elevesAvecStats
    });

  } catch (err) {
    console.error('❌ Erreur getClasseDetail:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: err.message
    });
  }
};

/**
 * GET /api/percepteur/classes/:id/detail-export-excel
 */
exports.exportClasseExcel = async (req, res) => {
  try {
    const classeId = req.params.id;
    const annee = req.query.anneeScolaire || ANNEE_SCOLAIRE_DEFAUT;

    const {
      moisFiltres,
      seuilFaible,
      seuilExclusion,
      segment
    } = req.query;

    const classe = await Classe.findById(classeId).lean();
    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable'
      });
    }

    const eleves = await Eleve.find({
      anneeScolaire: annee,
      classe: classeId,
      isActive: true
    })
      .select('nom prenom postnom codeEleve code totalPaye resteAPayer')
      .lean();

    const eleveIds = eleves.map(e => e._id);
    const paiements = await Paiement.find({
      eleveId: { $in: eleveIds },
      anneeConcernee: annee,
      statut: 'validé'
    })
      .lean(); // ⬅️ TOUS LES CHAMPS

    const mapPaiements = {};
    paiements.forEach(p => {
      const key = p.eleveId.toString();
      if (!mapPaiements[key]) {
        mapPaiements[key] = { total: 0, mois: {} };
      }
      mapPaiements[key].total += p.montant || 0;

      const moisField = p.mois || p.moisConcerne || p.periode || p.moisPaiement;
      if (moisField) {
        mapPaiements[key].mois[moisField] =
          (mapPaiements[key].mois[moisField] || 0) + (p.montant || 0);
      }
    });

    const montantFrais = classe.montantFrais || 0;
    const moisListe = moisFiltres ? moisFiltres.split(',').filter(m => m) : [];
    const nbMoisActifs = moisListe.length;

    console.log('📊 Export Excel avec', nbMoisActifs, 'mois:', moisListe);

    let elevesAExporter = eleves.map(e => {
      const parts = [];
      if (e.nom) parts.push(e.nom);
      if (e.prenom) parts.push(e.prenom);
      if (e.postnom) parts.push(e.postnom);
      const nomComplet = parts.join(' ');

      const pData = mapPaiements[e._id.toString()] || { total: 0, mois: {} };

      if (nbMoisActifs === 0) {
        return {
          nomComplet,
          code: e.codeEleve || e.code || '',
          montantAttendu: 0,
          totalPaye: 0,
          resteAPayer: 0,
          paiementsMois: pData.mois
        };
      }

      const mensualiteUnitaire = montantFrais / 10;
      const attenduFiltre = nbMoisActifs < 10 
        ? mensualiteUnitaire * nbMoisActifs 
        : montantFrais;

      let payeFiltre = 0;
      moisListe.forEach(mois => {
        payeFiltre += (pData.mois && pData.mois[mois]) ? pData.mois[mois] : 0;
      });

      return {
        nomComplet,
        code: e.codeEleve || e.code || '',
        montantAttendu: attenduFiltre,
        totalPaye: payeFiltre,
        resteAPayer: Math.max(0, attenduFiltre - payeFiltre),
        paiementsMois: pData.mois
      };
    });

    if (segment === 'rien') {
      elevesAExporter = elevesAExporter.filter(e => e.totalPaye <= 0.0001);
    } else if (segment === 'deja') {
      elevesAExporter = elevesAExporter.filter(e => e.totalPaye > 0);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Collège Le Mérite - Gabkut Agency';
    workbook.created = new Date();

    const sheet1 = workbook.addWorksheet('Résumé');
    sheet1.getColumn(1).width = 32;
    sheet1.getColumn(2).width = 24;

    sheet1.mergeCells('A1:B1');
    sheet1.getCell('A1').value = 'ANALYSE CLASSE';
    sheet1.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1F4E79' } };
    sheet1.getCell('A1').alignment = { horizontal: 'center' };
    sheet1.getRow(1).height = 28;

    sheet1.addRow([]);
    sheet1.addRow(['Classe', classe.nom]);
    sheet1.addRow(['Niveau', classe.niveau || '']);
    sheet1.addRow(['Année scolaire', annee]);
    sheet1.addRow(['Frais / élève', `${classe.montantFrais} USD`]);
    sheet1.addRow(['Effectif total', classe.effectif]);
    sheet1.addRow(['Effectif filtré', elevesAExporter.length]);

    sheet1.addRow([]);
    sheet1.addRow(['FILTRES APPLIQUÉS', '']);
    sheet1.getRow(sheet1.rowCount).font = { bold: true, size: 12, color: { argb: 'FF3B82F6' } };

    if (nbMoisActifs > 0) {
      sheet1.addRow(['Mois inclus', `${nbMoisActifs} mois : ${moisFiltres.replace(/,/g, ', ')}`]);
      sheet1.addRow(['Calcul attendu', `Frais total / 10 × ${nbMoisActifs} mois`]);
    } else {
      sheet1.addRow(['Mois inclus', 'AUCUN MOIS SÉLECTIONNÉ']);
      sheet1.addRow(['Calcul attendu', '0 USD (aucun mois actif)']);
    }

    if (seuilFaible) {
      sheet1.addRow(['Seuil faible paiement', `${seuilFaible}%`]);
    }
    if (seuilExclusion) {
      sheet1.addRow(['Seuil exclusion', `${seuilExclusion}%`]);
    }
    if (segment) {
      const segmentLabel = 
        segment === 'rien' ? 'Rien payé' :
        segment === 'deja' ? 'Déjà payé' : 'Tous les élèves';
      sheet1.addRow(['Segment', segmentLabel]);
    }

    let totalAttendu = 0;
    let totalPaye = 0;
    let totalReste = 0;
    elevesAExporter.forEach(e => {
      totalAttendu += e.montantAttendu;
      totalPaye += e.totalPaye;
      totalReste += e.resteAPayer;
    });
    const taux = totalAttendu > 0 ? (totalPaye / totalAttendu) * 100 : 0;

    sheet1.addRow([]);
    sheet1.addRow(['STATISTIQUES', '']);
    sheet1.getRow(sheet1.rowCount).font = { bold: true, size: 12, color: { argb: 'FF10B981' } };
    sheet1.addRow(['Montant attendu total', totalAttendu]);
    sheet1.addRow(['Montant payé total', totalPaye]);
    sheet1.addRow(['Montant restant', totalReste]);
    sheet1.addRow(['Taux de paiement', `${taux.toFixed(1)} %`]);

    for (let i = 3; i <= sheet1.rowCount; i++) {
      const row = sheet1.getRow(i);
      row.getCell(1).font = { bold: true };
      row.getCell(2).alignment = { horizontal: 'right' };
    }

    const sheet2 = workbook.addWorksheet('Élèves');
    sheet2.columns = [
      { header: 'Élève (Nom complet)', key: 'eleve', width: 40 },
      { header: 'Code', key: 'code', width: 16 },
      { header: 'Montant attendu', key: 'attendu', width: 18 },
      { header: 'Montant payé', key: 'paye', width: 18 },
      { header: 'Reste à payer', key: 'reste', width: 18 },
      { header: 'Taux %', key: 'taux', width: 10 },
      { header: 'Statut', key: 'statut', width: 18 }
    ];

    const headerRow2 = sheet2.getRow(1);
    headerRow2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow2.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow2.height = 22;

    elevesAExporter.forEach(e => {
      const attendu = e.montantAttendu;
      const paye = e.totalPaye;
      const reste = e.resteAPayer;
      const tauxEleve = attendu > 0 ? (paye / attendu) * 100 : 0;

      let statut = 'À jour';
      if (reste > 0) statut = 'En retard';
      if (seuilFaible && tauxEleve < parseFloat(seuilFaible)) statut = 'Faible paiement';
      if (seuilExclusion && tauxEleve < parseFloat(seuilExclusion)) statut = 'À exclure';

      sheet2.addRow({
        eleve: e.nomComplet || '',
        code: e.code || '',
        attendu,
        paye,
        reste,
        taux: tauxEleve,
        statut
      });
    });

    sheet2.getColumn('attendu').numFmt = '#,##0.00 "USD"';
    sheet2.getColumn('paye').numFmt = '#,##0.00 "USD"';
    sheet2.getColumn('reste').numFmt = '#,##0.00 "USD"';

    for (let i = 2; i <= sheet2.rowCount; i++) {
      const cellTaux = sheet2.getRow(i).getCell('taux');
      const v = cellTaux.value || 0;
      let color = 'FFC6EFCE';
      if (v < 50) color = 'FFFFEB9C';
      if (v < 30) color = 'FFFFC7CE';
      cellTaux.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color }
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `classe-${classe.nom}-${annee}-${Date.now()}.xlsx`.replace(/\s+/g, '_');

    console.log(`✅ Excel généré: ${fileName} (${buffer.length} bytes)`);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );
    res.setHeader('Content-Length', buffer.length);

    return res.send(buffer);

  } catch (err) {
    console.error('❌ ExportClasseExcel error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erreur export Excel: ' + err.message
      });
    }
  }
};

/**
 * GET /api/percepteur/classes/:id/detail-export-pdf
 */
exports.exportClassePDF = async (req, res) => {
  try {
    const classeId = req.params.id;
    const annee = req.query.anneeScolaire || ANNEE_SCOLAIRE_DEFAUT;
    const { moisFiltres, segment } = req.query;

    const classe = await Classe.findById(classeId).lean();
    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable'
      });
    }

    const eleves = await Eleve.find({
      anneeScolaire: annee,
      classe: classeId,
      isActive: true
    })
      .select('nom prenom postnom codeEleve code totalPaye resteAPayer')
      .lean();

    let elevesAExporter = eleves.map(e => {
      const parts = [];
      if (e.nom) parts.push(e.nom);
      if (e.prenom) parts.push(e.prenom);
      if (e.postnom) parts.push(e.postnom);
      const nomComplet = parts.join(' ');

      return {
        nomComplet,
        code: e.codeEleve || e.code || '',
        totalPaye: e.totalPaye || 0,
        resteAPayer: e.resteAPayer || 0,
        montantAttendu: classe.montantFrais || 0
      };
    });

    if (segment === 'rien') {
      elevesAExporter = elevesAExporter.filter(e => e.totalPaye <= 0.0001);
    } else if (segment === 'deja') {
      elevesAExporter = elevesAExporter.filter(e => e.totalPaye > 0);
    }

    const fileName = `classe-${classe.nom}-${annee}-${Date.now()}.pdf`.replace(/\s+/g, '_');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    doc.fontSize(16).fillColor('#1F2937').text('Analyse détaillée de la classe', {
      align: 'center'
    });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#111827')
      .text(`Classe : ${classe.nom}`, { align: 'center' });
    doc.text(`Année scolaire : ${annee}`, { align: 'center' });
    doc.moveDown();

    let totalAttendu = 0;
    let totalPaye = 0;
    let totalReste = 0;
    elevesAExporter.forEach(e => {
      totalAttendu += e.montantAttendu;
      totalPaye += e.totalPaye;
      totalReste += e.resteAPayer;
    });
    const taux = totalAttendu > 0 ? (totalPaye / totalAttendu) * 100 : 0;

    doc.fontSize(11);
    doc.text(`Effectif filtré : ${elevesAExporter.length}`);
    doc.text(`Montant attendu total : ${totalAttendu.toFixed(2)} USD`);
    doc.text(`Montant payé total : ${totalPaye.toFixed(2)} USD`);
    doc.text(`Taux de paiement : ${taux.toFixed(1)} %`);
    doc.moveDown();

    const startY = doc.y;
    const colX = [40, 250, 340, 400, 460];

    doc.fontSize(9).fillColor('#111827');
    doc.text('Élève', colX[0], startY);
    doc.text('Code', colX[1], startY);
    doc.text('Payé', colX[2], startY);
    doc.text('Reste', colX[3], startY);
    doc.text('Taux', colX[4], startY);
    doc.moveTo(40, startY + 12).lineTo(550, startY + 12).stroke();

    let y = startY + 16;
    elevesAExporter.forEach(e => {
      if (y > 750) {
        doc.addPage();
        y = 40;
      }
      const paye = e.totalPaye;
      const reste = e.resteAPayer;
      const tauxEleve = e.montantAttendu > 0 ? (paye / e.montantAttendu) * 100 : 0;

      doc.fontSize(8).text(e.nomComplet || '', colX[0], y, { width: 200 });
      doc.text(e.code || '', colX[1], y);
      doc.text(paye.toFixed(2), colX[2], y);
      doc.text(reste.toFixed(2), colX[3], y);
      doc.text(tauxEleve.toFixed(1) + '%', colX[4], y);

      y += 12;
    });

    doc.end();

    console.log(`✅ PDF généré: ${fileName}`);

  } catch (err) {
    console.error('❌ ExportClassePDF error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erreur export PDF: ' + err.message
      });
    }
  }
};
