/************************************************************
 📘 ADMIN ELEVES CONTROLLER - CRUD COMPLET
 Collège Le Mérite - Gabkut Schola
 Gabkut Agency LMK +243822783500
*************************************************************/

const Eleve = require('../../models/Eleve');
const Classe = require('../../models/Classe');
const Paiement = require('../../models/Paiement');

// ========== HELPER: Génération matricule unique ==========
async function generateMatricule(nom, prenom) {
  const initiales = (nom.substring(0, 2) + (prenom.substring(0, 1) || '')).toUpperCase();
  const anneeCourte = new Date().getFullYear().toString().slice(-2);

  const lastEleve = await Eleve.findOne({
    matricule: new RegExp(`^${initiales}-${anneeCourte}`)
  }).sort({ matricule: -1 });

  let numero = 1;
  if (lastEleve && lastEleve.matricule) {
    const match = lastEleve.matricule.match(/-(\d+)$/);
    if (match) {
      numero = parseInt(match[1], 10) + 1;
    }
  }

  return `${initiales}-${anneeCourte}${String(numero).padStart(2, '0')}`;
}

// @desc    GET - Liste des élèves
// @route   GET /api/admin/eleves?classe=xxx&anneeScolaire=xxx
// @access  Admin only (GET)
exports.getEleves = async (req, res, next) => {
  try {
    const { classe, anneeScolaire } = req.query;

    console.log('🎓 Admin demande liste élèves');

    const filter = { statut: 'actif' };
    if (classe) filter.classe = classe;
    if (anneeScolaire) filter.anneeScolaire = anneeScolaire;

    const eleves = await Eleve.find(filter)
      .populate('classe', 'nom niveau montantFrais mensualite')
      .sort({ nom: 1, prenom: 1 })
      .limit(200);

    res.json({
      success: true,
      count: eleves.length,
      eleves
    });

    console.log(`✅ ${eleves.length} élèves envoyés`);
  } catch (error) {
    console.error('❌ Erreur élèves:', error);
    next(error);
  }
};

// @desc    GET - Détails d'un élève
// @route   GET /api/admin/eleves/:id
// @access  Admin only (GET)
exports.getEleveById = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('📖 Admin demande élève:', id);

    const eleve = await Eleve.findById(id)
      .populate('classe', 'nom niveau montantFrais mensualite');

    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable'
      });
    }

    res.json({
      success: true,
      eleve
    });
  } catch (error) {
    console.error('❌ Erreur élève:', error);
    next(error);
  }
};

// @desc    GET - Paiements d'un élève
// @route   GET /api/admin/eleves/:id/paiements
// @access  Admin only (GET)
exports.getElevePaiements = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { anneeScolaire, mois } = req.query;

    console.log('💰 Admin demande paiements élève:', id);

    const eleve = await Eleve.findById(id).populate('classe');
    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable'
      });
    }

    const filter = { eleve: id };
    if (anneeScolaire) filter.anneeScolaire = anneeScolaire;
    if (mois) filter.mois = mois;

    const paiements = await Paiement.find(filter)
      .sort({ datePaiement: -1 });

    // Calculer totaux
    const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
    const totalAttendu = eleve.classe ? eleve.classe.montantFrais : 0;
    const totalReste = totalAttendu - totalPaye;

    res.json({
      success: true,
      paiements,
      total: paiements.length,
      totaux: {
        attendu: totalAttendu,
        paye: totalPaye,
        reste: totalReste
      }
    });

    console.log(`✅ ${paiements.length} paiements envoyés`);
  } catch (error) {
    console.error('❌ Erreur paiements:', error);
    next(error);
  }
};

// @desc    POST - Créer un élève (LECTURE SEULE pour admin, mais on garde pour complétude)
// @route   POST /api/admin/eleves
// @access  Admin only (GET only normalement, mais on inclut pour référence)
exports.createEleve = async (req, res, next) => {
  try {
    const {
      nom, prenom, sexe, dateNaissance, classe,
      parent, anneeScolaire
    } = req.body;

    console.log('🆕 Admin création élève (read-only mode)');

    // Validation
    if (!nom || !prenom || !sexe || !dateNaissance || !classe) {
      return res.status(400).json({
        success: false,
        message: 'Champs obligatoires : nom, prenom, sexe, dateNaissance, classe'
      });
    }

    // Vérifier classe existe
    const classeData = await Classe.findById(classe);
    if (!classeData) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable'
      });
    }

    // Générer matricule
    const matricule = await generateMatricule(nom, prenom);

    // Créer élève
    const eleve = await Eleve.create({
      matricule,
      nom,
      prenom,
      sexe,
      dateNaissance,
      classe,
      parent,
      anneeScolaire: anneeScolaire || process.env.ANNEE_SCOLAIRE_DEFAUT,
      montantDu: classeData.montantFrais || 0,
      montantPaye: 0,
      statut: 'actif'
    });

    // Incrémenter effectif
    await Classe.findByIdAndUpdate(classe, { $inc: { effectif: 1 } });

    res.status(201).json({
      success: true,
      message: 'Élève créé avec succès',
      eleve
    });

    console.log('✅ Élève créé:', eleve.matricule);
  } catch (error) {
    console.error('❌ Erreur création élève:', error);
    next(error);
  }
};

// @desc    PUT - Modifier un élève (LECTURE SEULE pour admin)
// @route   PUT /api/admin/eleves/:id
// @access  Admin only (GET only normalement)
exports.updateEleve = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('✏️ Admin modification élève (read-only mode):', id);

    const eleve = await Eleve.findById(id);
    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable'
      });
    }

    // Appliquer les modifications
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== '_id' && key !== 'matricule') {
        eleve[key] = updates[key];
      }
    });

    await eleve.save();

    res.json({
      success: true,
      message: 'Élève modifié avec succès',
      eleve
    });

    console.log('✅ Élève modifié:', id);
  } catch (error) {
    console.error('❌ Erreur modification élève:', error);
    next(error);
  }
};

// @desc    DELETE - Supprimer un élève (LECTURE SEULE pour admin)
// @route   DELETE /api/admin/eleves/:id
// @access  Admin only (GET only normalement)
exports.deleteEleve = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Admin suppression élève (read-only mode):', id);

    const eleve = await Eleve.findById(id);
    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable'
      });
    }

    // Décrémenter effectif classe
    if (eleve.classe) {
      await Classe.findByIdAndUpdate(eleve.classe, { $inc: { effectif: -1 } });
    }

    await Eleve.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Élève supprimé avec succès'
    });

    console.log('✅ Élève supprimé:', id);
  } catch (error) {
    console.error('❌ Erreur suppression élève:', error);
    next(error);
  }
};
