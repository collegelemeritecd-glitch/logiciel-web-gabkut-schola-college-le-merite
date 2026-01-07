/************************************************************
 📘 ADMIN STUDENTS CONTROLLER
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const Eleve = require('../../models/Eleve');

exports.getStudents = async (req, res, next) => {
  try {
    const {
      anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026',
      classeId,
      statut = 'actif',
      limit = 100,
      page = 1
    } = req.query;

    console.log('📚 Get Students:', { anneeScolaire, classeId, statut, limit, page });

    // Construire le filtre
    const filter = {
      anneeScolaire
    };

    if (classeId) {
      filter.classe = classeId;
    }

    if (statut) {
      filter.statut = statut;
    }

    // Pagination
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Requête avec populate
    const students = await Eleve.find(filter)
      .populate('classe', 'nom niveau')
      .populate('parent', 'nom prenom telephone email')
      .limit(parseInt(limit, 10))
      .skip(skip)
      .sort({ nom: 1, prenom: 1 });

    // Compter le total
    const total = await Eleve.countDocuments(filter);

    res.json({
      success: true,
      students,
      count: students.length,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      filters: { anneeScolaire, classeId, statut }
    });

    console.log(`✅ ${students.length}/${total} élèves récupérés`);
  } catch (error) {
    console.error('❌ Erreur getStudents:', error);
    next(error);
  }
};

exports.getStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const student = await Eleve.findById(id)
      .populate('classe', 'nom niveau montantFrais mensualite')
      .populate('parent', 'nom prenom telephone email adresse');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable'
      });
    }

    res.json({
      success: true,
      student
    });

    console.log(`✅ Élève ${student.nom} ${student.prenom} récupéré`);
  } catch (error) {
    console.error('❌ Erreur getStudentById:', error);
    next(error);
  }
};
