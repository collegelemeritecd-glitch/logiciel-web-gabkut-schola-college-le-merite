// controllers/admin/adminElevesAnalyseController.js
const ExcelJS = require('exceljs');
const Eleve = require('../../models/Eleve');
const Paiement = require('../../models/Paiement');
const Classe = require('../../models/Classe');

const MOIS_ANNEE = [
  'Septembre',
  'Octobre',
  'Novembre',
  'Decembre',
  'Janvier',
  'Fevrier',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
];

exports.exportAnalyseElevesExcel = async (req, res, next) => {
  try {
    const {
      anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026',
      classe,
      genre,
      statut,
    } = req.query;

    // 1) Filtre élèves (même logique que getStudents)
    const filter = { anneeScolaire };
    if (classe) filter.classe = classe;
    if (statut) filter.statut = statut;
    if (genre) filter.sexe = genre; // ou genre selon ton modèle

    const eleves = await Eleve.find(filter)
      .populate('classe', 'nom niveau montantFrais mensualite')
      .sort({ nom: 1, prenom: 1 })
      .lean();

    // 2) Paiements de ces élèves
    const eleveIds = eleves.map(e => e._id);
    const paiements = await Paiement.find({
      eleve: { $in: eleveIds },
      anneeScolaire,
      statut: 'validé',
    })
      .select('eleve montant mois datePaiement')
      .lean();

    const paiementsParEleve = {};
    eleveIds.forEach(id => {
      paiementsParEleve[id.toString()] = [];
    });
    paiements.forEach(p => {
      const key = p.eleve.toString();
      if (!paiementsParEleve[key]) paiementsParEleve[key] = [];
      paiementsParEleve[key].push(p);
    });

    // 3) Reconstruction de l’analyse (comme adminElevesAnalyse.js)
    const dataAnalyse = eleves.map(e => {
      const idStr = e._id.toString();
      const paiementsEleve = paiementsParEleve[idStr] || [];

      const montantAttendu =
        e.fraisTotal ||
        e.montantDu ||
        e.montantFrais ||
        (e.classe && e.classe.montantFrais) ||
        0;

      const paiementsMois = {};
      MOIS_ANNEE.forEach(m => {
        paiementsMois[m] = 0;
      });

      let totalPaye = 0;
      paiementsEleve.forEach(p => {
        totalPaye += p.montant || 0;
        const mois = p.mois;
        if (mois && paiementsMois[mois] != null) {
          paiementsMois[mois] += p.montant || 0;
        }
      });

      const reste = Math.max(0, montantAttendu - totalPaye);
      const taux = montantAttendu > 0 ? (totalPaye / montantAttendu) * 100 : 0;

      const nomComplet = `${e.nom || ''} ${e.postnom || ''} ${e.prenom || ''}`.trim();
      const classeNom = e.classe ? e.classe.nom : '';

      return {
        id: e._id,
        nomComplet,
        matricule: e.matricule,
        classeNom,
        sexe: e.sexe || e.genre,
        statut: e.statut,
        montantAttendu,
        totalPaye,
        reste,
        taux,
        paiementsMois,
      };
    });

    // 4) Création du classeur Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gabkut Schola';
    workbook.created = new Date();

    const headerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true };
    const moneyFormat = '#,##0.00';

    /********** Onglet 1 : Situation générale **********/
    const wsGlobal = workbook.addWorksheet('Situation générale', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    wsGlobal.columns = [
      { header: 'Matricule', key: 'matricule', width: 15 },
      { header: 'Nom complet', key: 'nomComplet', width: 30 },
      { header: 'Classe', key: 'classeNom', width: 18 },
      { header: 'Sexe', key: 'sexe', width: 8 },
      { header: 'Statut', key: 'statut', width: 12 },
      { header: 'Attendu', key: 'montantAttendu', width: 14, style: { numFmt: moneyFormat } },
      { header: 'Payé', key: 'totalPaye', width: 14, style: { numFmt: moneyFormat } },
      { header: 'Reste', key: 'reste', width: 14, style: { numFmt: moneyFormat } },
      { header: 'Taux %', key: 'taux', width: 10 },
    ];

    wsGlobal.getRow(1).fill = headerFill;
    wsGlobal.getRow(1).font = headerFont;
    wsGlobal.autoFilter = 'A1:I1';

    dataAnalyse.forEach(d => {
      wsGlobal.addRow({
        matricule: d.matricule,
        nomComplet: d.nomComplet,
        classeNom: d.classeNom,
        sexe: d.sexe,
        statut: d.statut,
        montantAttendu: d.montantAttendu,
        totalPaye: d.totalPaye,
        reste: d.reste,
        taux: Number(d.taux.toFixed(1)),
      });
    });

    // Totaux en bas
    const lastDataRow = wsGlobal.lastRow.number;
    const totalRow = wsGlobal.addRow({
      matricule: '',
      nomComplet: 'Totaux',
    });
    totalRow.getCell('F').value = { formula: `SUM(F2:F${lastDataRow})` };
    totalRow.getCell('G').value = { formula: `SUM(G2:G${lastDataRow})` };
    totalRow.getCell('H').value = { formula: `SUM(H2:H${lastDataRow})` };
    totalRow.font = { bold: true };

    /********** Onglet 2 : Détail par mois **********/
    const wsMois = workbook.addWorksheet('Détail par mois', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const moisColumns = [
      { header: 'Matricule', key: 'matricule', width: 15 },
      { header: 'Nom complet', key: 'nomComplet', width: 30 },
      { header: 'Classe', key: 'classeNom', width: 18 },
    ].concat(
      MOIS_ANNEE.map(m => ({
        header: m,
        key: `m_${m}`,
        width: 14,
        style: { numFmt: moneyFormat },
      })),
    );

    wsMois.columns = moisColumns;
    wsMois.getRow(1).fill = headerFill;
    wsMois.getRow(1).font = headerFont;
    wsMois.autoFilter = `A1:${String.fromCharCode(65 + moisColumns.length - 1)}1`;

    dataAnalyse.forEach(d => {
      const row = {
        matricule: d.matricule,
        nomComplet: d.nomComplet,
        classeNom: d.classeNom,
      };
      MOIS_ANNEE.forEach(m => {
        row[`m_${m}`] = d.paiementsMois[m] || 0;
      });
      wsMois.addRow(row);
    });

    /********** Onglet 3 : Synthèse par classe **********/
    const wsSynth = workbook.addWorksheet('Synthèse classes', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    wsSynth.columns = [
      { header: 'Classe', key: 'classeNom', width: 25 },
      { header: 'Effectif', key: 'effectif', width: 12 },
      { header: 'Attendu', key: 'attendu', width: 16, style: { numFmt: moneyFormat } },
      { header: 'Payé', key: 'paye', width: 16, style: { numFmt: moneyFormat } },
      { header: 'Reste', key: 'reste', width: 16, style: { numFmt: moneyFormat } },
      { header: 'Taux %', key: 'taux', width: 10 },
    ];
    wsSynth.getRow(1).fill = headerFill;
    wsSynth.getRow(1).font = headerFont;
    wsSynth.autoFilter = 'A1:F1';

    const parClasse = {};
    dataAnalyse.forEach(d => {
      const key = d.classeNom || 'Sans classe';
      if (!parClasse[key]) {
        parClasse[key] = { effectif: 0, attendu: 0, paye: 0, reste: 0 };
      }
      parClasse[key].effectif += 1;
      parClasse[key].attendu += d.montantAttendu;
      parClasse[key].paye += d.totalPaye;
      parClasse[key].reste += d.reste;
    });

    Object.entries(parClasse).forEach(([classeNom, v]) => {
      const taux = v.attendu > 0 ? (v.paye / v.attendu) * 100 : 0;
      wsSynth.addRow({
        classeNom,
        effectif: v.effectif,
        attendu: v.attendu,
        paye: v.paye,
        reste: v.reste,
        taux: Number(taux.toFixed(1)),
      });
    });

    /********** Bordures & alignements **********/
    [wsGlobal, wsMois, wsSynth].forEach(ws => {
      ws.eachRow((row, rowNumber) => {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
          if (rowNumber === 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        });
      });
    });

    // 5) Envoi
    const filename = `analyse-eleves-${anneeScolaire}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Erreur exportAnalyseElevesExcel:', err);
    next(err);
  }
};
