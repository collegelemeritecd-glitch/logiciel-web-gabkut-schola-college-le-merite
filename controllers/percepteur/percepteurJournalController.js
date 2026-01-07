/************************************************************
 📝 PERCEPTEUR JOURNAL CONTROLLER - BEAST MODE
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const Paiement = require('../../models/Paiement');
const Eleve = require('../../models/Eleve');
const Classe = require('../../models/Classe');

// ========== JOURNAL DU JOUR (AUJOURD'HUI) ==========
exports.getJournal = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('📝 Journal du jour:', today.toISOString());

    const paiements = await Paiement.find({
      datePaiement: {
        $gte: today,
        $lt: tomorrow
      },
      statut: 'validé'
    })
      .populate('eleve', 'nom prenom matricule')
      .populate({
        path: 'eleve',
        populate: { path: 'classe', select: 'nom' }
      })
      .populate('percepteur', 'fullName email')
      .sort({ datePaiement: -1 })
      .lean();

    // KPIs du jour
    const kpi = {
      nb: paiements.length,
      total: paiements.reduce((sum, p) => sum + (p.montant || 0), 0)
    };

    // Classe dominante
    const classesCount = {};
    paiements.forEach(p => {
      const classeNom = p.eleve?.classe?.nom || p.classeNom || 'Inconnue';
      classesCount[classeNom] = (classesCount[classeNom] || 0) + 1;
    });

    const classeDominante = Object.keys(classesCount).reduce((a, b) => 
      classesCount[a] > classesCount[b] ? a : b, 'Aucune'
    );

    // Heure de pointe
    const heuresCount = {};
    paiements.forEach(p => {
      const heure = new Date(p.datePaiement).getHours();
      heuresCount[heure] = (heuresCount[heure] || 0) + 1;
    });

    const heurePointe = Object.keys(heuresCount).reduce((a, b) => 
      heuresCount[a] > heuresCount[b] ? a : b, null
    );

    kpi.classe = classeDominante;
    kpi.heure = heurePointe;

    console.log(`✅ Journal: ${paiements.length} paiements, Total: ${kpi.total} USD`);

    res.json({
      success: true,
      paiements,
      kpi,
      date: today
    });

  } catch (error) {
    console.error('❌ Erreur getJournal:', error);
    next(error);
  }
};

// ========== JOURNAL PAR DATE ==========
// ========== JOURNAL PAR DATE ==========
exports.getJournalByDate = async (req, res, next) => {
  try {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date requise'
      });
    }

    // ⬇️ SUPPRIMER la validation parsed / isNaN
    const dateDebut = new Date(date + 'T00:00:00');
    const dateFin = new Date(date + 'T23:59:59.999Z');

    console.log('📝 Journal pour date:', date);

    // ... le reste inchangé


    const paiements = await Paiement.find({
      datePaiement: {
        $gte: dateDebut,
        $lt: dateFin
      },
      statut: 'validé'
    })
      .populate('eleve', 'nom prenom matricule')
      .populate({
        path: 'eleve',
        populate: { path: 'classe', select: 'nom' }
      })
      .populate('percepteur', 'fullName email')
      .sort({ datePaiement: -1 })
      .lean();

    // KPIs
    const kpi = {
      nb: paiements.length,
      total: paiements.reduce((sum, p) => sum + (p.montant || 0), 0)
    };

    // Classe dominante
    const classesCount = {};
    paiements.forEach(p => {
      const classeNom = p.eleve?.classe?.nom || p.classeNom || 'Inconnue';
      classesCount[classeNom] = (classesCount[classeNom] || 0) + 1;
    });

    const classeDominante =
      Object.keys(classesCount).length > 0
        ? Object.keys(classesCount).reduce((a, b) =>
            classesCount[a] > classesCount[b] ? a : b
          )
        : 'Aucune';

    // Heure de pointe
    const heuresCount = {};
    paiements.forEach(p => {
      const heure = new Date(p.datePaiement).getHours();
      heuresCount[heure] = (heuresCount[heure] || 0) + 1;
    });

    const heurePointe =
      Object.keys(heuresCount).length > 0
        ? Object.keys(heuresCount).reduce((a, b) =>
            heuresCount[a] > heuresCount[b] ? a : b
          )
        : null;

    kpi.classe = classeDominante;
    kpi.heure = heurePointe;

    console.log(`✅ Journal ${date}: ${paiements.length} paiements, Total: ${kpi.total} USD`);

    res.json({
      success: true,
      paiements,
      kpi,
      date: dateDebut
    });
  } catch (error) {
    console.error('❌ Erreur getJournalByDate:', error);
    next(error);
  }
};


console.log('✅ Percepteur Journal Controller chargé');
