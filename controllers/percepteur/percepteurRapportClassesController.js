/************************************************************
 📊 CONTROLLER RAPPORT CLASSES - PERCEPTEUR VERSION COMPLÈTE
 Collège Le Mérite - Backend Node.js - Gabkut Agency LMK
 +243822783500

 ✅ Rapport classes avec élèves et paiements
 ✅ Filtres (classe, niveau, statut, affichage)
 ✅ Tris (nom, effectif, taux, dette, retards)
 ✅ Export Excel multi-onglets (Résumé + Détail Classes + Élèves)
 ✅ Export PDF (tableau groupé par classe)
 ✅ Export Word (DOCX avec tableaux professionnels)
*************************************************************/

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, AlignmentType, BorderStyle, WidthType, convertInchesToTwip } = require('docx');


const Paiement = require('../../models/Paiement');
const Eleve = require('../../models/Eleve');
const Classe = require('../../models/Classe');

const ANNEE_SCOLAIRE_DEFAUT = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';

/* ============================================================
   📊 GET /api/percepteur/rapport-classes
   Rapport complet avec élèves et paiements
============================================================ */

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

/* ============================================================
   📊 FONCTION UTILITAIRE - Récupérer données rapport pour exports
============================================================ */

async function getDataRapportPourExport(req) {
  const { anneeScolaire, classeId, niveau, statut } = req.query;
  const annee = anneeScolaire || ANNEE_SCOLAIRE_DEFAUT;

  const classes = await Classe.find({ isActive: true })
    .select('nom niveau montantFrais effectif _id')
    .lean();

  const eleves = await Eleve.find({
    anneeScolaire: annee,
    isActive: true
  })
    .select('classe nom prenom postnom totalPaye resteAPayer _id')
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

    const elevesAvecPaiements = elevesClasse.map(e => {
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

      return {
        ...e,
        totalPaye: paye,
        resteAPayer: reste
      };
    });

    const taux = totalAttendu > 0 ? (totalPaye / totalAttendu) * 100 : 0;

    return {
      nom: c.nom,
      niveau: c.niveau,
      id: c._id,
      effectif: elevesClasse.length,
      montantFrais,
      totalAttendu,
      totalPaye,
      totalImpaye,
      elevesAjour,
      elevesRetard,
      taux,
      eleves: elevesAvecPaiements
    };
  });

  if (classeId) {
    classesStats = classesStats.filter(c => c.id?.toString() === classeId);
  }
  if (niveau) {
    classesStats = classesStats.filter(c => c.niveau === niveau);
  }

  return classesStats;
}

/* ============================================================
   📊 Export Excel - Multi-onglets COMPLET
   Onglet 1: Résumé Global
   Onglet 2: Détail Classes
   Onglet 3: Élèves par Classe
============================================================ */

exports.exportExcel = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const percepteur = req.user;
    const annee = anneeScolaire || ANNEE_SCOLAIRE_DEFAUT;

    console.log(`📤 Export Excel - Année: ${annee}`);

    const classesStats = await getDataRapportPourExport(req);

    const workbook = new ExcelJS.Workbook();
    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const fileName = `Rapport_Classes_${annee}_${dateStr}.xlsx`;

    // =========================
    // FEUILLE 1 : RÉSUMÉ GLOBAL
    // =========================
    const wsResume = workbook.addWorksheet('Résumé', {
      views: [{ state: 'frozen', ySplit: 3 }]
    });

    wsResume.mergeCells('A1:F1');
    const titre = wsResume.getCell('A1');
    titre.value = `📊 RAPPORT CLASSES - ${annee}`;
    titre.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
    titre.alignment = { horizontal: 'center', vertical: 'middle' };

    wsResume.mergeCells('A2:F2');
    const sousTitre = wsResume.getCell('A2');
    sousTitre.value = `Export du ${dateStr} - Percepteur: ${percepteur.fullName || percepteur.email}`;
    sousTitre.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
    sousTitre.alignment = { horizontal: 'right' };

    // Stats globales
    const totalClasses = classesStats.length;
    const totalEleves = classesStats.reduce((sum, c) => sum + (c.effectif || 0), 0);
    const totalAJour = classesStats.reduce((sum, c) => sum + (c.elevesAjour || 0), 0);
    const totalRetard = classesStats.reduce((sum, c) => sum + (c.elevesRetard || 0), 0);
    const totalDu = classesStats.reduce((sum, c) => sum + (c.totalAttendu || 0), 0);
    const totalPaye = classesStats.reduce((sum, c) => sum + (c.totalPaye || 0), 0);
    const soldeGlobal = Math.max(0, totalDu - totalPaye);
    const tauxGlobal = totalDu > 0 ? (totalPaye / totalDu) * 100 : 0;

    let row = 4;
    wsResume.getRow(row).values = ['STATISTIQUES GLOBALES'];
    wsResume.getRow(row).font = { bold: true, size: 11 };
    row++;

    const statsData = [
      ['Nombre de classes', totalClasses],
      ['Effectif total', totalEleves],
      ['Élèves à jour', totalAJour],
      ['Élèves en retard', totalRetard],
      ['Montant total dû', totalDu],
      ['Montant total payé', totalPaye],
      ['Solde global', soldeGlobal],
      ['Taux paiement global (%)', tauxGlobal]
    ];

    statsData.forEach(([label, value]) => {
      wsResume.getRow(row).values = [label, value];
      wsResume.getRow(row).getCell(1).font = { bold: true };
      wsResume.getRow(row).getCell(2).numFmt = typeof value === 'number' && value > 100 ? '#,##0.00' : 'General';
      row++;
    });

    wsResume.column('A').width = 30;
    wsResume.column('B').width = 20;

    // =========================
    // FEUILLE 2 : DÉTAIL CLASSES
    // =========================
    const wsClasses = workbook.addWorksheet('Détail Classes', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    wsClasses.columns = [
      { header: 'Classe', key: 'nom', width: 18 },
      { header: 'Niveau', key: 'niveau', width: 14 },
      { header: 'Effectif', key: 'effectif', width: 10 },
      { header: 'À jour', key: 'elevesAjour', width: 10 },
      { header: 'En retard', key: 'elevesRetard', width: 12 },
      { header: 'Montant dû', key: 'totalAttendu', width: 15 },
      { header: 'Payé', key: 'totalPaye', width: 15 },
      { header: 'Solde', key: 'totalImpaye', width: 15 },
      { header: 'Taux %', key: 'taux', width: 10 }
    ];

    const headerRow = wsClasses.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    classesStats.forEach(c => {
      wsClasses.addRow({
        nom: c.nom,
        niveau: c.niveau || '',
        effectif: c.effectif || 0,
        elevesAjour: c.elevesAjour || 0,
        elevesRetard: c.elevesRetard || 0,
        totalAttendu: c.totalAttendu || 0,
        totalPaye: c.totalPaye || 0,
        totalImpaye: c.totalImpaye || 0,
        taux: Number((c.taux || 0).toFixed(1))
      });
    });

    wsClasses.columns.forEach(col => {
      col.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    ['totalAttendu', 'totalPaye', 'totalImpaye'].forEach(key => {
      wsClasses.getColumn(key).numFmt = '#,##0.00';
    });
    wsClasses.getColumn('taux').numFmt = '0.0';

    // =========================
    // FEUILLE 3 : ÉLÈVES PAR CLASSE
    // =========================
    const wsEleves = workbook.addWorksheet('Élèves par Classe', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    wsEleves.columns = [
      { header: 'Classe', key: 'classe', width: 16 },
      { header: 'Niveau', key: 'niveau', width: 12 },
      { header: 'Nom', key: 'nom', width: 18 },
      { header: 'Prénom', key: 'prenom', width: 18 },
      { header: 'Postnom', key: 'postnom', width: 18 },
      { header: 'Montant dû', key: 'attendu', width: 14 },
      { header: 'Payé', key: 'paye', width: 14 },
      { header: 'Solde', key: 'reste', width: 14 },
      { header: 'Statut', key: 'statut', width: 12 }
    ];

    const headerEleves = wsEleves.getRow(1);
    headerEleves.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerEleves.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D4ED8' }
    };

    classesStats.forEach(classe => {
      classe.eleves?.forEach(e => {
        const statut = e.resteAPayer <= 0 ? '✓ À jour' : '✗ Retard';
        wsEleves.addRow({
          classe: classe.nom,
          niveau: classe.niveau,
          nom: e.nom || '',
          prenom: e.prenom || '',
          postnom: e.postnom || '',
          attendu: classe.montantFrais || 0,
          paye: e.totalPaye || 0,
          reste: e.resteAPayer || 0,
          statut
        });
      });
    });

    ['attendu', 'paye', 'reste'].forEach(key => {
      wsEleves.getColumn(key).numFmt = '#,##0.00';
    });

    // Métadonnées et envoi
    workbook.creator = 'Gabkut-École';
    workbook.created = new Date();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Excel généré: ${fileName}`);

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



// === COULEURS PREMIUM ===
const COLORS = {
  primary: 'FF1F527F',      // Bleu foncé
  accent: 'FF32B898',       // Teal
  success: 'FF27AE60',      // Vert
  warning: 'FFF39C12',      // Orange
  danger: 'FFE74C3C',       // Rouge
  lightBg: 'FFF5F5F5',      // Gris clair
  darkBg: 'FF2C3E50',       // Gris foncé
  gold: 'FFD4AF37',         // Or (premium)
};

/**
 * 🎯 Export Excel Premium V3
 * Génère un workbook riche avec 5 onglets et visuels premium
 */

    // =========== RÉCUPÉRATION DONNÉES ===========
    // ============================================================
// 🏆 EXPORT EXCEL PREMIUM V3 - RAPPORT CLASSES
// ============================================================
// ============================================================
// 🏆 EXPORT EXCEL PREMIUM V3 - RAPPORT CLASSES
// ============================================================

exports.exportExcelPremiumV3 = async (req, res) => {
  try {
    const { anneeScolaire, classeId, niveau, statut } = req.query;
    const percepteur = req.user;
    const annee = anneeScolaire || ANNEESCOLAIREDEFAUT;

    console.log('Export Excel PREMIUM V3 - Année', annee);

    // 1️⃣ RÉCUPÉRATION DONNÉES BRUTES
    const classes = await Classe.find({ isActive: true })
      .select('nom niveau montantFrais effectif')
      .lean();

    const eleves = await Eleve.find({
      anneeScolaire: annee,
      statut: 'actif'       // ⬅️ important: correspond à ta DB
      // si tu veux prévoir les deux:  $or: [{ isActive: true }, { statut: 'actif' }]
    })
      .select(
        'classe nom prenom postnom totalPaye resteAPayer montantDu montantPaye dateInscription dateCreation email emailEleve'
      )
      .lean();

    const eleveIds = eleves.map(e => e._id);
    const paiements = await Paiement.find({
      eleveId: { $in: eleveIds },
      anneeConcernee: annee,
      statut: 'valid'
    })
      .select('eleveId montant datePaiement')
      .lean();

    // 2️⃣ MAPPING ÉLÈVES + PAIEMENTS PAR CLASSE (clé = e.classe.toString())
    const elevesMap = {};
    const elevesWithStats = [];

    eleves.forEach(e => {
      if (!e.classe) return; // ObjectId brut
      const key = e.classe.toString(); // ex: 694fbfa9f685b7075b62d0f6

      if (!elevesMap[key]) {
        elevesMap[key] = [];
      }

      const pData = paiements.filter(
        p => p.eleveId?.toString() === e._id.toString()
      );

      const totalPayePaiements = pData.reduce(
        (sum, p) => sum + (p.montant || 0),
        0
      );

      const dateLastPayment =
        pData.length > 0
          ? new Date(
              Math.max(
                ...pData
                  .map(p => p.datePaiement && new Date(p.datePaiement).getTime())
                  .filter(Boolean)
              )
            )
          : null;

      const totalPayeBase = e.totalPaye || e.montantPaye || 0;
      const montantDuBase = e.montantDu || 0;
      const totalPayeReal = Math.max(totalPayeBase, totalPayePaiements);
      const resteAPayerBase =
        e.resteAPayer ||
        Math.max(0, montantDuBase - totalPayeReal);

      const elev = {
        ...e,
        id: e._id.toString(),
        classeId: key,
        totalPayeReal,
        dateLastPayment,
        paymentCount: pData.length,
        riskLevel: calculateRiskLevel(totalPayeReal, resteAPayerBase)
      };

      elevesMap[key].push(elev);
      elevesWithStats.push(elev);
    });

    // 3️⃣ STATS PAR CLASSE (avec liste d’élèves pour les onglets détail)
    let classesStats = classes.map(c => {
      const key = (c._id || c.id).toString(); // même forme que e.classe.toString()
      const elevesClasse = elevesMap[key] || [];
      const montantFrais = c.montantFrais || 0;

      let totalAttendu = 0;
      let totalPaye = 0;
      let totalImpaye = 0;
      let elevesAjour = 0;
      let elevesRetard = 0;
      let elevesCritiques = 0;
      let avgTauxClasse = 0;

      elevesClasse.forEach(e => {
        const attendu = montantFrais || e.montantDu || 0;
        const paye = e.totalPayeReal || 0;
        const reste = Math.max(0, attendu - paye);

        totalAttendu += attendu;
        totalPaye += paye;
        totalImpaye += reste;

        const tauxIndividuel = attendu > 0 ? (paye / attendu) * 100 : 0;
        avgTauxClasse += tauxIndividuel;

        if (reste <= 0 || tauxIndividuel >= 100) elevesAjour++;
        else elevesRetard++;

        if (tauxIndividuel < 30) elevesCritiques++;
      });

      const taux =
        totalAttendu > 0 ? (totalPaye / totalAttendu) * 100 : 0;
      avgTauxClasse =
        elevesClasse.length > 0 ? avgTauxClasse / elevesClasse.length : 0;

      const statutClasse =
        taux >= 80 ? 'BON' : taux >= 50 ? 'MOYEN' : 'CRITIQUE';
      const tendance = calculateTendance(taux);

      return {
        id: key,
        nom: c.nom,
        niveau: c.niveau,
        effectif: elevesClasse.length,
        montantFrais,
        totalAttendu,
        totalPaye,
        totalImpaye,
        elevesAjour,
        elevesRetard,
        elevesCritiques,
        taux: Number(taux.toFixed(2)),
        avgTauxClasse: Number(avgTauxClasse.toFixed(2)),
        statutClasse,
        tendance,
        eleves: elevesClasse
      };
    });

    // 4️⃣ FILTRES (classe / niveau / statut)
    if (classeId) {
      classesStats = classesStats.filter(c => c.id === classeId);
    }

    if (niveau) {
      classesStats = classesStats.filter(c => c.niveau === niveau);
    }

    if (statut) {
      classesStats = classesStats.filter(c => {
        if (statut === 'critique') return c.taux < 50;
        if (statut === 'bon') return c.taux >= 80;
        return c.taux >= 50 && c.taux < 80;
      });
    }

    // 5️⃣ CRÉATION WORKBOOK + FEUILLES
    const workbook = new ExcelJS.Workbook();

    // Onglet 1 : Dashboard exécutif
    createDashboardSheet(workbook, classesStats, percepteur, annee);

    // Onglet 2 : Détail classes
    createDetailClassesSheet(workbook, classesStats);

    // Onglet 3 : Élèves détail (utilise classesStats[*].eleves)
    createElevesDetailSheet(workbook, classesStats);

    // Onglet 4 : Problématiques (utilise elevesWithStats + classesStats)
    createProblematiquesSheet(workbook, elevesWithStats, classesStats);

    // Onglet 5 : Prévisions
    createPrevisionsSheet(workbook, classesStats, annee);

    // 6️⃣ ENVOI
    const fileName = `Rapport-Classes-Premium-${annee}-${Date.now()}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${fileName}`
    );

    await workbook.xlsx.write(res);
    res.end();

    console.log('✅ Excel Premium V3 généré', fileName);
  } catch (err) {
    console.error('❌ Export Excel Premium V3 error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erreur export premium',
        error: err.message
      });
    }
  }
};



// ============================================
// 🎨 FEUILLE 1: DASHBOARD EXÉCUTIF
// ============================================
function createDashboardSheet(workbook, classesStats, percepteur, annee) {
  const sheet = workbook.addWorksheet('📊 Dashboard');
  sheet.pageSetup = { paperSize: 9, orientation: 'landscape' };

  // ========== EN-TÊTE PREMIUM ==========
  sheet.mergeCells('A1:H2'); // ✅
  const titleCell = sheet.getCell('A1');
  titleCell.value = '📊 RAPPORT CLASSES - DASHBOARD EXÉCUTIF';
  titleCell.style = {
    font: { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'medium', color: { argb: COLORS.gold } },
      left: { style: 'medium', color: { argb: COLORS.gold } },
      bottom: { style: 'medium', color: { argb: COLORS.gold } },
      right: { style: 'medium', color: { argb: COLORS.gold } }
    }
  };
  sheet.getRow(1).height = 35;

  // ========== INFOS DOCUMENT ==========
  sheet.getCell('A3').value = `Année scolaire: ${annee}`;
  sheet.getCell('B3').value = `Généré: ${new Date().toLocaleDateString('fr-FR')}`;
  sheet.getCell('C3').value = `Percepteur: ${percepteur.fullName || percepteur.email}`;

  // ========== OVERVIEW KPIs ==========
  const overview = {
    totalClasses: classesStats.length,
    totalEleves: classesStats.reduce((s, c) => s + c.effectif, 0),
    elevesAjour: classesStats.reduce((s, c) => s + c.elevesAjour, 0),
    elevesCritiques: classesStats.reduce((s, c) => s + c.elevesCritiques, 0),
    totalAttendu: classesStats.reduce((s, c) => s + c.totalAttendu, 0),
    totalPaye: classesStats.reduce((s, c) => s + c.totalPaye, 0),
    tauxGlobal: classesStats.length > 0 
      ? (classesStats.reduce((s, c) => s + c.totalPaye, 0) / classesStats.reduce((s, c) => s + c.totalAttendu, 0) * 100)
      : 0
  };

  // ========== KPI BOXES ==========
  const kpiRow = 5;
  const kpis = [
    { label: 'CLASSES', value: overview.totalClasses, col: 'A', color: COLORS.primary },
    { label: 'ÉLÈVES TOTAL', value: overview.totalEleves, col: 'C', color: COLORS.accent },
    { label: 'À JOUR ✅', value: overview.elevesAjour, col: 'E', color: COLORS.success },
    { label: 'CRITIQUES ⚠️', value: overview.elevesCritiques, col: 'G', color: COLORS.danger },
  ];

  kpis.forEach(kpi => {
    const cellLabel = sheet.getCell(`${kpi.col}${kpiRow}`);
    cellLabel.value = kpi.label;
    cellLabel.style = {
      font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    };

    const cellValue = sheet.getCell(`${kpi.col}${kpiRow + 1}`);
    cellValue.value = kpi.value;
    cellValue.style = {
      font: { size: 16, bold: true, color: { argb: kpi.color } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    };
  });

  // ========== TAUX GLOBAL PROMINENT ==========
  sheet.mergeCells('A8:H8');
  const tauxCell = sheet.getCell('A8');
  tauxCell.value = `📈 TAUX DE PAIEMENT GLOBAL: ${overview.tauxGlobal.toFixed(1)}%`;
  tauxCell.style = {
    font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: getTauxColor(overview.tauxGlobal) } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  // ========== TABLEAU RÉSUMÉ CLASSES ==========
  const tableRow = 10;
  const headers = ['CLASSE', 'NIVEAU', 'EFFECTIF', 'À JOUR', 'RETARD', 'MONTANT DÛ', 'PAYÉ (USD)', 'TAUX %', 'STATUS'];

  headers.forEach((h, idx) => {
    const cell = sheet.getCell(tableRow, idx + 1);
    cell.value = h;
    cell.style = {
      font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkBg } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    };
  });

  classesStats.forEach((c, idx) => {
    const row = tableRow + 1 + idx;
    const bgColor = idx % 2 === 0 ? COLORS.lightBg : 'FFFFFFFF';

    sheet.getCell(row, 1).value = c.nom;
    sheet.getCell(row, 2).value = c.niveau;
    sheet.getCell(row, 3).value = c.effectif;
    sheet.getCell(row, 4).value = c.elevesAjour;
    sheet.getCell(row, 5).value = c.elevesRetard;
    sheet.getCell(row, 6).value = c.totalImpaye;
    sheet.getCell(row, 7).value = c.totalPaye;
    
    const tauxCell = sheet.getCell(row, 8);
    tauxCell.value = c.taux;
    tauxCell.style = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: getTauxCellColor(c.taux) } },
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center' }
    };

    sheet.getCell(row, 9).value = c.statutClasse;

    // Appliquer style à toute la ligne
    for (let col = 1; col <= 9; col++) {
      const cell = sheet.getCell(row, col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    }
  });

  // ========== WIDTHS ==========
  sheet.columns = [
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
    { width: 14 },
    { width: 10 },
    { width: 12 }
  ];
}

// ============================================
// 📋 FEUILLE 2: DÉTAIL CLASSES RICHE
// ============================================
function createDetailClassesSheet(workbook, classesStats) {
  const sheet = workbook.addWorksheet('📋 Classes Détail');

  // En-tête
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = '📋 DÉTAIL COMPLET DES CLASSES';
  titleCell.style = {
    font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accent } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const headers = ['CLASSE', 'NIVEAU', 'EFFECTIF', 'À JOUR ✅', 'RETARDS ❌', 'CRITIQUES ⚠️', 'MONTANT DÛ (USD)', 'MONTANT PAYÉ (USD)', 'TAUX %'];

  headers.forEach((h, idx) => {
    const cell = sheet.getCell(3, idx + 1);
    cell.value = h;
    cell.style = {
      font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkBg } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { style: 'thin' }
    };
  });

  classesStats.forEach((c, idx) => {
    const row = 4 + idx;
    sheet.getCell(row, 1).value = c.nom;
    sheet.getCell(row, 2).value = c.niveau;
    sheet.getCell(row, 3).value = c.effectif;
    sheet.getCell(row, 4).value = c.elevesAjour;
    sheet.getCell(row, 5).value = c.elevesRetard;
    sheet.getCell(row, 6).value = c.elevesCritiques;
    sheet.getCell(row, 7).value = c.totalImpaye;
    sheet.getCell(row, 8).value = c.totalPaye;
    
    const tauxCell = sheet.getCell(row, 9);
    tauxCell.value = c.taux;
    tauxCell.numFmt = '0.00";%"';
    tauxCell.style = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: getTauxCellColor(c.taux) } },
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center' }
    };

    // Style ligne alternée
    for (let col = 1; col <= 9; col++) {
      const cell = sheet.getCell(row, col);
      cell.border = { style: 'thin', color: { argb: '00000000' } };
      if (idx % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
      }
    }
  });

  sheet.columns = [
    { width: 20 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 16 },
    { width: 12 }
  ];
}

// ============================================
// 👥 FEUILLE 3: ÉLÈVES DÉTAIL
// ============================================
function createElevesDetailSheet(workbook, classesStats) {
  const sheet = workbook.addWorksheet('👥 Élèves Détail');

  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = '👥 DÉTAIL DE TOUS LES ÉLÈVES';
  titleCell.style = {
    font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accent } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const headers = ['CLASSE', 'NIVEAU', 'NOM COMPLET', 'MONTANT DÛ (USD)', 'MONTANT PAYÉ (USD)', 'SOLDE (USD)', 'TAUX %', 'STATUT'];

  headers.forEach((h, idx) => {
    const cell = sheet.getCell(3, idx + 1);
    cell.value = h;
    cell.style = {
      font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkBg } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    };
  });

  let rowIdx = 4;
  classesStats.forEach(c => {
    c.eleves.forEach((e, eIdx) => {
      const montantDu = c.montantFrais || 0;
      const paye = e.totalPayeReal || 0;
      const solde = Math.max(0, montantDu - paye);
      const taux = (paye / montantDu) * 100;
      const statut = solde <= 0 ? '✅ À JOUR' : taux >= 50 ? '⚠️ PARTIAL' : '❌ CRITIQUE';

      sheet.getCell(rowIdx, 1).value = c.nom;
      sheet.getCell(rowIdx, 2).value = c.niveau;
      sheet.getCell(rowIdx, 3).value = `${e.nom} ${e.prenom}`.trim();
      sheet.getCell(rowIdx, 4).value = montantDu;
      sheet.getCell(rowIdx, 5).value = paye;
      sheet.getCell(rowIdx, 6).value = solde;
      
      const tauxCell = sheet.getCell(rowIdx, 7);
      tauxCell.value = taux;
      tauxCell.numFmt = '0.0";%"';
      tauxCell.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: getTauxCellColor(taux) } },
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        alignment: { horizontal: 'center' }
      };

      const statutCell = sheet.getCell(rowIdx, 8);
      statutCell.value = statut;
      statutCell.style = {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      };

      rowIdx++;
    });
  });

  sheet.columns = [
    { width: 18 },
    { width: 12 },
    { width: 22 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 10 },
    { width: 14 }
  ];
}

// ============================================
// ⚠️ FEUILLE 4: PROBLÉMATIQUES & ALERTES
// ============================================
function createProblematiquesSheet(workbook, elevesWithStats, classesStats) {
  const sheet = workbook.addWorksheet('⚠️ Problématiques');

  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = '⚠️ ÉLÈVES EN SITUATION CRITIQUE - ACTION REQUISE';
  titleCell.style = {
    font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.danger } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  // Élèves critiques : utiliser classeId ajouté dans exportExcelPremiumV3
  const elevesCritiques = elevesWithStats
    .map(e => {
      const classeData = classesStats.find(c => c.id === e.classeId);
      const montantDu = classeData?.montantFrais || e.montantDu || 0;
      const taux = montantDu > 0 ? (e.totalPayeReal / montantDu) * 100 : 0;
      return { e, classeData, montantDu, taux };
    })
    .filter(x => x.montantDu > 0 && x.taux < 30)
    .sort((a, b) => a.e.totalPayeReal - b.e.totalPayeReal);

  const headers = ['CLASSE', 'NOM COMPLET', 'EMAIL', 'PAYÉ (USD)', 'DÛ (USD)', 'RETARD (JOURS)', 'URGENCE'];

  headers.forEach((h, idx) => {
    const cell = sheet.getCell(3, idx + 1);
    cell.value = h;
    cell.style = {
      font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.danger } },
      alignment: { horizontal: 'center' }
    };
  });

  elevesCritiques.forEach((x, idx) => {
    const { e, classeData, montantDu } = x;
    const retard = e.dateCreation
      ? Math.floor((Date.now() - new Date(e.dateCreation)) / (1000 * 60 * 60 * 24))
      : 0;

    const row = 4 + idx;
    sheet.getCell(row, 1).value = classeData?.nom || 'N/A';
    sheet.getCell(row, 2).value = `${e.nom || ''} ${e.prenom || ''}`.trim();
    sheet.getCell(row, 3).value = e.email || e.emailEleve || '';
    sheet.getCell(row, 4).value = e.totalPayeReal || 0;
    sheet.getCell(row, 5).value = montantDu;
    sheet.getCell(row, 6).value = retard;

    const urgenceCell = sheet.getCell(row, 7);
    urgenceCell.value = retard > 90 ? '🔴 URGENT' : '🟡 ATTENTION';
    urgenceCell.style = {
      font: { bold: true, color: { argb: retard > 90 ? COLORS.danger : COLORS.warning } },
      alignment: { horizontal: 'center' }
    };
  });

  sheet.columns = [
    { width: 18 },
    { width: 22 },
    { width: 24 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 14 }
  ];
}


// ============================================
// 📈 FEUILLE 5: PRÉVISIONS & TENDANCES
// ============================================
function createPrevisionsSheet(workbook, classesStats, annee) {
  const sheet = workbook.addWorksheet('📈 Prévisions');

  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `📈 PRÉVISIONS & TENDANCES - ${annee}`;
  titleCell.style = {
    font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  sheet.getCell('A3').value = 'ANALYSE PRÉDICTIVE';
  sheet.getCell('A3').style = { font: { bold: true, size: 12 } };

  const predictions = classesStats.map(c => {
    const previsionRetards = Math.ceil(c.elevesRetard * 1.1);
    const croissanceTaux = c.taux >= 80 ? '+2%' : c.taux >= 50 ? '-3%' : '-8%';
    const recommendation = c.taux < 50 ? 'RELANCER PARENTS' : c.taux < 80 ? 'SUIVI INTENSIF' : 'MAINTENIR';

    return {
      classe: c.nom,
      tauxActuel: c.taux,
      previsionRetards,
      croissanceTaux,
      recommendation
    };
  });

  const headers = ['CLASSE', 'TAUX ACTUEL %', 'PRÉVISION RETARDS', 'CROISSANCE %', 'RECOMMANDATION'];
  headers.forEach((h, idx) => {
    const cell = sheet.getCell(5, idx + 1);
    cell.value = h;
    cell.style = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkBg } },
      alignment: { horizontal: 'center' }
    };
  });

  predictions.forEach((p, idx) => {
    const row = 6 + idx;
    sheet.getCell(row, 1).value = p.classe;
    sheet.getCell(row, 2).value = p.tauxActuel;
    sheet.getCell(row, 3).value = p.previsionRetards;
    sheet.getCell(row, 4).value = p.croissanceTaux;
    sheet.getCell(row, 5).value = p.recommendation;
  });

  sheet.columns = [
    { width: 20 },
    { width: 14 },
    { width: 18 },
    { width: 14 },
    { width: 20 }
  ];
}

// ============================================
// 🛠️ UTILS
// ============================================

function calculateRiskLevel(totalPaye, resteAPayer) {
  const taux = totalPaye / (totalPaye + resteAPayer);
  if (taux >= 0.8) return 'BAS';
  if (taux >= 0.5) return 'MOYEN';
  return 'HAUT';
}

function calculateTendance(taux) {
  if (taux >= 85) return '📈 EXCELLENT';
  if (taux >= 70) return '📊 BON';
  if (taux >= 50) return '⚠️ À SURVEILLER';
  return '🔴 CRITIQUE';
}

function getTauxColor(taux) {
  if (taux >= 80) return COLORS.success;
  if (taux >= 50) return COLORS.warning;
  return COLORS.danger;
}

function getTauxCellColor(taux) {
  if (taux >= 80) return 'FF27AE60';
  if (taux >= 50) return 'FFF39C12';
  return 'FFE74C3C';
}


/* ============================================================
   📄 Export PDF - RAPPORT CLASSES
============================================================ */

exports.exportPDF = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const percepteur = req.user;
    const annee = anneeScolaire || ANNEE_SCOLAIRE_DEFAUT;

    console.log(`📤 Export PDF - Année: ${annee}`);

    const classesStats = await getDataRapportPourExport(req);

    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const fileName = `Rapport_Classes_${annee}_${dateStr}.pdf`;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    // ─── En-tête ───
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(`📊 RAPPORT CLASSES`, { align: 'center' })
      .fontSize(12)
      .font('Helvetica')
      .text(`Année: ${annee}`, { align: 'center' })
      .fontSize(9)
      .font('Helvetica-Oblique')
      .text(`Export du ${dateStr} - Percepteur: ${percepteur.fullName || percepteur.email}`, { align: 'right' })
      .moveDown(0.5);

    // Ligne horizontale
    doc.strokeColor('#333333').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // ─── Statistiques globales ───
    const totalClasses = classesStats.length;
    const totalEleves = classesStats.reduce((sum, c) => sum + (c.effectif || 0), 0);
    const totalAJour = classesStats.reduce((sum, c) => sum + (c.elevesAjour || 0), 0);
    const totalRetard = classesStats.reduce((sum, c) => sum + (c.elevesRetard || 0), 0);
    const totalDu = classesStats.reduce((sum, c) => sum + (c.totalAttendu || 0), 0);
    const totalPaye = classesStats.reduce((sum, c) => sum + (c.totalPaye || 0), 0);
    const tauxGlobal = totalDu > 0 ? ((totalPaye / totalDu) * 100).toFixed(1) : '0.0';

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#1E3A8A')
      .text(`Classes: ${totalClasses} | Élèves: ${totalEleves} | À jour: ${totalAJour} | Retard: ${totalRetard} | Dû: ${totalDu.toLocaleString('fr-FR')} FC | Payé: ${totalPaye.toLocaleString('fr-FR')} FC | Taux: ${tauxGlobal}%`, { align: 'center' })
      .fillColor('#000000')
      .moveDown(0.8);

    // ─── Tableau des classes ───
    const colX = [50, 150, 220, 280, 340, 410, 480];
    const colWidths = [100, 70, 60, 60, 70, 70, 75];
    const headers = ['Classe', 'Effectif', 'À jour', 'Retard', 'Dû (FC)', 'Payé (FC)', 'Taux %'];

    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, colX[i], doc.y, { width: colWidths[i], align: 'center' });
    });

    let y = doc.y + 5;
    doc.strokeColor('#CCCCCC').lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();

    doc.fontSize(8).font('Helvetica');

    classesStats.forEach(classe => {
      y += 20;

      if (y > 750) {
        doc.addPage();
        y = 60;
      }

      const txtColor = classe.taux >= 80 ? '#166534' : classe.taux >= 50 ? '#B45309' : '#991B1B';
      doc.fillColor(txtColor);

      doc.text(classe.nom, colX[0], y - 15, { width: colWidths[0], align: 'left' });
      doc.text((classe.effectif || 0).toString(), colX[1], y - 15, { width: colWidths[1], align: 'center' });
      doc.text((classe.elevesAjour || 0).toString(), colX[2], y - 15, { width: colWidths[2], align: 'center' });
      doc.text((classe.elevesRetard || 0).toString(), colX[3], y - 15, { width: colWidths[3], align: 'center' });
      doc.text((classe.totalAttendu || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }), colX[4], y - 15, { width: colWidths[4], align: 'right' });
      doc.text((classe.totalPaye || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }), colX[5], y - 15, { width: colWidths[5], align: 'right' });
      doc.text(`${(classe.taux || 0).toFixed(1)}%`, colX[6], y - 15, { width: colWidths[6], align: 'center' });

      doc.strokeColor('#EEEEEE').lineWidth(0.5).moveTo(50, y - 2).lineTo(550, y - 2).stroke();
    });

    // ─── Pied de page ───
    doc.moveDown(1);
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666666');
    doc.text('Généré par Gabkut-École | Collège Le Mérite', { align: 'center' });
    doc.text(`${new Date().toLocaleString('fr-FR')}`, { align: 'center' });

    // Numéros de page
    const pages = doc.bufferedPageRange().count;
    for (let i = 0; i < pages; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text(`Page ${i + 1} / ${pages}`, 50, 750, { align: 'center' });
    }

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

/* ============================================================
   📝 Export Word - RAPPORT CLASSES COMPLET (DOCX)
============================================================ */

exports.exportWord = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const percepteur = req.user;
    const annee = anneeScolaire || ANNEE_SCOLAIRE_DEFAUT;

    console.log(`📤 Export Word - Année: ${annee}`);

    const classesStats = await getDataRapportPourExport(req);

    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const fileName = `Rapport_Classes_${annee}_${dateStr}.docx`;

    // Stats
    const totalClasses = classesStats.length;
    const totalEleves = classesStats.reduce((sum, c) => sum + (c.effectif || 0), 0);
    const totalAJour = classesStats.reduce((sum, c) => sum + (c.elevesAjour || 0), 0);
    const totalRetard = classesStats.reduce((sum, c) => sum + (c.elevesRetard || 0), 0);
    const totalDu = classesStats.reduce((sum, c) => sum + (c.totalAttendu || 0), 0);
    const totalPaye = classesStats.reduce((sum, c) => sum + (c.totalPaye || 0), 0);
    const soldeGlobal = Math.max(0, totalDu - totalPaye);
    const tauxGlobal = totalDu > 0 ? ((totalPaye / totalDu) * 100).toFixed(1) : '0.0';

    // Construire tableaux par classe
    const tablesClasses = classesStats.map(classe => {
      const eleveRows = classe.eleves?.map(e => {
        const statut = e.resteAPayer <= 0 ? '✓ À jour' : '✗ Retard';
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 14, type: WidthType.PERCENT },
              children: [new Paragraph(e.nom || '—')]
            }),
            new TableCell({
              width: { size: 14, type: WidthType.PERCENT },
              children: [new Paragraph(e.prenom || '—')]
            }),
            new TableCell({
              width: { size: 14, type: WidthType.PERCENT },
              children: [new Paragraph(e.postnom || '—')]
            }),
            new TableCell({
              width: { size: 12, type: WidthType.PERCENT },
              children: [new Paragraph((classe.montantFrais || 0).toLocaleString('fr-FR'))]
            }),
            new TableCell({
              width: { size: 12, type: WidthType.PERCENT },
              children: [new Paragraph((e.totalPaye || 0).toLocaleString('fr-FR'))]
            }),
            new TableCell({
              width: { size: 12, type: WidthType.PERCENT },
              children: [new Paragraph((e.resteAPayer || 0).toLocaleString('fr-FR'))]
            }),
            new TableCell({
              width: { size: 12, type: WidthType.PERCENT },
              children: [new Paragraph(statut)]
            })
          ]
        });
      }) || [];

      return {
        classe: classe.nom,
        niveau: classe.niveau,
        table: new Table({
          width: { size: 100, type: WidthType.PERCENT },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 14, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [new Paragraph({
                    text: 'Nom',
                    run: { bold: true, color: 'FFFFFF', size: 20 }
                  })]
                }),
                new TableCell({
                  width: { size: 14, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [new Paragraph({
                    text: 'Prénom',
                    run: { bold: true, color: 'FFFFFF', size: 20 }
                  })]
                }),
                new TableCell({
                  width: { size: 14, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [new Paragraph({
                    text: 'Postnom',
                    run: { bold: true, color: 'FFFFFF', size: 20 }
                  })]
                }),
                new TableCell({
                  width: { size: 12, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [new Paragraph({
                    text: 'Montant dû',
                    run: { bold: true, color: 'FFFFFF', size: 20 }
                  })]
                }),
                new TableCell({
                  width: { size: 12, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [new Paragraph({
                    text: 'Payé',
                    run: { bold: true, color: 'FFFFFF', size: 20 }
                  })]
                }),
                new TableCell({
                  width: { size: 12, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [new Paragraph({
                    text: 'Solde',
                    run: { bold: true, color: 'FFFFFF', size: 20 }
                  })]
                }),
                new TableCell({
                  width: { size: 12, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [new Paragraph({
                    text: 'Statut',
                    run: { bold: true, color: 'FFFFFF', size: 20 }
                  })]
                })
              ]
            }),
            ...eleveRows
          ],
          borders: {
            top: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 6 },
            bottom: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 6 },
            left: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 6 },
            right: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 6 },
            insideHorizontal: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 },
            insideVertical: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 }
          }
        })
      };
    });

    // Document principal
    const docChildren = [
      // Titre
      new Paragraph({
        text: '📊 RAPPORT CLASSES',
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        run: { bold: true, size: 28, color: '1E3A8A' }
      }),

      // Année
      new Paragraph({
        text: `Année scolaire: ${annee}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 50 }
      }),

      // Date
      new Paragraph({
        text: `Export du ${dateStr} - Percepteur: ${percepteur.fullName || percepteur.email}`,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200 },
        run: { italic: true, size: 18 }
      }),

      // Synthèse
      new Paragraph({
        text: `Synthèse : ${totalClasses} classes | ${totalEleves} élèves | ${totalAJour} à jour | ${totalRetard} en retard | Montant dû: ${totalDu.toLocaleString('fr-FR')} FC | Payé: ${totalPaye.toLocaleString('fr-FR')} FC | Solde: ${soldeGlobal.toLocaleString('fr-FR')} FC | Taux: ${tauxGlobal}%`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        shading: { type: 'clear', fill: 'E0E7FF' },
        run: { bold: true, size: 20 }
      })
    ];

    // Ajouter tableaux par classe
    tablesClasses.forEach((sec, idx) => {
      if (idx > 0) {
        docChildren.push(new Paragraph({
          text: '',
          spacing: { after: 200 }
        }));
      }

      docChildren.push(
        new Paragraph({
          text: `📚 Classe: ${sec.classe} (${sec.niveau})`,
          spacing: { after: 100 },
          run: { bold: true, size: 22, color: '1D4ED8' }
        })
      );

      docChildren.push(sec.table);
    });

    // Pied de page
    docChildren.push(
      new Paragraph({
        text: '',
        spacing: { before: 200 }
      }),
      new Paragraph({
        text: 'Généré par Gabkut-École | Collège Le Mérite',
        alignment: AlignmentType.CENTER,
        run: { italic: true, size: 18, color: '666666' }
      }),
      new Paragraph({
        text: `${new Date().toLocaleString('fr-FR')}`,
        alignment: AlignmentType.CENTER,
        run: { italic: true, size: 18, color: '666666' }
      })
    );

    const doc = new Document({
      sections: [{
        children: docChildren,
        properties: {
          page: {
            margins: {
              top: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5)
            }
          }
        }
      }]
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.end(buffer);

    console.log(`✅ Word généré: ${fileName}`);

  } catch (err) {
    console.error('❌ Export Word error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erreur export Word: ' + err.message
      });
    }
  }
};

module.exports = exports;

console.log('✅ Controller Rapport Classes COMPLET chargé (Excel + PDF + Word)');


