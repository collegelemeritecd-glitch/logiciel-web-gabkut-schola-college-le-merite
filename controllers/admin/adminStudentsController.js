/************************************************************
 📘 ADMIN STUDENTS CONTROLLER
 Collège Le Mérite
 Gabkut Schola • Gabkut Agency LMK +243822783500
 ************************************************************/

const Eleve = require('../../models/Eleve');
const Classe = require('../../models/Classe');
const Paiement = require('../../models/Paiement');

// Helper: construire filtre de base
function buildFilter({ anneeScolaire, classeId, statut }) {
  const filter = {};
  if (anneeScolaire) filter.anneeScolaire = anneeScolaire;
  if (classeId) filter.classe = classeId;
  if (statut) filter.statut = statut;
  return filter;
}

/**
 * GET /api/admin/students
 * Liste des élèves (NO LIMIT, pagination front) + paiements
 */
exports.getStudents = async (req, res, next) => {
  try {
    const anneeScolaire =
      req.query.anneeScolaire ||
      process.env.ANNEE_SCOLAIRE_DEFAUT ||
      '2025-2026';
    const { classeId, statut } = req.query;

    console.log('Get Students + paiements (NO LIMIT, pagination front)', {
      anneeScolaire,
      classeId,
      statut,
    });

    // 1) Filtre de base élèves
    const filter = { anneeScolaire };
    if (classeId) filter.classe = classeId;
    if (statut) filter.statut = statut;

    // 2) Tous les élèves
    const students = await Eleve.find(filter)
      .populate('classe', 'nom niveau montantFrais mensualite')
      .populate('parent', 'nom prenom telephone email adresse')
      .sort({ nom: 1, prenom: 1 })
      .lean();

    const total = students.length;

    if (!students.length) {
      return res.json({
        success: true,
        students: [],
        count: 0,
        total: 0,
        page: 1,
        pages: 1,
        filters: { anneeScolaire, classeId, statut },
      });
    }

    const eleveIds = students.map(e => e._id);

    // 3) Agrégation des paiements (attention au statut - voir plus bas)
    const paiementsParEleve = await Paiement.aggregate([
      {
        $match: {
          // dans ta base: "validé" et pas "valid"
          statut: { $in: ['valid', 'validé', 'valide'] },
          anneeScolaire,
          eleve: { $in: eleveIds },
        },
      },
      {
        $group: {
          _id: '$eleve',
          totalPaye: { $sum: '$montant' },
          paiements: {
            $push: {
              mois: '$mois',
              montant: '$montant',
              datePaiement: '$datePaiement',
              typePaiement: '$typePaiement',
              modePaiement: '$modePaiement',
            },
          },
        },
      },
    ]);

    const mapPaiements = new Map(
      paiementsParEleve.map(p => [p._id.toString(), p]),
    );

    // 4) Fusion élèves + totaux paiements
    const studentsAvecPaiements = students.map(eleve => {
      const key = eleve._id.toString();
      const agg = mapPaiements.get(key);

      const fraisTotal =
        eleve.fraisTotal ||
        eleve.montantDu ||
        (eleve.classe && eleve.classe.montantFrais) ||
        0;

      const totalPaye =
        (agg && agg.totalPaye) ||
        eleve.totalPaye ||
        eleve.montantPaye ||
        0;

      const solde = Math.max(0, fraisTotal - totalPaye);
      const tauxPaiement = fraisTotal > 0 ? (totalPaye / fraisTotal) * 100 : 0;
      const estAJour = solde <= 0 || tauxPaiement >= 100;

      return {
        ...eleve,
        fraisTotal,
        totalPaye,
        solde,
        tauxPaiement,
        estAJour,
        paiements: (agg && agg.paiements) || [],
      };
    });

    res.json({
      success: true,
      students: studentsAvecPaiements,
      count: studentsAvecPaiements.length,
      total,
      page: 1,
      pages: 1,
      filters: { anneeScolaire, classeId, statut },
    });

    console.log(
      `${studentsAvecPaiements.length}/${total} élèves + paiements retournés (NO LIMIT)`,
    );
  } catch (error) {
    console.error('Erreur getStudents + paiements', error);
    next(error);
  }
};

/**
 * GET /api/admin/students/:id
 * Détail d'un élève
 */
exports.getStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const student = await Eleve.findById(id)
      .populate('classe', 'nom niveau montantFrais mensualite')
      .populate('parent', 'nom prenom telephone email adresse');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable',
      });
    }

    res.json({
      success: true,
      student,
    });

    console.log(`✅ Élève ${student.nom} ${student.prenom} récupéré`);
  } catch (error) {
    console.error('❌ Erreur getStudentById:', error);
    next(error);
  }
};

/**
 * POST /api/admin/students
 * Créer un élève
 */
exports.createStudent = async (req, res, next) => {
  try {
    const {
      nom,
      postnom,
      prenom,
      genre,               // M / F depuis le front
      dateNaissance,
      lieuNaissance,
      classe,
      niveau,
      section,
      adresseEleve,
      telephoneEleve,
      emailEleve,
      nomParent,
      adresseParent,
      contactAppel,
      contactWhatsapp,
      emailParent,
      noteAdministrative,
      anneeScolaire,
    } = req.body;

    console.log('🟢 Admin création élève:', { nom, prenom, classe });

    // validation fonctionnelle
    if (!nom || !prenom || !genre || !dateNaissance || !classe) {
      return res.status(400).json({
        success: false,
        message:
          'Champs obligatoires: nom, prenom, genre, dateNaissance, classe',
      });
    }

    const classeData = await Classe.findById(classe);
    if (!classeData) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable',
      });
    }

    // Matricule simple (à remplacer si tu veux par generateMatricule)
    const anneeCourte = new Date().getFullYear().toString().slice(-2);
    const baseMat = (nom.substring(0, 2) + prenom.substring(0, 1)).toUpperCase();
    const random = Math.floor(10000 + Math.random() * 89999);
    const matricule = `${random}-${baseMat}${anneeCourte}`;

    // Mapper correctement sur le schéma Eleve
    const eleveData = {
      nom,
      postnom,
      prenom,
      sexe: genre, // 🔁 IMPORTANT: le modèle attend `sexe` requis
      dateNaissance,
      lieuNaissance,
      classe,
      niveau,
      section,
      adresse: adresseEleve,
      telephone: telephoneEleve,
      email: emailEleve,
      noteAdministrative,
      matricule,
      anneeScolaire:
        anneeScolaire ||
        process.env.ANNEE_SCOLAIRE_DEFAUT ||
        '2025-2026',
      montantDu: classeData.montantFrais || 0,
      montantPaye: 0,
      statut: 'actif',
    };

    // Sous-document parent (au lieu d'une simple string)
    if (nomParent || adresseParent || contactAppel || contactWhatsapp || emailParent) {
      eleveData.parent = {
        nom: nomParent || undefined,
        adresse: adresseParent || undefined,
        telephone: contactAppel || undefined,
        whatsapp: contactWhatsapp || undefined,
        email: emailParent || undefined,
      };
    }

    const eleve = await Eleve.create(eleveData);

    await Classe.findByIdAndUpdate(classe, { $inc: { effectif: 1 } });

    res.status(201).json({
      success: true,
      message: 'Élève créé avec succès',
      student: eleve,
    });

    console.log('✅ Élève créé:', eleve.matricule);
  } catch (error) {
    console.error('❌ Erreur createStudent:', error);
    next(error);
  }
};

/**
 * PUT /api/admin/students/:id
 * Mettre à jour un élève
 */
exports.updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('🟡 Admin modification élève:', id);

    const eleve = await Eleve.findById(id);
    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable',
      });
    }

    const updates = { ...req.body };

    // 🔁 si le front envoie genre, on le recopie dans sexe
    if (updates.genre && !updates.sexe) {
      updates.sexe = updates.genre;
    }

    // Recomposition éventuelle du sous-doc parent
    const parentPayload = {};
    if (updates.nomParent !== undefined) parentPayload.nom = updates.nomParent;
    if (updates.adresseParent !== undefined) parentPayload.adresse = updates.adresseParent;
    if (updates.contactAppel !== undefined) parentPayload.telephone = updates.contactAppel;
    if (updates.contactWhatsapp !== undefined) parentPayload.whatsapp = updates.contactWhatsapp;
    if (updates.emailParent !== undefined) parentPayload.email = updates.emailParent;
    if (Object.keys(parentPayload).length > 0) {
      updates.parent = parentPayload;
    }

    Object.keys(updates).forEach(key => {
      if (
        updates[key] !== undefined &&
        key !== 'id' &&
        key !== '_id' &&
        key !== 'matricule'
      ) {
        eleve[key] = updates[key];
      }
    });

    await eleve.save();

    res.json({
      success: true,
      message: 'Élève modifié avec succès',
      student: eleve,
    });

    console.log('✅ Élève modifié:', id);
  } catch (error) {
    console.error('❌ Erreur updateStudent:', error);
    next(error);
  }
};


/**
 * DELETE /api/admin/students/:id
 * Supprimer un élève
 */
exports.deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('🛑 Admin suppression élève:', id);

    const eleve = await Eleve.findById(id);
    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable',
      });
    }

    if (eleve.classe) {
      await Classe.findByIdAndUpdate(eleve.classe, { $inc: { effectif: -1 } });
    }

    await Eleve.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Élève supprimé avec succès',
    });

    console.log('✅ Élève supprimé:', id);
  } catch (error) {
    console.error('❌ Erreur deleteStudent:', error);
    next(error);
  }
};
