/************************************************************
 📊 ADMIN REPORTS CONTROLLER - GABKUT SCHOLA
 Collège Le Mérite - Rapports & Exports
 controllers/adminReportsController.js
*************************************************************/

const PDFDocument = require('pdfkit');           // npm i pdfkit
const ExcelJS = require('exceljs');              // npm i exceljs
const mongoose = require('mongoose');

// À adapter selon ta structure réelle de modèles
const Paiement = require('../../models/Paiement');
const Eleve = require('../../models/Eleve');
const Classe = require('../../models/Classe');
const User = require('../../models/User');
const LogActivite = require('../../models/LogActivite');

// Si tu as déjà un service mail / SMS, branche-le ici
// const { sendEmail } = require('../../services/mailService');
// const { sendSms } = require('../../services/smsService');

function parseFilters(query) {
  const filters = {};

  if (query.anneeScolaire) {
    filters.anneeScolaire = query.anneeScolaire;
  }

  if (query.classeId && mongoose.Types.ObjectId.isValid(query.classeId)) {
    filters.classe = query.classeId;
  }

  if (query.dateDebut || query.dateFin) {
    filters.dateOperation = {};
    if (query.dateDebut) {
      filters.dateOperation.$gte = new Date(query.dateDebut);
    }
    if (query.dateFin) {
      const d = new Date(query.dateFin);
      d.setHours(23, 59, 59, 999);
      filters.dateOperation.$lte = d;
    }
  }

  if (query.mois) {
    const moisNum = Number(query.mois);
    if (!Number.isNaN(moisNum)) {
      filters.$expr = {
        $eq: [{ $month: '$dateOperation' }, moisNum],
      };
    }
  }

  return filters;
}

/**
 * GET /admin/reports/finance/pdf
 * Export PDF narratif des indicateurs financiers + détail
 */
/**
 * GET /admin/reports/finance/pdf
 * Export PDF narratif des indicateurs financiers + détail enrichi
 */
exports.exportFinancePdf = async (req, res) => {
  try {
    const filters = parseFilters(req.query);

    const paiements = await Paiement.find(filters)
      .populate('eleve')
      .populate('classe')
      .sort({ dateOperation: -1 })
      .lean();

    const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);

    // Calcul total attendu si anneeScolaire fournie
    let totalAttendu = 0;
    let mapClasseStats = new Map();

    if (req.query.anneeScolaire) {
      const elevesActifs = await Eleve.find({
        statut: 'actif',
        anneeScolaire: req.query.anneeScolaire,
      }).populate('classe');

      totalAttendu = elevesActifs.reduce((sum, eleve) => {
        const mf = eleve.classe?.montantFrais || 0;
        // stats par classe pour l’analyse plus bas
        if (eleve.classe) {
          const key = eleve.classe._id.toString();
          if (!mapClasseStats.has(key)) {
            mapClasseStats.set(key, {
              classeId: eleve.classe._id,
              classeNom: eleve.classe.nom,
              montantFrais: mf,
              effectif: 0,
              totalAttendu: 0,
              totalPaye: 0,
            });
          }
          const entry = mapClasseStats.get(key);
          entry.effectif += 1;
          entry.totalAttendu += mf;
        }
        return sum + mf;
      }, 0);
    }

    // Compléter totalPaye par classe
    paiements.forEach((p) => {
      if (p.classe) {
        const key = p.classe._id.toString();
        if (!mapClasseStats.has(key)) {
          mapClasseStats.set(key, {
            classeId: p.classe._id,
            classeNom: p.classe.nom,
            montantFrais: p.classe.montantFrais || 0,
            effectif: 0,
            totalAttendu: 0,
            totalPaye: 0,
          });
        }
        const entry = mapClasseStats.get(key);
        entry.totalPaye += p.montant || 0;
      }
    });

    const classesAnalyse = [...mapClasseStats.values()].map((c) => {
      const taux =
        c.totalAttendu > 0 ? ((c.totalPaye / c.totalAttendu) * 100).toFixed(1) : '0.0';
      const reste = c.totalAttendu - c.totalPaye;
      return { ...c, taux, reste };
    });

    const taux =
      totalAttendu > 0 ? ((totalPaye / totalAttendu) * 100).toFixed(1) : '0.0';

    // Analyse par mode de paiement
    const mapMode = new Map();
    paiements.forEach((p) => {
      const mode = p.modePaiement || p.moyenPaiement || 'Non défini';
      if (!mapMode.has(mode)) {
        mapMode.set(mode, { mode, count: 0, total: 0 });
      }
      const m = mapMode.get(mode);
      m.count += 1;
      m.total += p.montant || 0;
    });
    const modesAnalyse = [...mapMode.values()].sort((a, b) => b.total - a.total);

    // Analyse par mois (montant global)
    const mapMois = new Map();
    paiements.forEach((p) => {
      const d = new Date(p.dateOperation || p.createdAt);
      const mois = d.getMonth() + 1;
      const moisNom = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
      ][mois - 1] || `Mois ${mois}`;
      if (!mapMois.has(moisNom)) {
        mapMois.set(moisNom, { moisNom, total: 0, count: 0 });
      }
      const m = mapMois.get(moisNom);
      m.total += p.montant || 0;
      m.count += 1;
    });
    const moisAnalyse = [...mapMois.values()].sort((a, b) => a.total - b.total);

    // Classes top et à risque
    const classesTrieesParTaux = [...classesAnalyse].sort(
      (a, b) => parseFloat(b.taux) - parseFloat(a.taux),
    );
    const topClasses = classesTrieesParTaux.slice(0, 3);
    const classesARisque = classesTrieesParTaux.filter(
      (c) => parseFloat(c.taux) < 70 && c.totalAttendu > 0,
    );

    // Préparation PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="rapport-financier-gabkut-schola.pdf"',
    );

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    // En-tête
    doc
      .fontSize(18)
      .text('Collège Le Mérite', { align: 'left' })
      .moveDown(0.2);
    doc
      .fontSize(12)
      .fillColor('#555555')
      .text('Gabkut Schola - Rapport financier détaillé', { align: 'left' })
      .moveDown();

    doc
      .fontSize(10)
      .fillColor('#333333')
      .text(`Date de génération : ${new Date().toLocaleString('fr-FR')}`)
      .moveDown(0.2);

    if (req.query.anneeScolaire) {
      doc
        .fontSize(10)
        .fillColor('#333333')
        .text(`Année scolaire : ${req.query.anneeScolaire}`)
        .moveDown(0.5);
    }

    // Résumé exécutif
    doc
      .fontSize(12)
      .fillColor('#111111')
      .text('Résumé exécutif', { underline: true })
      .moveDown(0.4);

    doc
      .fontSize(10)
      .fillColor('#333333')
      .text(
        `Ce rapport présente une vue d’ensemble des encaissements scolaires pour la période sélectionnée, ` +
          `incluant les montants attendus (calculés sur base des frais par classe et des élèves actifs), ` +
          `les montants effectivement perçus, ainsi que les éventuels retards et risques de non-recouvrement.`,
        {
          align: 'justify',
        },
      )
      .moveDown(0.6);

    doc
      .fontSize(11)
      .fillColor('#111111')
      .text(`Montant total payé : ${totalPaye.toFixed(2)} USD`)
      .moveDown(0.2);
    doc
      .fontSize(11)
      .fillColor('#111111')
      .text(`Montant total attendu : ${totalAttendu.toFixed(2)} USD`)
      .moveDown(0.2);
    doc
      .fontSize(11)
      .fillColor('#111111')
      .text(`Taux de réalisation : ${taux} %`)
      .moveDown(0.8);

    // Section : Top classes
    if (topClasses.length > 0) {
      doc
        .fontSize(12)
        .fillColor('#111111')
        .text('Top classes (meilleur recouvrement)', { underline: true })
        .moveDown(0.3);

      topClasses.forEach((c) => {
        doc
          .fontSize(10)
          .fillColor('#333333')
          .text(
            `- ${c.classeNom} : ${c.taux} % | Payé ${c.totalPaye.toFixed(
              2,
            )} USD / Attendu ${c.totalAttendu.toFixed(2)} USD`,
          );
      });
      doc.moveDown(0.6);
    }

    // Section : Classes à risque
    if (classesARisque.length > 0) {
      doc
        .fontSize(12)
        .fillColor('#B91C1C')
        .text('Classes à risque (taux < 70%)', { underline: true })
        .moveDown(0.3);

      classesARisque.slice(0, 5).forEach((c) => {
        doc
          .fontSize(10)
          .fillColor('#7F1D1D')
          .text(
            `- ${c.classeNom} : ${c.taux} % | Reste ${c.reste.toFixed(
              2,
            )} USD à recouvrer`,
          );
      });
      if (classesARisque.length > 5) {
        doc
          .fontSize(9)
          .fillColor('#7F1D1D')
          .text(
            `+ ${classesARisque.length - 5} autre(s) classe(s) en difficulté.`,
          );
      }
      doc.moveDown(0.8);
    }

    // Section : Analyse par mode de paiement
    if (modesAnalyse.length > 0) {
      doc
        .fontSize(12)
        .fillColor('#111111')
        .text('Répartition par mode de paiement', { underline: true })
        .moveDown(0.3);

      modesAnalyse.forEach((m) => {
        const pourcent =
          totalPaye > 0 ? ((m.total / totalPaye) * 100).toFixed(1) : '0.0';
        doc
          .fontSize(10)
          .fillColor('#374151')
          .text(
            `- ${m.mode} : ${m.total.toFixed(2)} USD (${pourcent} %, ${m.count} paiement(s))`,
          );
      });
      doc.moveDown(0.8);
    }

    // Section : Mois les plus faibles / forts
    if (moisAnalyse.length > 0) {
      const moisFaible = moisAnalyse[0];
      const moisFort = moisAnalyse[moisAnalyse.length - 1];

      doc
        .fontSize(12)
        .fillColor('#111111')
        .text('Analyse temporelle (par mois)', { underline: true })
        .moveDown(0.3);

      doc
        .fontSize(10)
        .fillColor('#374151')
        .text(
          `Mois le plus fort : ${moisFort.moisNom} avec ${moisFort.total.toFixed(
            2,
          )} USD (${moisFort.count} paiement(s)).`,
        )
        .moveDown(0.2);

      doc
        .fontSize(10)
        .fillColor('#374151')
        .text(
          `Mois le plus faible : ${moisFaible.moisNom} avec ${moisFaible.total.toFixed(
            2,
          )} USD (${moisFaible.count} paiement(s)).`,
        )
        .moveDown(0.8);
    }

    // Détail des opérations (tableau simple)
    const tableTop = doc.y;
    const col1 = 40;
    const col2 = 130;
    const col3 = 260;
    const col4 = 380;
    const col5 = 460;

    doc.fontSize(9).fillColor('#000000');
    doc.text('Date', col1, tableTop);
    doc.text('Élève', col2, tableTop);
    doc.text('Classe', col3, tableTop);
    doc.text('Type', col4, tableTop);
    doc.text('Montant', col5, tableTop, { align: 'right' });

    doc
      .moveTo(col1, tableTop + 12)
      .lineTo(550, tableTop + 12)
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .stroke();

    let y = tableTop + 18;

    paiements.forEach((p) => {
      const dateStr = new Date(p.dateOperation || p.createdAt).toLocaleString(
        'fr-FR',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        },
      );
      const eleveNom = p.eleve
        ? `${p.eleve.nom} ${p.eleve.postnom || ''}`.trim()
        : '-';
      const classeNom = p.classe ? p.classe.nom : '-';
      const type = p.type || 'frais';
      const montant = (p.montant || 0).toFixed(2) + ' USD';

      if (y > 740) {
        doc.addPage();
        y = 40;
      }

      doc
        .fontSize(8)
        .fillColor('#111827')
        .text(dateStr, col1, y);
      doc.text(eleveNom, col2, y, { width: 120 });
      doc.text(classeNom, col3, y, { width: 100 });
      doc.text(type, col4, y, { width: 70 });
      doc.text(montant, col5, y, { width: 80, align: 'right' });

      y += 16;
    });

    doc.end();
  } catch (err) {
    console.error('❌ exportFinancePdf error:', err);
    res
      .status(500)
      .json({ message: 'Erreur génération PDF', error: err.message });
  }
};

/**
 * GET /admin/reports/finance/excel
 * Export Excel multi-onglets (Synthèse, Détails, Par Classe, Par Mode, Par Mois, Par Trimestre, Résumé)
 */
exports.exportFinanceExcel = async (req, res) => {
  try {
    const filters = parseFilters(req.query);

    // Paiements filtrés
    const paiements = await Paiement.find(filters)
      .populate('eleve')
      .populate('classe')
      .sort({ dateOperation: -1 })
      .lean();

    // Année scolaire (si présente dans les filtres)
    const anneeScolaire =
      req.query.anneeScolaire || new Date().getFullYear().toString();

    // ====== Calcul total payé ======
    const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);

    // ====== Calcul total attendu (élèves actifs × montantFrais de la classe) ======
    let totalAttendu = 0;
    if (req.query.anneeScolaire) {
      const elevesActifs = await Eleve.find({
        statut: 'actif',
        anneeScolaire: req.query.anneeScolaire,
      }).populate('classe');

      totalAttendu = elevesActifs.reduce((sum, eleve) => {
        return sum + (eleve.classe?.montantFrais || 0);
      }, 0);
    }

    const taux =
      totalAttendu > 0 ? ((totalPaye / totalAttendu) * 100).toFixed(1) : '0.0';

    // ====== Création du classeur Excel ======
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gabkut Schola';
    workbook.created = new Date();

    /***** Onglet 1 : Synthèse (beau) */
    const wsSynthese = workbook.addWorksheet('Synthèse');

    wsSynthese.columns = [
      { header: 'Indicateur', key: 'label', width: 35 },
      { header: 'Valeur', key: 'value', width: 25 },
      { header: 'Commentaire', key: 'comment', width: 60 },
    ];

    wsSynthese.addRows([
      {
        label: 'Année scolaire',
        value: anneeScolaire,
        comment: 'Période de référence du rapport.',
      },
      {
        label: 'Montant total payé',
        value: totalPaye,
        comment: 'Somme des paiements enregistrés sur la période.',
      },
      {
        label: 'Montant total attendu',
        value: totalAttendu,
        comment:
          'Projection des frais à encaisser (élèves actifs × frais annuels de la classe).',
      },
      {
        label: 'Taux de réalisation (%)',
        value: taux,
        comment:
          'Rapport entre le montant payé et le montant attendu, en pourcentage.',
      },
      {
        label: 'Nombre total de paiements',
        value: paiements.length,
        comment: 'Nombre total de transactions enregistrées.',
      },
    ]);

    // Style header
    const headerRow = wsSynthese.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4B64' },
    };

    // Style cellules valeurs
    wsSynthese.getColumn('value').numFmt = '#,##0.00';

    /***** Onglet 2 : Détails paiements */
    const wsDetails = workbook.addWorksheet('Détails paiements');
    wsDetails.columns = [
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Élève', key: 'eleve', width: 28 },
      { header: 'Classe', key: 'classe', width: 18 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Montant', key: 'montant', width: 15 },
      { header: 'Mode', key: 'mode', width: 18 },
      { header: 'Référence', key: 'reference', width: 28 },
      { header: 'Auteur', key: 'auteur', width: 20 },
    ];

    paiements.forEach((p) => {
      wsDetails.addRow({
        date: new Date(p.dateOperation || p.createdAt),
        eleve: p.eleve
          ? `${p.eleve.nom} ${p.eleve.postnom || ''} ${
              p.eleve.prenom || ''
            }`.trim()
          : '',
        classe: p.classe ? p.classe.nom : '',
        type: p.type || 'frais',
        montant: p.montant || 0,
        mode: p.modePaiement || p.moyenPaiement || '',
        reference: p.reference || '',
        auteur: p.auteur || '',
      });
    });

    wsDetails.getColumn('montant').numFmt = '#,##0.00';
    wsDetails.getRow(1).font = { bold: true };

    /***** Onglet 3 : Par classe (avec total attendu / payé / taux) */
    const wsParClasse = workbook.addWorksheet('Par classe');
    wsParClasse.columns = [
      { header: 'Classe', key: 'classe', width: 20 },
      { header: 'Effectif', key: 'effectif', width: 12 },
      { header: 'Frais/élève', key: 'fraisEleve', width: 15 },
      { header: 'Total Attendu', key: 'totalAttendu', width: 18 },
      { header: 'Total Payé', key: 'totalPaye', width: 18 },
      { header: 'Taux (%)', key: 'taux', width: 12 },
    ];

    // Regrouper par classe à partir de paiements
    const mapClasse = new Map();
    paiements.forEach((p) => {
      const nomClasse = p.classe ? p.classe.nom : 'Non définie';
      if (!mapClasse.has(nomClasse)) {
        mapClasse.set(nomClasse, { nomClasse, total: 0 });
      }
      mapClasse.get(nomClasse).total += p.montant || 0;
    });

    // Compléter avec effectif + frais/élève si annéeScolaire fournie
    let classesDB = [];
    if (req.query.anneeScolaire) {
      classesDB = await Classe.find({ isActive: true }).lean();
      for (const classe of classesDB) {
        const effectif = await Eleve.countDocuments({
          classe: classe._id,
          statut: 'actif',
          anneeScolaire: req.query.anneeScolaire,
        });

        const totalAttenduClasse = effectif * (classe.montantFrais || 0);
        const totalPayeClasse = (() => {
          const entry = mapClasse.get(classe.nom);
          return entry ? entry.total : 0;
        })();

        const tauxClasse =
          totalAttenduClasse > 0
            ? ((totalPayeClasse / totalAttenduClasse) * 100).toFixed(1)
            : '0.0';

        wsParClasse.addRow({
          classe: classe.nom,
          effectif,
          fraisEleve: classe.montantFrais || 0,
          totalAttendu: totalAttenduClasse,
          totalPaye: totalPayeClasse,
          taux: tauxClasse,
        });
      }
    } else {
      // Fallback : uniquement total payé par classe
      mapClasse.forEach((val, key) => {
        wsParClasse.addRow({
          classe: key,
          effectif: '',
          fraisEleve: '',
          totalAttendu: '',
          totalPaye: val.total,
          taux: '',
        });
      });
    }

    ['fraisEleve', 'totalAttendu', 'totalPaye'].forEach((k) => {
      wsParClasse.getColumn(k).numFmt = '#,##0.00';
    });
    wsParClasse.getRow(1).font = { bold: true };

    /***** Onglet 4 : Par mode de paiement */
    const wsParMode = workbook.addWorksheet('Par mode');
    wsParMode.columns = [
      { header: 'Mode', key: 'mode', width: 20 },
      { header: 'Nombre', key: 'count', width: 12 },
      { header: 'Montant total', key: 'total', width: 18 },
    ];

    const mapMode = new Map();
    paiements.forEach((p) => {
      const mode = p.modePaiement || p.moyenPaiement || 'Non défini';
      if (!mapMode.has(mode)) {
        mapMode.set(mode, { mode, count: 0, total: 0 });
      }
      const m = mapMode.get(mode);
      m.count += 1;
      m.total += p.montant || 0;
    });

    mapMode.forEach((val) => {
      wsParMode.addRow({
        mode: val.mode,
        count: val.count,
        total: val.total,
      });
    });

    wsParMode.getColumn('total').numFmt = '#,##0.00';
    wsParMode.getRow(1).font = { bold: true };

    /***** Onglet 5 : Par mois (avec taux) */
    const wsParMois = workbook.addWorksheet('Par mois');
    wsParMois.columns = [
      { header: 'Mois', key: 'mois', width: 15 },
      { header: 'Nombre', key: 'count', width: 12 },
      { header: 'Montant total', key: 'total', width: 18 },
      { header: 'Taux (%)', key: 'taux', width: 12 },
    ];

    const mapMois = new Map();
    paiements.forEach((p) => {
      const d = new Date(p.dateOperation || p.createdAt);
      const mois = d.getMonth() + 1;
      const moisNom = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
      ][mois - 1] || `Mois ${mois}`;
      if (!mapMois.has(moisNom)) {
        mapMois.set(moisNom, { moisNom, count: 0, total: 0 });
      }
      const m = mapMois.get(moisNom);
      m.count += 1;
      m.total += p.montant || 0;
    });

    const moisOrder = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ];
    const moisSorted = [...mapMois.values()].sort(
      (a, b) => moisOrder.indexOf(a.moisNom) - moisOrder.indexOf(b.moisNom),
    );

    moisSorted.forEach((m) => {
      wsParMois.addRow({
        mois: m.moisNom,
        count: m.count,
        total: m.total,
        taux: totalPaye > 0 ? ((m.total / totalPaye) * 100).toFixed(1) : '0.0',
      });
    });

    wsParMois.getColumn('total').numFmt = '#,##0.00';
    wsParMois.getColumn('taux').numFmt = '0.0';
    wsParMois.getRow(1).font = { bold: true };

    /***** Onglet 6 : Par trimestre */
    const wsParTrimestre = workbook.addWorksheet('Par trimestre');
    wsParTrimestre.columns = [
      { header: 'Trimestre', key: 'trimestre', width: 15 },
      { header: 'Nombre', key: 'count', width: 12 },
      { header: 'Montant total', key: 'total', width: 18 },
      { header: 'Taux (%)', key: 'taux', width: 12 },
    ];

    const mapTrimestre = new Map();
    paiements.forEach((p) => {
      const d = new Date(p.dateOperation || p.createdAt);
      const mois = d.getMonth() + 1;
      const trimestre = Math.ceil(mois / 3);
      const trimestreNom = `T${trimestre}`;
      if (!mapTrimestre.has(trimestreNom)) {
        mapTrimestre.set(trimestreNom, { trimestreNom, count: 0, total: 0 });
      }
      const t = mapTrimestre.get(trimestreNom);
      t.count += 1;
      t.total += p.montant || 0;
    });

    [...mapTrimestre.values()]
      .sort((a, b) => a.trimestreNom.localeCompare(b.trimestreNom))
      .forEach((t) => {
        wsParTrimestre.addRow({
          trimestre: t.trimestreNom,
          count: t.count,
          total: t.total,
          taux: totalPaye > 0 ? ((t.total / totalPaye) * 100).toFixed(1) : '0.0',
        });
      });

    wsParTrimestre.getColumn('total').numFmt = '#,##0.00';
    wsParTrimestre.getColumn('taux').numFmt = '0.0';
    wsParTrimestre.getRow(1).font = { bold: true };

    /***** Onglet 7 : Résumé exécutif détaillé */
    const wsResume = workbook.addWorksheet('Résumé exécutif');
    wsResume.columns = [
      { header: 'Indicateur', key: 'label', width: 40 },
      { header: 'Valeur', key: 'value', width: 20 },
      { header: 'Commentaire', key: 'comment', width: 60 },
    ];

    wsResume.addRows([
      {
        label: 'Année scolaire',
        value: anneeScolaire,
        comment: 'Période de référence du rapport.',
      },
      {
        label: 'Montant total payé',
        value: totalPaye,
        comment: 'Somme des paiements enregistrés.',
      },
      {
        label: 'Montant total attendu',
        value: totalAttendu,
        comment:
          'Projection basée sur les frais par classe et les élèves actifs.',
      },
      {
        label: 'Taux de réalisation global (%)',
        value: taux,
        comment: 'Indicateur de performance financière globale.',
      },
      {
        label: 'Nombre total de paiements',
        value: paiements.length,
        comment: 'Volume de transactions saisies.',
      },
      {
        label: 'Nombre de classes ayant payé au moins une fois',
        value: [...new Set(paiements.map((p) => p.classe?.nom))].filter(Boolean)
          .length,
        comment: 'Couverture des paiements par classe.',
      },
      {
        label: 'Nombre de modes de paiement utilisés',
        value: [...new Set(paiements.map((p) => p.modePaiement || p.moyenPaiement))].filter(Boolean)
          .length,
        comment: 'Diversité des canaux de paiement.',
      },
    ]);

    const headerResume = wsResume.getRow(1);
    headerResume.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerResume.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF111827' },
    };
    wsResume.getColumn('value').numFmt = '#,##0.00';

    // ====== Envoi ======
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="rapport-financier-gabkut-schola.xlsx"',
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('❌ exportFinanceExcel error:', err);
    res
      .status(500)
      .json({ message: 'Erreur génération Excel', error: err.message });
  }
};



/**
 * GET /admin/reports/dashboard/summary
 * Vue JSON multi-onglets (pour futurs dashboards analytiques)
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    const filters = parseFilters(req.query);

    // Exemple de statistiques de base
    const [totalUsers, totalTeachers, totalStudents, totalParents, totalClasses] =
      await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ role: 'teacher' }),
        Eleve.countDocuments({}),
        User.countDocuments({ role: 'parent' }),
        Classe.countDocuments({}),
      ]);

    const paiements = await Paiement.find(filters).lean();

    const totalPaye = paiements.reduce((s, p) => s + (p.montant || 0), 0);
    const totalAttendu = 0;

    const result = {
      ongletSynthese: {
        totalUsers,
        totalTeachers,
        totalStudents,
        totalParents,
        totalClasses,
        totalPaye,
        totalAttendu,
      },
      ongletParClasse: [], // à remplir comme dans export Excel
      ongletParModePaiement: [],
      ongletTimeline: [],
      ongletComportement: [],
    };

    res.json(result);
  } catch (err) {
    console.error('❌ getDashboardSummary error:', err);
    res.status(500).json({ message: 'Erreur chargement summary', error: err.message });
  }
};

/**
 * POST /admin/reports/relance-parents
 * Relance les parents en retard (email/SMS)
 * body: { channel: 'sms' | 'email' | 'both' }
 */
exports.relanceParentsEnRetard = async (req, res) => {
  try {
    const { channel } = req.body || {};
    const filters = parseFilters(req.query);

    // Ici tu dois utiliser ta vraie logique pour "parents en retard"
    // Par exemple : agrégation sur Paiement + Eleve + Parent
    const parentsEnRetard = []; // TODO: remplir selon ton modèle

    // Boucle d’envoi (pseudo-code)
    for (const parent of parentsEnRetard) {
      const message =
        `Cher parent ${parent.nom}, certains frais scolaires de votre enfant restent en attente. ` +
        `Merci de régulariser la situation dans les meilleurs délais. - Collège Le Mérite`;

      if (channel === 'email' || channel === 'both') {
        // await sendEmail(parent.email, 'Relance frais scolaires', messageHtml, ...);
      }

      if (channel === 'sms' || channel === 'both') {
        // await sendSms(parent.telephone, message);
      }
    }

    res.json({
      success: true,
      total: parentsEnRetard.length,
      message: `Relance lancée vers ${parentsEnRetard.length} parents (canal: ${channel || 'non spécifié'}).`,
    });
  } catch (err) {
    console.error('❌ relanceParentsEnRetard error:', err);
    res
      .status(500)
      .json({ message: 'Erreur relance parents', error: err.message });
  }
};
