/************************************************************
 📘 ADMIN CLASSES CONTROLLER - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const Classe = require('../../models/Classe');
const Eleve = require('../../models/Eleve');
const Paiement = require('../../models/Paiement');

// GET /api/admin/classes
exports.getClasses = async (req, res, next) => {
  try {
    const { niveau, includeInactive } = req.query;

    console.log('🏫 Admin demande liste classes, niveau:', niveau || 'tous');

    const filter = {};
    if (!includeInactive) filter.isActive = true;
    if (niveau) filter.niveau = niveau;

    const classes = await Classe.find(filter).sort({ niveau: 1, nom: 1 });

    const classesWithEffectif = await Promise.all(
      classes.map(async (classe) => {
        const effectif = await Eleve.countDocuments({
          classe: classe._id,
          statut: 'actif'
        });

        return {
          ...classe.toObject(),
          effectif
        };
      })
    );

    res.json({
      success: true,
      count: classesWithEffectif.length,
      classes: classesWithEffectif
    });

    console.log(`✅ ${classesWithEffectif.length} classes envoyées`);
  } catch (error) {
    console.error('❌ Erreur classes:', error);
    next(error);
  }
};

// GET /api/admin/classes/:id
exports.getClasseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const classe = await Classe.findById(id);
    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable.'
      });
    }

    const effectif = await Eleve.countDocuments({
      classe: classe._id,
      statut: 'actif'
    });

    res.json({
      success: true,
      classe: {
        ...classe.toObject(),
        effectif
      }
    });
  } catch (error) {
    console.error('❌ Erreur getClasseById:', error);
    next(error);
  }
};

// POST /api/admin/classes
exports.createClasse = async (req, res, next) => {
  try {
    const {
      nom,
      niveau,
      section,
      montantFrais,
      mensualite,
      isActive
    } = req.body;

    if (!nom || !niveau || montantFrais == null || mensualite == null) {
      return res.status(400).json({
        success: false,
        message: 'Nom, niveau, montantFrais et mensualite sont obligatoires.'
      });
    }

    const anneeScolaire =
      process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';

    const existing = await Classe.findOne({ nom: nom.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Une classe avec ce nom existe déjà.'
      });
    }

    const classe = await Classe.create({
      nom: nom.trim(),
      niveau,
      section: section || '',
      montantFrais: Number(montantFrais),
      mensualite: Number(mensualite),
      anneeScolaire,
      isActive: isActive !== undefined ? Boolean(isActive) : true
    });

    res.status(201).json({
      success: true,
      message: 'Classe créée avec succès.',
      classe
    });
  } catch (error) {
    console.error('❌ Erreur création classe:', error);
    next(error);
  }
};

// PUT /api/admin/classes/:id
// PUT /api/admin/classes/:id
exports.updateClasse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      nom,
      niveau,
      section,
      montantFrais,
      mensualite,
      isActive,
      anneeScolaire, // 🔹 récupéré du body
    } = req.body;

    const classe = await Classe.findById(id);
    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable.',
      });
    }

    if (nom) classe.nom = nom.trim();
    if (niveau) classe.niveau = niveau;
    if (section !== undefined) classe.section = section;
    if (montantFrais != null) classe.montantFrais = Number(montantFrais);
    if (mensualite != null) classe.mensualite = Number(mensualite);
    if (isActive !== undefined) classe.isActive = Boolean(isActive);

    // 🔹 IMPORTANT : toujours garder une anneeScolaire valide
    if (anneeScolaire) {
      classe.anneeScolaire = anneeScolaire;
    } else if (!classe.anneeScolaire) {
      // sécurité si des anciennes classes n'ont pas ce champ
      classe.anneeScolaire = req.body.anneeScolaire || req.query.anneeScolaire || (new Date().getFullYear() + '-' + (new Date().getFullYear() + 1));
    }

    await classe.save();

    res.json({
      success: true,
      message: 'Classe mise à jour avec succès.',
      classe,
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour classe:', error);
    next(error);
  }
};

// DELETE /api/admin/classes/:id
exports.deleteClasse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const classe = await Classe.findById(id);
    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable.',
      });
    }

    const [nbEleves, nbPaiements] = await Promise.all([
      Eleve.countDocuments({ classe: id }),
      Paiement.countDocuments({ classe: id }),
    ]);

    if (nbEleves > 0 || nbPaiements > 0) {
      return res.status(400).json({
        success: false,
        message:
          'Suppression impossible : la classe contient déjà des élèves ou des paiements.',
      });
    }

    await Classe.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Classe supprimée avec succès.',
    });
  } catch (error) {
    console.error('❌ Erreur suppression classe:', error);
    next(error);
  }
};

