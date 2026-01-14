/**
 * 📊 ADMIN CLASSES SEGMENT REPORT CONTROLLER - GABKUT SCHOLA
 * Rapport segmenté : Études comparatives par segment, par classe, par élève, par mois
 * Excel multi-onglets avancé (Dashboard segment, Comparatif, Élèves, Mensualités, Analyse mensuelle, Alertes, Résumé)
 */

const ExcelJS = require('exceljs');
const Classe = require('../../models/Classe');
const Eleve = require('../../models/Eleve');
const Paiement = require('../../models/Paiement');

const MONTH_NAME_TO_NUMBER = {
  Septembre: 1,
  Octobre: 2,
  Novembre: 3,
  Décembre: 4,
  Janvier: 5,
  Février: 6,
  Mars: 7,
  Avril: 8,
  Mai: 9,
  Juin: 10,
};

/**
 * Helpers filtres basiques, compatibles avec ton front
 */
function buildFilters(query) {
  const {
    niveau,
    mois,
    noStudents,
    hasPayments,
    maxStudents,
    segment,
    anneeScolaire,
  } = query;

  return {
    niveau: niveau || '',
    mois: mois || '',
    noStudents: noStudents || '',
    hasPayments: hasPayments || '',
    maxStudents: maxStudents || '',
    segment: segment || 'toutes', // toutes, avec, sans, fort, faible
    anneeScolaire:
      anneeScolaire || process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026',
  };
}

/**
 * Prépare toutes les données nécessaires pour le rapport segmenté
 * - classes avec effectif, attendu, payé, reste, taux, nombrePaiements
 * - élèves avec dû, payé, reste, taux par élève
 * - paiements par mois (global segment, par classe, par élève)
 */
async function buildSegmentData(filters) {
  const {
    niveau,
    mois,
    noStudents,
    hasPayments,
    maxStudents,
    segment,
    anneeScolaire,
  } = filters;

  const seuilFortRecouvrement = 80;
  const seuilFaibleRecouvrement = 50;

  // ---------- 1. CLASSES ----------
  const classeFilter = {};
  if (niveau) classeFilter.niveau = niveau;

  const classesRaw = await Classe.find(classeFilter)
    .sort({ niveau: 1, nom: 1 })
    .lean();

  // ---------- 2. EFFECTIFS PAR CLASSE ----------
  const elevesAgg = await Eleve.aggregate([
    { $match: { anneeScolaire, statut: 'actif' } },
    {
      $group: {
        _id: '$classe',
        effectif: { $sum: 1 },
      },
    },
  ]);

  const effectifsMap = new Map();
  elevesAgg.forEach((e) => effectifsMap.set(e._id?.toString(), e.effectif));

  // ---------- 3. PAIEMENTS ----------
  const paiementMatch = { anneeScolaire, statut: 'validé' };
  if (mois) {
    paiementMatch.mois = Number(mois);
  }

  // Paiements agrégés par classe
  const paiementsAgg = await Paiement.aggregate([
    { $match: paiementMatch },
    {
      $group: {
        _id: '$classe',
        totalPayes: { $sum: '$montant' },
        nombrePaiements: { $sum: 1 },
      },
    },
  ]);

  const payesMap = new Map();
  const paiementsCountMap = new Map();
  paiementsAgg.forEach((p) => {
    payesMap.set(p._id?.toString(), p.totalPayes);
    paiementsCountMap.set(p._id?.toString(), p.nombrePaiements);
  });

  // Paiements par mois (global)
  const paiementsParMoisAgg = await Paiement.aggregate([
    { $match: { anneeScolaire, statut: 'validé' } },
    {
      $group: {
        _id: '$mois',
        montantMois: { $sum: '$montant' },
        nombreTransactions: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Paiements bruts pour calcul élève + classe/mois
  const paiementsBruts = await Paiement.find({ anneeScolaire, statut: 'validé' })
    .populate('classe')
    .populate('eleve')
    .lean();

  // ---------- 4. CLASSES ENRICHIES ----------
  let classes = classesRaw.map((classe) => {
    const id = classe._id.toString();
    const effectif = effectifsMap.get(id) || 0;
    const montantFrais = classe.montantFrais || 0;
    const totalFrais = effectif * montantFrais;
    const totalPayes = payesMap.get(id) || 0;
    const reste = totalFrais - totalPayes;
    const tauxRecouvrement =
      totalFrais > 0 ? (totalPayes / totalFrais) * 100 : 0;

    return {
      _id: id,
      nom: classe.nom,
      niveau: classe.niveau,
      montantFrais,
      mensualite: classe.mensualite || 0,
      effectif,
      totalFrais,
      totalPayes,
      reste,
      tauxRecouvrement,
      nombrePaiements: paiementsCountMap.get(id) || 0,
    };
  });

  // ---------- 5. FILTRES CLASSES (noStudents, hasPayments, maxStudents, segment) ----------
  if (noStudents === 'yes') {
    classes = classes.filter((c) => c.effectif === 0);
  }

  if (hasPayments === 'yes') {
    classes = classes.filter((c) => (c.totalPayes || 0) > 0.0001);
  }

  if (maxStudents !== undefined && maxStudents !== '') {
    const max = Number(maxStudents);
    if (!Number.isNaN(max) && max > 0) {
      classes = classes.filter((c) => (c.effectif || 0) < max);
    }
  }

  // Segments cohérents avec ton front
  if (segment === 'avec') {
    classes = classes.filter((c) => (c.totalPayes || 0) > 0.0001);
  } else if (segment === 'sans') {
    classes = classes.filter((c) => (c.totalPayes || 0) <= 0.0001);
  } else if (segment === 'fort') {
    classes = classes.filter(
      (c) => (c.tauxRecouvrement || 0) >= seuilFortRecouvrement,
    );
  } else if (segment === 'faible') {
    classes = classes.filter(
      (c) =>
        (c.tauxRecouvrement || 0) > 0 &&
        (c.tauxRecouvrement || 0) < seuilFaibleRecouvrement,
    );
  }

  const classesIdsSet = new Set(classes.map((c) => c._id));

  // ---------- 6. ÉLÈVES + MONTANTS PAR ÉLÈVE ----------
  const eleves = await Eleve.find({
    anneeScolaire,
    statut: 'actif',
    classe: { $in: Array.from(classesIdsSet) },
  })
    .populate('classe')
    .lean();

  // Paiements par élève
  const paiementsParEleveMap = new Map();
  const paiementsParEleveMoisMap = new Map(); // clé `${eleveId}_${mois}`

  paiementsBruts.forEach((p) => {
    const classeId =
      (p.classe && p.classe._id) ||
      p.classeId ||
      p.classe ||
      (p.classeRef && p.classeRef._id) ||
      null;

    if (!classeId) return;
    const classeIdStr = classeId.toString();
    if (!classesIdsSet.has(classeIdStr)) return; // on reste dans le segment

    const eleveId =
      (p.eleve && p.eleve._id) ||
      p.eleveId ||
      p.eleve ||
      (p.eleveRef && p.eleveRef._id) ||
      null;

    if (!eleveId) return;
    const eleveIdStr = eleveId.toString();

    const montant = p.montant || 0;
    const moisPaiement = p.mois || 0;

    // total par élève
    if (!paiementsParEleveMap.has(eleveIdStr)) {
      paiementsParEleveMap.set(eleveIdStr, 0);
    }
    paiementsParEleveMap.set(
      eleveIdStr,
      paiementsParEleveMap.get(eleveIdStr) + montant,
    );

    // par élève + mois
    const keyEM = `${eleveIdStr}_${moisPaiement}`;
    if (!paiementsParEleveMoisMap.has(keyEM)) {
      paiementsParEleveMoisMap.set(keyEM, 0);
    }
    paiementsParEleveMoisMap.set(
      keyEM,
      paiementsParEleveMoisMap.get(keyEM) + montant,
    );
  });

  const elevesData = eleves.map((e) => {
    const eleveId = e._id.toString();
    const classeId = e.classe ? e.classe._id.toString() : (e.classe || '').toString();
    const classe = classes.find((c) => c._id === classeId);
    const montantFrais = classe ? classe.montantFrais || 0 : 0;

    const duTotal = montantFrais; // 1 élève = 1 frais annuel
    const payeTotal = paiementsParEleveMap.get(eleveId) || 0;
    const reste = Math.max(0, duTotal - payeTotal);
    const taux =
      duTotal > 0 ? Math.round((payeTotal / duTotal) * 100) : 0;

    return {
      _id: eleveId,
      nomComplet: `${e.nom} ${e.postnom || ''} ${e.prenom || ''}`.trim(),
      classeId,
      classeNom: classe ? classe.nom : '',
      niveau: classe ? classe.niveau : '',
      montantDu: duTotal,
      montantPaye: payeTotal,
      reste,
      taux,
    };
  });

  // ---------- 7. PAIEMENTS PAR MOIS LIMITÉS AUX CLASSES DU SEGMENT ----------
  const paiementsParMoisSegment = [];
  paiementsParMoisAgg.forEach((p) => {
    const moisVal = p._id;
    // recalc pour segment seulement
    let montantSeg = 0;
    let transactionsSeg = 0;

    paiementsBruts.forEach((pb) => {
      if ((pb.mois || 0) !== moisVal) return;
      const classeId =
        (pb.classe && pb.classe._id) ||
        pb.classeId ||
        pb.classe ||
        (pb.classeRef && pb.classeRef._id) ||
        null;
      if (!classeId) return;
      const idStr = classeId.toString();
      if (!classesIdsSet.has(idStr)) return;

      montantSeg += pb.montant || 0;
      transactionsSeg += 1;
    });

    paiementsParMoisSegment.push({
      mois: moisVal,
      montant: montantSeg,
      transactions: transactionsSeg,
    });
  });

  // ---------- 8. TOTAUX GLOBAUX SEGMENT ----------
  const totalFraisGlobal = classes.reduce(
    (s, c) => s + (c.totalFrais || 0),
    0,
  );
  const totalPayesGlobal = classes.reduce(
    (s, c) => s + (c.totalPayes || 0),
    0,
  );
  const totalResteGlobal = totalFraisGlobal - totalPayesGlobal;
  const totalEffectifGlobal = classes.reduce(
    (s, c) => s + (c.effectif || 0),
    0,
  );
  const tauxRecouvrementGlobal =
    totalFraisGlobal > 0
      ? Math.round((totalPayesGlobal / totalFraisGlobal) * 100)
      : 0;

  return {
    filters,
    classes,
    eleves: elevesData,
    paiementsParMois: paiementsParMoisSegment,
    paiementsParEleveMoisMap,
    totals: {
      totalFrais: totalFraisGlobal,
      totalPayes: totalPayesGlobal,
      totalReste: totalResteGlobal,
      totalEffectif: totalEffectifGlobal,
      tauxRecouvrement: tauxRecouvrementGlobal,
      nombreClasses: classes.length,
      nombreEleves: elevesData.length,
    },
  };
}

/**
 * Helper: applique un style KPI sur une cellule
 */
function styleKpiCell(cell, color) {
  cell.font = { bold: true, size: 14, color: { argb: color } };
  cell.alignment = { horizontal: 'center', vertical: 'center' };
  cell.border = {
    top: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
  };
}

/**
 * GET /api/admin/classes/report/segment/excel
 * Export Excel segmenté (Études comparatives)
 */
exports.exportClassesSegmentExcel = async (req, res, next) => {
  try {
    const filters = buildFilters(req.query);
    const segmentData = await buildSegmentData(filters);

    const {
      classes,
      eleves,
      paiementsParMois,
      paiementsParEleveMoisMap,
      totals,
    } = segmentData;

    const { anneeScolaire, segment } = filters;

    // Création du workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gabkut Schola';
    workbook.created = new Date();

    // ============================================
    // ONGLET 1 : DASHBOARD SEGMENT
    // ============================================
    const wsDash = workbook.addWorksheet('📊 Segment Dashboard', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsDash.mergeCells('A1:H1');
    const titleDash = wsDash.getCell('A1');
    titleDash.value = `📊 TABLEAU DE BORD - SEGMENT (${segment.toUpperCase()})`;
    titleDash.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleDash.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    titleDash.alignment = { horizontal: 'center', vertical: 'center' };
    wsDash.getRow(1).height = 28;

    wsDash.mergeCells('A2:H2');
    const subtitleDash = wsDash.getCell('A2');
    subtitleDash.value = `Année scolaire: ${anneeScolaire} | Segment: ${segment} | Généré le: ${new Date().toLocaleDateString(
      'fr-FR',
    )}`;
    subtitleDash.font = { italic: true, size: 11, color: { argb: 'FF6B7280' } };
    subtitleDash.alignment = { horizontal: 'center' };
    wsDash.getRow(2).height = 20;

    wsDash.addRow([]);

    const kpisSegment = [
      {
        label: 'CLASSES DU SEGMENT',
        value: totals.nombreClasses,
        color: 'FF3B82F6',
      },
      {
        label: 'ÉLÈVES DU SEGMENT',
        value: totals.totalEffectif,
        color: 'FF10B981',
      },
      {
        label: 'FRAIS ATTENDUS',
        value: totals.totalFrais,
        color: 'FF8B5CF6',
        format: '#,##0.00',
      },
      {
        label: 'MONTANT PAYÉ',
        value: totals.totalPayes,
        color: 'FFF59E0B',
        format: '#,##0.00',
      },
      {
        label: 'RESTE À PAYER',
        value: totals.totalReste,
        color: 'FFEF4444',
        format: '#,##0.00',
      },
      {
        label: 'TAUX RECOUVREMENT',
        value: `${totals.tauxRecouvrement}%`,
        color: 'FF06B6D4',
      },
    ];

    // Colonnes fixes pour éviter les problèmes de lettre
    const kpiColumns = ['A', 'C', 'E', 'G', 'I', 'K'];

    kpisSegment.forEach((kpi, idx) => {
      const colLetter = kpiColumns[idx];
      if (!colLetter) return;

      // Label
      const labelCell = wsDash.getCell(`${colLetter}4`);
      labelCell.value = kpi.label;
      labelCell.font = {
        bold: true,
        size: 10,
        color: { argb: 'FFFFFFFF' },
      };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: kpi.color },
      };
      labelCell.alignment = { horizontal: 'center', vertical: 'center' };
      wsDash.getColumn(colLetter).width = 20;
      wsDash.getRow(4).height = 22;

      // Valeur
      const valueCell = wsDash.getCell(`${colLetter}5`);
      valueCell.value = kpi.value;
      if (kpi.format) valueCell.numFmt = kpi.format;
      styleKpiCell(valueCell, kpi.color);
      wsDash.getRow(5).height = 24;
    });

    wsDash.addRow([]);
    wsDash.addRow([]);
    wsDash.mergeCells('A7:H7');
    const classementTitle = wsDash.getCell('A7');
    classementTitle.value = '🏆 TOP & BOTTOM CLASSES (TAUX DE RECOUVREMENT)';
    classementTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    classementTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' },
    };
    classementTitle.alignment = { horizontal: 'center' };
    wsDash.getRow(7).height = 20;

    const headersTop = wsDash.addRow([
      'Rang',
      'Classe',
      'Niveau',
      'Effectif',
      'Attendu',
      'Payé',
      'Taux %',
      'Type',
    ]);
    headersTop.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headersTop.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    const classesSorted = [...classes].sort(
      (a, b) => (b.tauxRecouvrement || 0) - (a.tauxRecouvrement || 0),
    );
    const top5 = classesSorted.slice(0, 5);
    const bottom5 = [...classesSorted].reverse().slice(0, 5);

    let rank = 1;
    top5.forEach((c) => {
      const row = wsDash.addRow([
        rank++,
        c.nom,
        c.niveau,
        c.effectif,
        c.totalFrais,
        c.totalPayes,
        Math.round(c.tauxRecouvrement || 0),
        'TOP',
      ]);
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).numFmt = '0';

      const tauxCell = row.getCell(7);
      if ((c.tauxRecouvrement || 0) >= 90) {
        tauxCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC6EFCE' },
        };
        tauxCell.font = { color: { argb: 'FF006100' } };
      } else if ((c.tauxRecouvrement || 0) >= 70) {
        tauxCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEBCC' },
        };
        tauxCell.font = { color: { argb: 'FF9C6500' } };
      } else {
        tauxCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCC' },
        };
        tauxCell.font = { color: { argb: 'FF9C0006' } };
      }
    });

    bottom5.forEach((c) => {
      const row = wsDash.addRow([
        rank++,
        c.nom,
        c.niveau,
        c.effectif,
        c.totalFrais,
        c.totalPayes,
        Math.round(c.tauxRecouvrement || 0),
        'BOTTOM',
      ]);
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).numFmt = '0';

      const tauxCell = row.getCell(7);
      tauxCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCCCC' },
      };
      tauxCell.font = { color: { argb: 'FF9C0006' } };
    });

    // ============================================
    // ONGLET 2 : COMPARATIF CLASSES SEGMENT
    // ============================================
    const wsClasses = workbook.addWorksheet('📋 Classes Segment', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsClasses.mergeCells('A1:I1');
    const titleClasses = wsClasses.getCell('A1');
    titleClasses.value = '📋 COMPARATIF DES CLASSES (SEGMENT)';
    titleClasses.font = {
      bold: true,
      size: 14,
      color: { argb: 'FFFFFFFF' },
    };
    titleClasses.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    titleClasses.alignment = { horizontal: 'center' };
    wsClasses.getRow(1).height = 24;

    wsClasses.columns = [
      { header: 'Classe', key: 'nom', width: 24 },
      { header: 'Niveau', key: 'niveau', width: 12 },
      { header: 'Effectif', key: 'effectif', width: 10 },
      { header: 'Frais/Élève', key: 'montantFrais', width: 14 },
      { header: 'Frais Attendus', key: 'totalFrais', width: 16 },
      { header: 'Montant Payé', key: 'totalPayes', width: 16 },
      { header: 'Reste', key: 'reste', width: 14 },
      { header: 'Taux %', key: 'tauxRecouvrement', width: 10 },
      { header: 'Nb Paiements', key: 'nombrePaiements', width: 14 },
    ];

    const headerClasses = wsClasses.getRow(2);
    headerClasses.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerClasses.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    headerClasses.alignment = {
      horizontal: 'center',
      vertical: 'center',
    };

    classes
      .slice()
      .sort((a, b) => {
        const keyA = `${a.niveau || ''}-${a.nom || ''}`;
        const keyB = `${b.niveau || ''}-${b.nom || ''}`;
        return keyA.localeCompare(keyB, 'fr-FR');
      })
      .forEach((classe) => {
        const row = wsClasses.addRow(classe);
        row.getCell(4).numFmt = '#,##0.00';
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(7).numFmt = '#,##0.00';
        row.getCell(8).numFmt = '0';

        const tauxCell = row.getCell(8);
        if ((classe.tauxRecouvrement || 0) >= 90) {
          tauxCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC6EFCE' },
          };
        } else if ((classe.tauxRecouvrement || 0) >= 70) {
          tauxCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFEBCC' },
          };
        } else {
          tauxCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCCCC' },
          };
        }
      });

    const totalRowClasses = wsClasses.addRow({
      nom: 'TOTAL SEGMENT',
      effectif: totals.totalEffectif,
      totalFrais: totals.totalFrais,
      totalPayes: totals.totalPayes,
      reste: totals.totalReste,
      tauxRecouvrement: totals.tauxRecouvrement,
    });
    totalRowClasses.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    totalRowClasses.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' },
    };
    totalRowClasses.getCell(5).numFmt = '#,##0.00';
    totalRowClasses.getCell(6).numFmt = '#,##0.00';
    totalRowClasses.getCell(7).numFmt = '#,##0.00';
    totalRowClasses.getCell(8).numFmt = '0';

    // ============================================
    // ONGLET 3 : DÉTAILS ÉLÈVES
    // ============================================
    const wsEleves = workbook.addWorksheet('👨‍🎓 Élèves Segment', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsEleves.mergeCells('A1:H1');
    const titleEleves = wsEleves.getCell('A1');
    titleEleves.value = '👨‍🎓 DÉTAILS DES ÉLÈVES DU SEGMENT';
    titleEleves.font = {
      bold: true,
      size: 14,
      color: { argb: 'FFFFFFFF' },
    };
    titleEleves.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' },
    };
    titleEleves.alignment = { horizontal: 'center' };
    wsEleves.getRow(1).height = 24;

    wsEleves.columns = [
      { header: 'Élève', key: 'nomComplet', width: 28 },
      { header: 'Classe', key: 'classeNom', width: 20 },
      { header: 'Niveau', key: 'niveau', width: 12 },
      { header: 'Montant dû', key: 'montantDu', width: 14 },
      { header: 'Montant payé', key: 'montantPaye', width: 14 },
      { header: 'Reste', key: 'reste', width: 14 },
      { header: 'Taux %', key: 'taux', width: 10 },
      { header: 'Statut', key: 'statut', width: 16 },
    ];

    const headerEleves = wsEleves.getRow(2);
    headerEleves.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerEleves.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    headerEleves.alignment = {
      horizontal: 'center',
      vertical: 'center',
    };

    eleves.forEach((e) => {
      const statut =
        e.reste <= 0
          ? 'À jour'
          : e.taux >= 70
          ? 'En bonne voie'
          : 'En retard';
      const row = wsEleves.addRow({ ...e, statut });

      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).numFmt = '0';

      const statutCell = row.getCell(8);
      if (statut === 'À jour') {
        statutCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC6EFCE' },
        };
      } else if (statut === 'En bonne voie') {
        statutCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEBCC' },
        };
      } else {
        statutCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCC' },
        };
      }
    });

    // ============================================
    // ONGLET 4 : MENSUALITÉS PAR ÉLÈVE
    // ============================================
    const wsMensu = workbook.addWorksheet('📅 Mensualités Élèves', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsMensu.mergeCells('A1:P1');
    const titleMensu = wsMensu.getCell('A1');
    titleMensu.value = '📅 MENSUALITÉS PAR ÉLÈVE';
    titleMensu.font = {
      bold: true,
      size: 14,
      color: { argb: 'FFFFFFFF' },
    };
    titleMensu.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0891B2' },
    };
    titleMensu.alignment = { horizontal: 'center' };
    wsMensu.getRow(1).height = 24;

    const moisNames = [
      'Jan',
      'Fév',
      'Mar',
      'Avr',
      'Mai',
      'Jun',
      'Jul',
      'Aoû',
      'Sep',
      'Oct',
      'Nov',
      'Déc',
    ];

    wsMensu.columns = [
      { header: 'Élève', key: 'nomComplet', width: 28 },
      { header: 'Classe', key: 'classeNom', width: 20 },
      { header: 'Niveau', key: 'niveau', width: 12 },
      ...moisNames.map((m, idx) => ({
        header: m,
        key: `m${idx + 1}`,
        width: 10,
      })),
      { header: 'Total payé', key: 'totalPaye', width: 14 },
      { header: 'Taux %', key: 'taux', width: 10 },
    ];

    const headerMensu = wsMensu.getRow(2);
    headerMensu.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerMensu.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    eleves.forEach((e) => {
      const rowData = {
        nomComplet: e.nomComplet,
        classeNom: e.classeNom,
        niveau: e.niveau,
      };

      let totalPaye = 0;
      for (let mois = 1; mois <= 12; mois++) {
        const keyEM = `${e._id}_${mois}`;
        const montant = paiementsParEleveMoisMap.get(keyEM) || 0;
        rowData[`m${mois}`] = montant;
        totalPaye += montant;
      }

      rowData.totalPaye = totalPaye;
      rowData.taux = e.montantDu
        ? Math.round((totalPaye / e.montantDu) * 100)
        : 0;

      const row = wsMensu.addRow(rowData);

      for (let mois = 1; mois <= 12; mois++) {
        const cell = row.getCell(3 + mois);
        cell.numFmt = '#,##0.00';
        const montant = cell.value || 0;
        if (montant <= 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE5E5' },
          };
        } else if (montant < (e.montantDu || 0) / 12) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF7CD' },
          };
        } else {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC6EFCE' },
          };
        }
      }

      const totalCell = row.getCell(3 + 12 + 1);
      totalCell.numFmt = '#,##0.00';

      const tauxCell = row.getCell(3 + 12 + 2);
      tauxCell.numFmt = '0';
      if (rowData.taux >= 90) {
        tauxCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC6EFCE' },
        };
      } else if (rowData.taux >= 70) {
        tauxCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEBCC' },
        };
      } else {
        tauxCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCC' },
        };
      }
    });

    // ============================================
    // ONGLET 5 : ANALYSE MENSUELLE SEGMENT
    // ============================================
    const wsMois = workbook.addWorksheet('📈 Mensuel Segment', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsMois.mergeCells('A1:F1');
    const titleMois = wsMois.getCell('A1');
    titleMois.value = '📈 ANALYSE MENSUELLE DU SEGMENT';
    titleMois.font = {
      bold: true,
      size: 14,
      color: { argb: 'FFFFFFFF' },
    };
    titleMois.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8B5CF6' },
    };
    titleMois.alignment = { horizontal: 'center' };
    wsMois.getRow(1).height = 24;

    wsMois.columns = [
      { header: 'Mois', key: 'mois', width: 14 },
      { header: 'Montant', key: 'montant', width: 16 },
      { header: 'Transactions', key: 'transactions', width: 16 },
      { header: '% sur segment', key: 'pourcentage', width: 16 },
      { header: 'Barre', key: 'barre', width: 32 },
    ];

    const headerMois = wsMois.getRow(2);
    headerMois.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerMois.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    const totalMontantSegment = paiementsParMois.reduce(
      (s, p) => s + (p.montant || 0),
      0,
    );

    paiementsParMois.forEach((p) => {
      const pct =
        totalMontantSegment > 0
          ? Math.round((p.montant / totalMontantSegment) * 100)
          : 0;
      const moisName =
        moisNames[p.mois - 1] || `Mois ${p.mois}`;
      const barre = '█'.repeat(Math.max(1, Math.round(pct / 5)));
      const row = wsMois.addRow({
        mois: moisName,
        montant: p.montant,
        transactions: p.transactions,
        pourcentage: pct,
        barre,
      });
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(3).numFmt = '0';
      row.getCell(4).numFmt = '0';
    });

    // ============================================
    // ONGLET 6 : ALERTES SEGMENT
    // ============================================
    const wsAlertes = workbook.addWorksheet('⚠️ Alertes Segment', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsAlertes.mergeCells('A1:G1');
    const titleAlertes = wsAlertes.getCell('A1');
    titleAlertes.value = '⚠️ ALERTES & CLASSES / ÉLÈVES À RISQUE (SEGMENT)';
    titleAlertes.font = {
      bold: true,
      size: 14,
      color: { argb: 'FFFFFFFF' },
    };
    titleAlertes.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF97316' },
    };
    titleAlertes.alignment = { horizontal: 'center' };
    wsAlertes.getRow(1).height = 24;

    wsAlertes.addRow([]);
    wsAlertes.addRow(['🔴 CLASSES CRITIQUES (Taux < 70 %)']);
    wsAlertes.getRow(3).font = {
      bold: true,
      size: 12,
      color: { argb: 'FFB91C1C' },
    };

    const classesCritiques = classes.filter(
      (c) => (c.tauxRecouvrement || 0) < 70,
    );

    if (classesCritiques.length) {
      const head = wsAlertes.addRow([
        'Classe',
        'Niveau',
        'Effectif',
        'Attendu',
        'Payé',
        'Reste',
        'Taux %',
      ]);
      head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      head.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDC2626' },
      };

      classesCritiques
        .slice()
        .sort((a, b) => (a.tauxRecouvrement || 0) - (b.tauxRecouvrement || 0))
        .forEach((c) => {
          const row = wsAlertes.addRow([
            c.nom,
            c.niveau,
            c.effectif,
            c.totalFrais,
            c.totalPayes,
            c.reste,
            Math.round(c.tauxRecouvrement || 0),
          ]);
          row.getCell(4).numFmt = '#,##0.00';
          row.getCell(5).numFmt = '#,##0.00';
          row.getCell(6).numFmt = '#,##0.00';
          row.getCell(7).numFmt = '0';
          row.getCell(7).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCCCC' },
          };
        });
    } else {
      wsAlertes.addRow(['✅ Aucune classe critique dans ce segment.']);
    }

    wsAlertes.addRow([]);
    wsAlertes.addRow(['🟡 ÉLÈVES EN RETARD (Taux < 50 %, reste > 0)']);
    wsAlertes.getRow(wsAlertes.rowCount).font = {
      bold: true,
      size: 12,
      color: { argb: 'FFF59E0B' },
    };

    const elevesRetard = eleves.filter(
      (e) => e.reste > 0 && (e.taux || 0) < 50,
    );

    if (elevesRetard.length) {
      const headE = wsAlertes.addRow([
        'Élève',
        'Classe',
        'Niveau',
        'Montant dû',
        'Payé',
        'Reste',
        'Taux %',
      ]);
      headE.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headE.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF59E0B' },
      };

      elevesRetard.forEach((e) => {
        const row = wsAlertes.addRow([
          e.nomComplet,
          e.classeNom,
          e.niveau,
          e.montantDu,
          e.montantPaye,
          e.reste,
          e.taux,
        ]);
        row.getCell(4).numFmt = '#,##0.00';
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(7).numFmt = '0';
        row.getCell(7).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCC' },
        };
      });
    } else {
      wsAlertes.addRow(['✅ Aucun élève en retard critique dans ce segment.']);
    }

    // ============================================
    // ONGLET 7 : RÉSUMÉ EXÉCUTIF SEGMENT
    // ============================================
    const wsResume = workbook.addWorksheet('📄 Résumé Segment', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsResume.mergeCells('A1:H1');
    const titleResume = wsResume.getCell('A1');
    titleResume.value = '📄 RÉSUMÉ EXÉCUTIF DU SEGMENT';
    titleResume.font = {
      bold: true,
      size: 16,
      color: { argb: 'FFFFFFFF' },
    };
    titleResume.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' },
    };
    titleResume.alignment = { horizontal: 'center' };
    wsResume.getRow(1).height = 28;

    wsResume.mergeCells('A2:H2');
    const subtitleResume = wsResume.getCell('A2');
    subtitleResume.value = `Année: ${anneeScolaire} | Segment: ${segment} | Date: ${new Date().toLocaleDateString(
      'fr-FR',
    )}`;
    subtitleResume.font = { italic: true, size: 11 };
    wsResume.getRow(2).height = 18;

    wsResume.addRow([]);
    wsResume.addRow(['SITUATION GLOBALE DU SEGMENT']);
    wsResume.getRow(4).font = { bold: true, size: 12 };

    const summaryData = [
      ['Nombre de classes (segment)', totals.nombreClasses],
      ['Nombre d\'élèves (segment)', totals.totalEffectif],
      ['Montant total attendu', totals.totalFrais],
      ['Montant total payé', totals.totalPayes],
      ['Montant en retard', totals.totalReste],
      ['Taux de recouvrement', `${totals.tauxRecouvrement}%`],
    ];

    summaryData.forEach((item) => {
      const row = wsResume.addRow(['', item[0], item[1]]);
      row.font = { bold: true };
      row.getCell(2).font = { bold: true, size: 11 };

      if (typeof item[1] === 'number' && item[0].includes('Montant')) {
        row.getCell(3).numFmt = '#,##0.00';
        if (item[0].includes('payé')) {
          row.getCell(3).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC6EFCE' },
          };
        } else if (item[0].includes('retard')) {
          row.getCell(3).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCCCC' },
          };
        }
      }
    });

    wsResume.addRow([]);
    wsResume.addRow(['RECOMMANDATIONS POUR CE SEGMENT']);
    wsResume.getRow(wsResume.rowCount).font = { bold: true, size: 12 };

    const nbClassesCritiques = classesCritiques.length;
    const nbElevesRetard = elevesRetard.length;
    const recommandations = [];

    if (totals.tauxRecouvrement < 80) {
      recommandations.push(
        'Intensifier les relances de paiement (taux segment < 80 %).',
      );
    }
    if (nbClassesCritiques > 0) {
      recommandations.push(
        `${nbClassesCritiques} classe(s) en situation critique à traiter en priorité.`,
      );
    }
    if (nbElevesRetard > 0) {
      recommandations.push(
        `${nbElevesRetard} élève(s) en retard important nécessitent une relance ciblée.`,
      );
    }
    if (totals.tauxRecouvrement >= 90 && !recommandations.length) {
      recommandations.push('✅ Excellent taux de recouvrement sur ce segment.');
    }
    if (!recommandations.length) {
      recommandations.push('✅ Situation financière globalement saine sur ce segment.');
    }

    recommandations.forEach((rec) => {
      wsResume.addRow(['', rec]);
    });

    wsResume.columns = [
      { width: 8 },
      { width: 40 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
    ];

    // ============================================
    // Envoi du fichier
    // ============================================
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rapport-classes-segment-gabkut-${segment}-${new Date()
        .toISOString()
        .split('T')[0]}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('❌ exportClassesSegmentReportExcel error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur export Excel segment classes.',
      error: err.message,
    });
  }
};
