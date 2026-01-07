/************************************************************
 👨‍🎓 PERCEPTEUR ÉLÈVES CONTROLLER - VERSION FINALE FUSIONNÉE PRO
 Collège Le Mérite - Gabkut Agency LMK +243822783500

 ✅ Recherche élève avec contacts enrichis
 ✅ Récupération élève par ID avec populate complet
 ✅ Dette antérieure inter-exercice
 ✅ MAJ contacts élève
 ✅ Création élève avec matricule auto 5 chiffres + '-' + 3 lettres (xxxxx-AAA)
 ✅ Export Excel multi-onglets (Élèves + Par classe)
 ✅ Exports PDF / Word (squelettes)
*************************************************************/

const Eleve = require('../../models/Eleve');
const Paiement = require('../../models/Paiement');
const Classe = require('../../models/Classe');
const ExcelJS = require('exceljs');
// 📦 En haut du fichier, ajouter les imports
const PDFDocument = require('pdfkit');
const { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, AlignmentType, BorderStyle, WidthType, convertInchesToTwip } = require('docx');
const { Readable } = require('stream');

const CONFIG = {
  ANNEE_SCOLAIRE: process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026',
};

/* ============================================================
   🔢 GÉNÉRATION MATRICULE PRO 5 CHIFFRES + '-' + 3 LETTRES
   Exemple : 04523-QMT
============================================================ */

function randomMatriculePro() {
  const num = Math.floor(Math.random() * 100000); // 0..99999
  const partNum = String(num).padStart(5, '0');

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const l1 = alphabet[Math.floor(Math.random() * 26)];
  const l2 = alphabet[Math.floor(Math.random() * 26)];
  const l3 = alphabet[Math.floor(Math.random() * 26)];
  const letters = `${l1}${l2}${l3}`;

  return `${partNum}-${letters}`;
}

async function genererMatriculePro() {
  let code;
  let existe = true;
  let essais = 0;

  while (existe && essais < 50) {
    code = randomMatriculePro();
    existe = await Eleve.exists({ matricule: code });
    essais++;
  }

  if (existe) {
    const num = Date.now() % 100000;
    code = String(num).padStart(5, '0') + '-ZZZ';
  }

  return code;
}

/* ============================================================
   🔍 RECHERCHER UN ÉLÈVE (AVEC CONTACTS ENRICHIS)
============================================================ */
exports.rechercherEleve = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        eleves: [],
      });
    }

    console.log('🔍 Recherche élève:', q);

    const regex = new RegExp(q, 'i');

    const eleves = await Eleve.find({
      $or: [
        { nom: regex },
        { prenom: regex },
        { matricule: regex },
      ],
    })
      .populate('classe', 'nom niveau montantFrais mensualite')
      .populate('parent', 'nom prenom email telephone tel contact whatsapp')
      .populate('parentPrincipal', 'nom prenom email telephone tel contact whatsapp')
      .limit(20)
      .lean();

    console.log(`📊 ${eleves.length} élève(s) trouvé(s)`);

    const elevesEnrichis = await Promise.all(
      eleves.map(async (e) => {
        const fraisClasse = e.classe?.mensualite
          ? e.classe.mensualite * 10
          : e.classe?.montantFrais || 0;

        const paiements = await Paiement.find({
          $or: [{ eleve: e._id }, { eleveId: e._id }],
          anneeConcernee: CONFIG.ANNEE_SCOLAIRE,
        });

        const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
        const resteAPayer = Math.max(0, fraisClasse - totalPaye);

        let parentNom = '';
        let parentEmail = '';
        let parentTel = '';
        let parentWhatsapp = '';

        if (e.parent && typeof e.parent === 'object') {
          parentNom = e.parent.nom || e.parent.prenom || '';
          parentEmail = e.parent.email || '';
          parentTel = e.parent.telephone || e.parent.tel || e.parent.contact || '';
          parentWhatsapp = e.parent.whatsapp || parentTel;
        } else if (e.parentPrincipal && typeof e.parentPrincipal === 'object') {
          parentNom = e.parentPrincipal.nom || e.parentPrincipal.prenom || '';
          parentEmail = e.parentPrincipal.email || '';
          parentTel = e.parentPrincipal.telephone || e.parentPrincipal.tel || '';
          parentWhatsapp = e.parentPrincipal.whatsapp || parentTel;
        } else if (Array.isArray(e.parents) && e.parents.length > 0) {
          const p = e.parents[0];
          parentNom = p.nom || p.prenom || '';
          parentEmail = p.email || '';
          parentTel = p.telephone || p.tel || p.contact || '';
          parentWhatsapp = p.whatsapp || parentTel;
        } else {
          parentNom = e.nomParent || e.parentNom || '';
          parentEmail = e.emailParent || e.parentEmail || '';
          parentTel = e.telephoneParent || e.parentTel || '';
          parentWhatsapp = e.whatsappParent || e.parentWhatsapp || parentTel;
        }

        return {
          ...e,
          fraisClasse,
          totalPaye,
          resteAPayer,
          soldeDu: resteAPayer,
          montantDu: fraisClasse,

          emailEleve: e.emailEleve || e.email || '',
          telephoneEleve: e.telephoneEleve || e.contactEleve || e.telephone || '',
          contactEleve: e.contactEleve || e.telephoneEleve || e.telephone || '',
          whatsappEleve: e.whatsappEleve || e.contactEleve || e.telephoneEleve || '',

          parentNom,
          parentEmail,
          parentTel,
          parentWhatsapp,

          parent: {
            nom: parentNom,
            email: parentEmail,
            tel: parentTel,
            whatsapp: parentWhatsapp,
          },
          parentPrincipal: {
            nom: parentNom,
            email: parentEmail,
            tel: parentTel,
            whatsapp: parentWhatsapp,
          },
        };
      }),
    );

    res.json({
      success: true,
      eleves: elevesEnrichis,
    });
  } catch (error) {
    console.error('❌ Erreur rechercherEleve:', error);
    next(error);
  }
};

/* ============================================================
   📋 RÉCUPÉRER UN ÉLÈVE PAR ID (COMPLET)
============================================================ */
exports.getEleveById = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('📋 Récupération élève:', id);

    const eleve = await Eleve.findById(id)
      .populate('classe', 'nom niveau montantFrais mensualite')
      .populate('parent', 'nom prenom email tel telephone whatsapp')
      .populate('parentPrincipal', 'nom prenom email tel telephone whatsapp')
      .lean();

    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève non trouvé',
      });
    }

    const fraisClasse = eleve.classe?.mensualite
      ? eleve.classe.mensualite * 10
      : eleve.classe?.montantFrais || 0;

    const paiements = await Paiement.find({
      $or: [{ eleve: eleve._id }, { eleveId: eleve._id }],
      anneeConcernee: CONFIG.ANNEE_SCOLAIRE,
    });

    const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
    const resteAPayer = Math.max(0, fraisClasse - totalPaye);

    let parentNom = '';
    let parentEmail = '';
    let parentTel = '';
    let parentWhatsapp = '';

    if (eleve.parent && typeof eleve.parent === 'object') {
      parentNom = eleve.parent.nom || eleve.parent.prenom || '';
      parentEmail = eleve.parent.email || '';
      parentTel = eleve.parent.telephone || eleve.parent.tel || eleve.parent.contact || '';
      parentWhatsapp = eleve.parent.whatsapp || parentTel;
    } else if (eleve.parentPrincipal && typeof eleve.parentPrincipal === 'object') {
      parentNom = eleve.parentPrincipal.nom || eleve.parentPrincipal.prenom || '';
      parentEmail = eleve.parentPrincipal.email || '';
      parentTel = eleve.parentPrincipal.telephone || eleve.parentPrincipal.tel || '';
      parentWhatsapp = eleve.parentPrincipal.whatsapp || parentTel;
    } else if (Array.isArray(eleve.parents) && eleve.parents.length > 0) {
      const p = eleve.parents[0];
      parentNom = p.nom || p.prenom || '';
      parentEmail = p.email || '';
      parentTel = p.telephone || p.tel || p.contact || '';
      parentWhatsapp = p.whatsapp || parentTel;
    } else {
      parentNom = eleve.nomParent || eleve.parentNom || '';
      parentEmail = eleve.emailParent || eleve.parentEmail || '';
      parentTel = eleve.telephoneParent || eleve.parentTel || '';
      parentWhatsapp = eleve.whatsappParent || eleve.parentWhatsapp || parentTel;
    }

    const eleveComplet = {
      ...eleve,
      fraisClasse,
      totalPaye,
      resteAPayer,
      soldeDu: resteAPayer,
      montantDu: fraisClasse,
      classeId: eleve.classe?._id,

      emailEleve: eleve.emailEleve || eleve.email || '',
      telephoneEleve: eleve.telephoneEleve || eleve.contactEleve || eleve.telephone || '',
      contactEleve: eleve.contactEleve || eleve.telephoneEleve || eleve.telephone || '',
      whatsappEleve: eleve.whatsappEleve || eleve.contactEleve || eleve.telephoneEleve || '',

      parentNom,
      parentEmail,
      parentTel,
      parentWhatsapp,

      parent: {
        nom: parentNom,
        email: parentEmail,
        tel: parentTel,
        whatsapp: parentWhatsapp,
      },
      parentPrincipal: {
        nom: parentNom,
        email: parentEmail,
        tel: parentTel,
        whatsapp: parentWhatsapp,
      },
    };

    console.log(`✅ Élève ${eleve.nom} récupéré`);

    res.json({
      success: true,
      eleve: eleveComplet,
    });
  } catch (error) {
    console.error('❌ Erreur getEleveById:', error);
    next(error);
  }
};

/* ============================================================
   💰 DETTE ANTÉRIEURE (INTER-EXERCICE)
============================================================ */
exports.getDetteAnterieure = async (req, res, next) => {
  try {
    const { eleveId } = req.params;

    console.log('🔍 Vérification dette antérieure pour:', eleveId);

    const eleve = await Eleve.findById(eleveId).populate('classe').lean();

    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève non trouvé',
      });
    }

    const anneeCourante = eleve.anneeScolaire || CONFIG.ANNEE_SCOLAIRE;
    const parts = anneeCourante.split('-');

    if (parts.length !== 2) {
      return res.json({
        success: true,
        aDette: false,
        hasDette: false,
      });
    }

    const start = parseInt(parts[0], 10);
    const end = parseInt(parts[1], 10);
    const anneePrecedente = `${start - 1}-${end - 1}`;

    console.log(`   Année actuelle: ${anneeCourante}, Précédente: ${anneePrecedente}`);

    let eleveN1 = null;

    if (eleve.matricule) {
      eleveN1 = await Eleve.findOne({
        matricule: eleve.matricule,
        anneeScolaire: anneePrecedente,
      }).populate('classe', 'montantFrais mensualite nom').lean();
    }

    if (!eleveN1 && eleve.nom) {
      eleveN1 = await Eleve.findOne({
        nom: eleve.nom,
        prenom: eleve.prenom || '',
        anneeScolaire: anneePrecedente,
      }).populate('classe', 'montantFrais mensualite nom').lean();
    }

    if (!eleveN1) {
      console.log(`   ❌ Aucune fiche en ${anneePrecedente}`);
      return res.json({
        success: true,
        aDette: false,
        hasDette: false,
        montantDette: 0,
        anneeDette: anneePrecedente,
      });
    }

    const fraisN1 = eleveN1.classe?.mensualite
      ? eleveN1.classe.mensualite * 10
      : eleveN1.classe?.montantFrais || 0;

    if (fraisN1 === 0) {
      return res.json({
        success: true,
        aDette: false,
        hasDette: false,
        anneeDette: anneePrecedente,
      });
    }

    const paiementsN1 = await Paiement.find({
      $or: [{ eleve: eleveN1._id }, { eleveId: eleveN1._id }],
    }).lean();

    const totalPayeN1 = paiementsN1.reduce((sum, p) => sum + (p.montant || 0), 0);
    const detteN1 = Math.max(0, fraisN1 - totalPayeN1);

    console.log(`   📊 Frais N-1: ${fraisN1}, Payé N-1: ${totalPayeN1}, Dette: ${detteN1}`);

    if (detteN1 <= 0) {
      return res.json({
        success: true,
        aDette: false,
        hasDette: false,
        anneeDette: anneePrecedente,
      });
    }

    res.json({
      success: true,
      aDette: true,
      hasDette: true,
      montantDette: Number(detteN1.toFixed(2)),
      montant: Number(detteN1.toFixed(2)),
      anneeDette: anneePrecedente,
      fraisN1,
      payeN1: totalPayeN1,
    });
  } catch (error) {
    console.error('❌ Erreur getDetteAnterieure:', error);
    next(error);
  }
};

/* ============================================================
   📝 METTRE À JOUR LES CONTACTS D'UN ÉLÈVE
============================================================ */
/* ============================================================
   📝 METTRE À JOUR LES CONTACTS D'UN ÉLÈVE
============================================================ */
exports.updateContactsEleve = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      emailEleve,
      telephoneEleve,
      contactEleve,
      whatsappEleve,
      parentNom,
      parentEmail,
      parentTel,
      parentWhatsapp,
    } = req.body;

    console.log(`📝 MAJ contacts élève: ${id}`);

    const eleve = await Eleve.findById(id);

    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève non trouvé',
      });
    }

    // 🔁 nettoyage pour éviter emailEleve: "" avec index unique
    if (emailEleve !== undefined) {
      const val =
        emailEleve && emailEleve.trim() !== '' ? emailEleve.trim() : undefined;
      eleve.emailEleve = val;
    }

    if (telephoneEleve !== undefined) {
      const tel =
        telephoneEleve && telephoneEleve.trim() !== ''
          ? telephoneEleve.trim()
          : undefined;
      eleve.telephoneEleve = tel;
      eleve.contactEleve = tel;
    }

    if (contactEleve !== undefined) {
      eleve.contactEleve =
        contactEleve && contactEleve.trim() !== '' ? contactEleve.trim() : undefined;
    }

    if (whatsappEleve !== undefined) {
      eleve.whatsappEleve =
        whatsappEleve && whatsappEleve.trim() !== ''
          ? whatsappEleve.trim()
          : undefined;
    }

    if (parentNom !== undefined) eleve.parentNom = parentNom || undefined;

    if (parentEmail !== undefined) {
      eleve.emailParent =
        parentEmail && parentEmail.trim() !== '' ? parentEmail.trim() : undefined;
    }

    if (parentTel !== undefined) {
      eleve.telephoneParent =
        parentTel && parentTel.trim() !== '' ? parentTel.trim() : undefined;
    }

    if (parentWhatsapp !== undefined) {
      eleve.whatsappParent =
        parentWhatsapp && parentWhatsapp.trim() !== ''
          ? parentWhatsapp.trim()
          : undefined;
    }

    await eleve.save({ validateModifiedOnly: true });

    console.log(`✅ Contacts élève ${eleve.nom} mis à jour`);

    res.json({
      success: true,
      message: 'Contacts mis à jour avec succès',
      eleve,
    });
  } catch (error) {
    console.error('❌ Erreur updateContactsEleve:', error);
    next(error);
  }
};

/* ============================================================
   🆕 CRÉER UN ÉLÈVE AVEC MATRICULE PRO (5 CHIFFRES + '-' + 3 LETTRES)
============================================================ */
exports.creerEleve = async (req, res) => {
  try {
    const {
      nom,
      prenom,
      sexe,
      dateNaissance,
      age,
      emailEleve,
      contactEleve,
      telephoneEleve,
      whatsappEleve,
      classe,
      anneeScolaire,
      parentPrincipal,
      nomParent,
      emailParent,
      telephoneParent,
      whatsappParent,
      statut,
    } = req.body;

    if (!nom || !prenom || !sexe || !classe || !anneeScolaire) {
      return res.status(400).json({
        success: false,
        message: 'Champs obligatoires manquants (nom, prénom, sexe, classe, année).',
      });
    }

    const classeDoc = await Classe.findById(classe).lean();
    if (!classeDoc) {
      return res.status(400).json({
        success: false,
        message: 'Classe invalide.',
      });
    }

    const matricule = await genererMatriculePro();

    const eleve = new Eleve({
      matricule,
      nom,
      prenom,
      sexe,
      dateNaissance: dateNaissance || undefined,
      age: age || undefined,

      emailEleve: emailEleve || undefined,
      contactEleve: contactEleve || telephoneEleve || undefined,
      telephoneEleve: telephoneEleve || contactEleve || undefined,
      whatsappEleve: whatsappEleve || undefined,

      classe,
      anneeScolaire,

      parentPrincipal: parentPrincipal || {
        nom: nomParent || '',
        tel: telephoneParent || '',
        email: emailParent || undefined,
        whatsapp: whatsappParent || undefined,
      },

      nomParent: nomParent || undefined,
      emailParent: emailParent || undefined,
      telephoneParent: telephoneParent || undefined,
      whatsappParent: whatsappParent || undefined,

      statut: statut || 'actif',
    });

    await eleve.save();

    return res.status(201).json({
      success: true,
      message: 'Élève créé avec succès',
      eleve,
    });
  } catch (error) {
    console.error('❌ Erreur création élève:', error);

    if (error.code === 11000 && error.keyPattern && error.keyPattern.emailEleve) {
      return res.status(400).json({
        success: false,
        message:
          'Cet email élève est déjà utilisé par un autre élève. Veuillez en saisir un autre ou laisser le champ vide.',
        field: 'emailEleve',
      });
    }

    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la création de l’élève",
      error: error.message,
    });
  }
};

/* ============================================================
   📤 EXPORTS ÉLÈVES (Excel / PDF / Word)
   Endpoints appelés par:
   - GET /percepteur/eleves/export/excel
   - GET /percepteur/eleves/export/pdf
   - GET /percepteur/eleves/export/word
============================================================ */

/**
 * Utilitaire commun: récupérer la liste filtrée des élèves
 * pour les exports (même filtres que le GET /percepteur/eleves).
 */
async function getElevesFiltresPourExport(req) {
  const { anneeScolaire, classeId, niveau, mois, q } = req.query;

  const filter = {};
  if (anneeScolaire) filter.anneeScolaire = anneeScolaire;
  if (classeId) filter.classe = classeId;

  if (niveau) {
    const classes = await Classe.find({ niveau }).select('_id').lean();
    filter.classe = { $in: classes.map((c) => c._id) };
  }

  if (q && q.length >= 2) {
    const regex = new RegExp(q, 'i');
    filter.$or = [
      { nom: regex },
      { postnom: regex },
      { prenom: regex },
      { matricule: regex },
    ];
  }

  const eleves = await Eleve.find(filter)
    .populate('classe', 'nom niveau montantFrais mensualite')
    .lean();

  const elevesEnrichis = await Promise.all(
    eleves.map(async (e) => {
      const fraisClasse = e.classe?.mensualite
        ? e.classe.mensualite * 10
        : e.classe?.montantFrais || 0;

      const queryPaiements = {
        $or: [{ eleve: e._id }, { eleveId: e._id }],
        anneeConcernee: e.anneeScolaire || CONFIG.ANNEE_SCOLAIRE,
      };
      if (mois && mois !== 'Annuel') {
        queryPaiements.mois = mois;
      }

      const paiements = await Paiement.find(queryPaiements).lean();
      const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
      const solde = Math.max(0, fraisClasse - totalPaye);
      const tauxPaiement = fraisClasse > 0 ? (totalPaye / fraisClasse) * 100 : 0;
      const estAJour = solde <= 0 || tauxPaiement >= 100;

      let parentNom = e.nomParent || e.parentNom || '';
      let parentTel = e.telephoneParent || e.parentTel || '';
      let parentEmail = e.emailParent || e.parentEmail || '';

      if (e.parent && typeof e.parent === 'object') {
        parentNom = e.parent.nom || e.parent.prenom || parentNom;
        parentEmail = e.parent.email || parentEmail;
        parentTel = e.parent.telephone || e.parent.tel || e.parent.contact || parentTel;
      } else if (e.parentPrincipal && typeof e.parentPrincipal === 'object') {
        parentNom = e.parentPrincipal.nom || e.parentPrincipal.prenom || parentNom;
        parentEmail = e.parentPrincipal.email || parentEmail;
        parentTel = e.parentPrincipal.telephone || e.parentPrincipal.tel || parentTel;
      }

      return {
        ...e,
        classeNom: e.classe?.nom || '',
        niveau: e.classe?.niveau || '',
        fraisTotal: fraisClasse,
        totalPaye,
        solde,
        tauxPaiement,
        estAJour,
        paiements,
        parentNom,
        parentTel,
        parentEmail,
      };
    }),
  );

  return elevesEnrichis;
}

/**
 * 📊 Export Excel multi-onglets (ExcelJS)
 * Onglet 1 : Élèves
 * Onglet 2 : Par classe (agrégations)
 */

exports.exportElevesExcel = async (req, res, next) => {
  try {
    console.log('📤 Export élèves Excel (multi-onglets COMPLET) demandé');

    const eleves = await getElevesFiltresPourExport(req);

    const workbook = new ExcelJS.Workbook();
    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const annee = req.query.anneeScolaire || '';
    const filename = `Palmares_Financier_Eleves_${annee || dateStr}.xlsx`;

    // =========================
    // FEUILLE 1 : ÉLÈVES
    // =========================
    const wsEleves = workbook.addWorksheet('Élèves', {
      views: [{ state: 'frozen', ySplit: 3 }],
    });

    wsEleves.properties.defaultRowHeight = 18;

    // Titre fusionné
    wsEleves.mergeCells('A1:R1');
    const titreCell = wsEleves.getCell('A1');
    titreCell.value = `PALMARES FINANCIER DES ELEVES - ${annee}`;
    titreCell.font = { bold: true, size: 14 };
    titreCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Sous-titre
    wsEleves.mergeCells('A2:R2');
    const sousTitreCell = wsEleves.getCell('A2');
    sousTitreCell.value = `Export du ${dateStr}`;
    sousTitreCell.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
    sousTitreCell.alignment = { horizontal: 'right', vertical: 'middle' };

    wsEleves.columns = [
      { header: 'Matricule', key: 'matricule', width: 14 },
      { header: 'Nom', key: 'nom', width: 16 },
      { header: 'Postnom', key: 'postnom', width: 16 },
      { header: 'Prénom', key: 'prenom', width: 16 },
      { header: 'Sexe', key: 'sexe', width: 6 },
      { header: 'Âge', key: 'age', width: 5 },
      { header: 'Classe', key: 'classeNom', width: 16 },
      { header: 'Niveau', key: 'niveau', width: 12 },
      { header: 'Frais total', key: 'fraisTotal', width: 12 },
      { header: 'Total payé', key: 'totalPaye', width: 12 },
      { header: 'Solde', key: 'solde', width: 12 },
      { header: 'Taux %', key: 'tauxPaiement', width: 8 },
      { header: 'Statut', key: 'statutTexte', width: 10 },
      { header: 'Email élève', key: 'emailEleve', width: 22 },
      { header: 'Tel élève', key: 'telEleve', width: 16 },
      { header: 'Nom parent', key: 'parentNom', width: 20 },
      { header: 'Tel parent', key: 'parentTel', width: 16 },
      { header: 'Email parent', key: 'parentEmail', width: 22 },
    ];

    const headerRow = wsEleves.getRow(3);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    eleves.forEach((e) => {
      const statutTexte = e.estAJour
        ? 'A_JOUR'
        : e.tauxPaiement >= 50
        ? 'PARTIEL'
        : 'RETARD';

      wsEleves.addRow({
        matricule: e.matricule || '',
        nom: e.nom || '',
        postnom: e.postnom || '',
        prenom: e.prenom || '',
        sexe: e.sexe || '',
        age: e.age || '',
        classeNom: e.classeNom || '',
        niveau: e.niveau || '',
        fraisTotal: e.fraisTotal || 0,
        totalPaye: e.totalPaye || 0,
        solde: e.solde || 0,
        tauxPaiement: Number((e.tauxPaiement || 0).toFixed(1)),
        statutTexte,
        emailEleve: e.emailEleve || e.email || '',
        telEleve: e.telephoneEleve || e.contactEleve || e.telephone || '',
        parentNom: e.parentNom || '',
        parentTel: e.parentTel || '',
        parentEmail: e.parentEmail || '',
      });
    });

    wsEleves.columns.forEach((col) => {
      col.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    ['fraisTotal', 'totalPaye', 'solde'].forEach((key) => {
      wsEleves.getColumn(key).numFmt = '#,##0.00';
    });
    wsEleves.getColumn('tauxPaiement').numFmt = '0.0';

    // =========================
    // FEUILLE 2 : PAR CLASSE
    // =========================
    const wsClasses = workbook.addWorksheet('Par classe', {
      views: [{ state: 'frozen', ySplit: 2 }],
    });

    wsClasses.mergeCells('A1:I1');
    wsClasses.getCell('A1').value = 'Récapitulatif par classe';
    wsClasses.getCell('A1').font = { bold: true, size: 12 };
    wsClasses.getCell('A1').alignment = { horizontal: 'left' };

    wsClasses.columns = [
      { header: 'Classe', key: 'classeNom', width: 16 },
      { header: 'Niveau', key: 'niveau', width: 12 },
      { header: 'Nb élèves', key: 'nbEleves', width: 10 },
      { header: 'Nb à jour', key: 'nbAJour', width: 10 },
      { header: 'Nb en retard', key: 'nbRetard', width: 12 },
      { header: 'Taux paiement %', key: 'tauxGlobal', width: 14 },
      { header: 'Total dû', key: 'totalDu', width: 14 },
      { header: 'Total payé', key: 'totalPaye', width: 14 },
      { header: 'Solde', key: 'solde', width: 14 },
    ];

    const headerClasses = wsClasses.getRow(2);
    headerClasses.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerClasses.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D4ED8' },
    };
    headerClasses.alignment = { vertical: 'middle', horizontal: 'center' };

    const mapClasses = new Map();

    eleves.forEach((e) => {
      const key = `${e.classeNom}||${e.niveau}`;
      if (!mapClasses.has(key)) {
        mapClasses.set(key, {
          classeNom: e.classeNom || '',
          niveau: e.niveau || '',
          nbEleves: 0,
          nbAJour: 0,
          totalDu: 0,
          totalPaye: 0,
        });
      }
      const acc = mapClasses.get(key);
      acc.nbEleves += 1;
      if (e.estAJour) acc.nbAJour += 1;
      acc.totalDu += e.fraisTotal || 0;
      acc.totalPaye += e.totalPaye || 0;
    });

    mapClasses.forEach((acc) => {
      const nbRetard = acc.nbEleves - acc.nbAJour;
      const solde = Math.max(0, acc.totalDu - acc.totalPaye);
      const tauxGlobal = acc.totalDu > 0 ? (acc.totalPaye / acc.totalDu) * 100 : 0;

      wsClasses.addRow({
        classeNom: acc.classeNom,
        niveau: acc.niveau,
        nbEleves: acc.nbEleves,
        nbAJour: acc.nbAJour,
        nbRetard,
        tauxGlobal: Number(tauxGlobal.toFixed(1)),
        totalDu: acc.totalDu,
        totalPaye: acc.totalPaye,
        solde,
      });
    });

    wsClasses.columns.forEach((col) => {
      col.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    ['totalDu', 'totalPaye', 'solde'].forEach((key) => {
      wsClasses.getColumn(key).numFmt = '#,##0.00';
    });
    wsClasses.getColumn('tauxGlobal').numFmt = '0.0';

    // ---- Détail par élève dans le même onglet ----
    wsClasses.addRow([]);
    const startDetailRow = wsClasses.lastRow.number + 1;

    wsClasses.getRow(startDetailRow).values = [
      'Classe',
      'Niveau',
      'Matricule',
      'Nom',
      'Postnom',
      'Prénom',
      'Sexe',
      'Montant dû',
      'Total payé',
      'Solde',
      'Statut',
    ];
    wsClasses.getRow(startDetailRow).font = { bold: true };
    wsClasses.getRow(startDetailRow).alignment = { horizontal: 'center' };

    const elevesTries = [...eleves].sort((a, b) => {
      const keyA = `${a.classeNom || ''} ${a.nom || ''}`;
      const keyB = `${b.classeNom || ''} ${b.nom || ''}`;
      return keyA.localeCompare(keyB, 'fr');
    });

    elevesTries.forEach((e) => {
      const statutTexte = e.estAJour
        ? 'A_JOUR'
        : e.tauxPaiement >= 50
        ? 'PARTIEL'
        : 'RETARD';

      wsClasses.addRow([
        e.classeNom || '',
        e.niveau || '',
        e.matricule || '',
        e.nom || '',
        e.postnom || '',
        e.prenom || '',
        e.sexe || '',
        e.fraisTotal || 0,
        e.totalPaye || 0,
        e.solde || 0,
        statutTexte,
      ]);
    });

    // =========================
    // FEUILLE 3 : SYNTHÈSE
    // =========================
    const wsSynthese = workbook.addWorksheet('Synthèse');

    const totalEleves = eleves.length;
    const nbAJourGlobal = eleves.filter(e => e.estAJour).length;
    const nbRetardGlobal = totalEleves - nbAJourGlobal;
    const totalDuGlobal = eleves.reduce((s, e) => s + (e.fraisTotal || 0), 0);
    const totalPayeGlobal = eleves.reduce((s, e) => s + (e.totalPaye || 0), 0);
    const soldeGlobal = Math.max(0, totalDuGlobal - totalPayeGlobal);
    const tauxGlobal = totalDuGlobal > 0 ? (totalPayeGlobal / totalDuGlobal) * 100 : 0;

    wsSynthese.columns = [
      { header: 'Indicateur', key: 'label', width: 32 },
      { header: 'Valeur', key: 'value', width: 22 },
    ];

    wsSynthese.getRow(1).font = { bold: true };
    wsSynthese.getRow(1).alignment = { horizontal: 'center' };

    const lignesSynthese = [
      ['Année scolaire', annee || ''],
      ['Total élèves', totalEleves],
      ['Élèves à jour', nbAJourGlobal],
      ['Élèves en retard', nbRetardGlobal],
      ['Total dû', totalDuGlobal],
      ['Total payé', totalPayeGlobal],
      ['Solde global', soldeGlobal],
      ['Taux de paiement global (%)', Number(tauxGlobal.toFixed(1))],
    ];

    lignesSynthese.forEach(([label, value]) => {
      wsSynthese.addRow({ label, value });
    });

    wsSynthese.getColumn('value').numFmt = '#,##0.00';
    wsSynthese.getRow(2).getCell(2).numFmt = 'General';
    wsSynthese.getRow(9).getCell(2).numFmt = '0.0';

    // =========================
    // FEUILLE 4 : OBS & RECO + PUB
    // =========================
    const wsObs = workbook.addWorksheet('Obs & Reco');

    wsObs.mergeCells('A1:D1');
    wsObs.getCell('A1').value = 'Observations';
    wsObs.getCell('A1').font = { bold: true, size: 12 };
    wsObs.getCell('A1').alignment = { horizontal: 'left' };

    wsObs.mergeCells('A2:D8');
    wsObs.getCell('A2').value =
      'Espace réservé aux observations sur la situation financière des élèves, ' +
      'les retards de paiement, et les particularités par classe.';
    wsObs.getCell('A2').alignment = { wrapText: true, vertical: 'top' };

    wsObs.mergeCells('A10:D10');
    wsObs.getCell('A10').value = 'Recommandations';
    wsObs.getCell('A10').font = { bold: true, size: 12 };
    wsObs.getCell('A10').alignment = { horizontal: 'left' };

    wsObs.mergeCells('A11:D17');
    wsObs.getCell('A11').value =
      'Espace réservé aux recommandations administratives et financières : ' +
      'stratégies de recouvrement, communication aux parents, etc.';
    wsObs.getCell('A11').alignment = { wrapText: true, vertical: 'top' };

    wsObs.mergeCells('A19:D19');
    wsObs.getCell('A19').value = 'Gabkut Schola – Gestion scolaire intelligente';
    wsObs.getCell('A19').font = { bold: true, size: 12 };
    wsObs.getCell('A19').alignment = { horizontal: 'center' };

    wsObs.mergeCells('A20:D24');
    wsObs.getCell('A20').value =
      'Logiciel : Gabkut Schola\n' +
      'Propulsé par : Gabkut Agency LMK\n' +
      'Téléphone / WhatsApp : +243822783500 – wa.me/+243822783500\n' +
      'Email : contact@gabkut.com\n' +
      'Site web : www.gabkut.com';
    wsObs.getCell('A20').alignment = {
      wrapText: true,
      horizontal: 'center',
      vertical: 'top',
    };

    // META & ENVOI
    workbook.creator = 'Gabkut Schola - Gabkut Agency LMK';
    workbook.created = new Date();

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
  } catch (error) {
    console.error('❌ Erreur exportElevesExcel (ExcelJS COMPLET):', error);
    next(error);
  }
};


/**
 * 📄 Export PDF (squelette)
 */


/**
 * ════════════════════════════════════════════════════════════
 * 📄 EXPORT PDF - PALMARES FINANCIER ÉLÈVES
 * ════════════════════════════════════════════════════════════
 */
exports.exportElevesPdf = async (req, res, next) => {
  try {
    console.log('📤 Export élèves PDF demandé');
    const eleves = await getElevesFiltresPourExport(req);

    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const annee = req.query.anneeScolaire || '';
    const filename = `Palmares_Financier_${annee || dateStr}.pdf`;

    // Créer le document PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // ─── En-tête ───
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(`PALMARES FINANCIER DES ELEVES`, { align: 'center' })
      .fontSize(11)
      .font('Helvetica')
      .text(`Année scolaire: ${annee || 'N/A'}`, { align: 'center' })
      .fontSize(9)
      .font('Helvetica-Oblique')
      .text(`Export du ${dateStr}`, { align: 'right' })
      .moveDown(0.5);

    // Ligne horizontale
    doc.strokeColor('#333333').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // ─── Statistiques globales ───
    const totalEleves = eleves.length;
    const totalFrais = eleves.reduce((s, e) => s + (e.fraisTotal || 0), 0);
    const totalPaye = eleves.reduce((s, e) => s + (e.totalPaye || 0), 0);
    const soldeTotal = totalFrais - totalPaye;
    const tauxGlobal = totalFrais > 0 ? ((totalPaye / totalFrais) * 100).toFixed(1) : '0.0';
    const nbAJour = eleves.filter((e) => e.estAJour).length;

    const statText = `Total élèves: ${totalEleves} | À jour: ${nbAJour} | Frais total: ${totalFrais.toLocaleString('fr-FR')} FC | Payé: ${totalPaye.toLocaleString('fr-FR')} FC | Solde: ${soldeTotal.toLocaleString('fr-FR')} FC | Taux: ${tauxGlobal}%`;

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#1E3A8A')
      .text(statText, { align: 'center' })
      .fillColor('#000000')
      .moveDown(0.8);

    // ─── Tableau des élèves (groupé par classe) ───
    const elevesTries = [...eleves].sort((a, b) => {
      const keyA = `${a.classeNom || ''} ${a.nom || ''}`;
      const keyB = `${b.classeNom || ''} ${b.nom || ''}`;
      return keyA.localeCompare(keyB, 'fr');
    });

    let currentClasse = '';

    elevesTries.forEach((e, idx) => {
      // Entête classe si changement
      if (e.classeNom !== currentClasse) {
        if (idx > 0) doc.moveDown(0.5);
        currentClasse = e.classeNom;

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#1D4ED8')
          .text(`📚 ${e.classeNom} (${e.niveau})`, { indent: 10 })
          .fillColor('#000000')
          .fontSize(9);

        // En-têtes colonnes pour cette classe
        const colX = [50, 110, 150, 200, 260, 320, 380, 430, 495];
        const colHeaders = ['Matr.', 'Nom', 'Prénom', 'Frais', 'Payé', 'Solde', 'Taux%', 'Statut', 'Parent'];

        colHeaders.forEach((h, i) => {
          doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .fillColor('#FFFFFF')
            .rect(colX[i], doc.y, 55, 15)
            .fill('#1E3A8A')
            .fillColor('#FFFFFF')
            .text(h, colX[i] + 2, doc.y - 10, { width: 53, align: 'center' });
        });
        doc.moveDown(1);
      }

      // Données de l'élève
      const statutTexte = e.estAJour
        ? '✓ À jour'
        : e.tauxPaiement >= 50
        ? '⚠ Partiel'
        : '✗ Retard';

      const rowY = doc.y;
      const colX = [50, 110, 150, 200, 260, 320, 380, 430, 495];
      const rowHeight = 12;
      const bgColor = idx % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
      const textColor = e.estAJour ? '#166534' : e.tauxPaiement >= 50 ? '#B45309' : '#991B1B';

      // Fond alternant
      doc
        .rect(50, rowY, 505, rowHeight)
        .fillAndStroke(bgColor, '#CCCCCC');

      doc.fontSize(8).fillColor(textColor);

      const data = [
        e.matricule || '-',
        (e.nom || '').substring(0, 10),
        (e.prenom || '').substring(0, 10),
        (e.fraisTotal || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }),
        (e.totalPaye || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }),
        (e.solde || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }),
        `${((e.tauxPaiement || 0).toFixed(1))}%`,
        statutTexte,
        (e.parentNom || '').substring(0, 8),
      ];

      data.forEach((val, i) => {
        doc.text(val, colX[i] + 2, rowY + 1, {
          width: 51,
          align: i >= 3 ? 'right' : 'left',
          height: rowHeight,
        });
      });

      doc.moveDown(0.8);
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
  } catch (error) {
    console.error('❌ Erreur exportElevesPdf:', error);
    next(error);
  }
};

/**
 * ════════════════════════════════════════════════════════════
 * 📝 EXPORT WORD (DOCX) - PALMARES FINANCIER ÉLÈVES
 * ════════════════════════════════════════════════════════════
 */
exports.exportElevesWord = async (req, res, next) => {
  try {
    console.log('📤 Export élèves Word demandé');
    const eleves = await getElevesFiltresPourExport(req);

    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const annee = req.query.anneeScolaire || '';
    const filename = `Palmares_Financier_${annee || dateStr}.docx`;

    // Statistiques globales
    const totalEleves = eleves.length;
    const totalFrais = eleves.reduce((s, e) => s + (e.fraisTotal || 0), 0);
    const totalPaye = eleves.reduce((s, e) => s + (e.totalPaye || 0), 0);
    const soldeTotal = totalFrais - totalPaye;
    const tauxGlobal = totalFrais > 0 ? ((totalPaye / totalFrais) * 100).toFixed(1) : '0.0';
    const nbAJour = eleves.filter((e) => e.estAJour).length;

    // Trier les élèves par classe
    const elevesTries = [...eleves].sort((a, b) => {
      const keyA = `${a.classeNom || ''} ${a.nom || ''}`;
      const keyB = `${b.classeNom || ''} ${b.nom || ''}`;
      return keyA.localeCompare(keyB, 'fr');
    });

    // Construire les sections par classe
    const sections = [];
    let currentClasse = '';
    let currentClasseRows = [];

    elevesTries.forEach((e) => {
      if (e.classeNom !== currentClasse) {
        // Sauvegarder la classe précédente
        if (currentClasse) {
          sections.push({
            classe: currentClasse,
            niveau: eleves.find((x) => x.classeNom === currentClasse)?.niveau || '',
            rows: currentClasseRows,
          });
        }
        currentClasse = e.classeNom;
        currentClasseRows = [];
      }

      const statutTexte = e.estAJour
        ? '✓ À jour'
        : e.tauxPaiement >= 50
        ? '⚠ Partiel'
        : '✗ Retard';

      currentClasseRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 10, type: WidthType.PERCENT },
              children: [new Paragraph(e.matricule || '-')],
            }),
            new TableCell({
              width: { size: 10, type: WidthType.PERCENT },
              children: [new Paragraph(e.nom || '')],
            }),
            new TableCell({
              width: { size: 10, type: WidthType.PERCENT },
              children: [new Paragraph(e.prenom || '')],
            }),
            new TableCell({
              width: { size: 10, type: WidthType.PERCENT },
              children: [new Paragraph((e.fraisTotal || 0).toLocaleString('fr-FR'))],
            }),
            new TableCell({
              width: { size: 10, type: WidthType.PERCENT },
              children: [new Paragraph((e.totalPaye || 0).toLocaleString('fr-FR'))],
            }),
            new TableCell({
              width: { size: 10, type: WidthType.PERCENT },
              children: [new Paragraph((e.solde || 0).toLocaleString('fr-FR'))],
            }),
            new TableCell({
              width: { size: 8, type: WidthType.PERCENT },
              children: [new Paragraph(`${(e.tauxPaiement || 0).toFixed(1)}%`)],
            }),
            new TableCell({
              width: { size: 12, type: WidthType.PERCENT },
              children: [new Paragraph(statutTexte)],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENT },
              children: [new Paragraph(e.parentNom || '')],
            }),
          ],
        }),
      );
    });

    // Ajouter la dernière classe
    if (currentClasse) {
      sections.push({
        classe: currentClasse,
        niveau: eleves.find((x) => x.classeNom === currentClasse)?.niveau || '',
        rows: currentClasseRows,
      });
    }

    // Construire le document
    const docChildren = [
      // Titre
      new Paragraph({
        text: 'PALMARES FINANCIER DES ELEVES',
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        run: {
          bold: true,
          size: 28,
          color: '1E3A8A',
        },
      }),

      // Année scolaire
      new Paragraph({
        text: `Année scolaire: ${annee || 'N/A'}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 50 },
      }),

      // Date export
      new Paragraph({
        text: `Export du ${dateStr}`,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200 },
        run: { italic: true, size: 18 },
      }),

      // Statistiques
      new Paragraph({
        text: `Résumé : ${totalEleves} élèves | ${nbAJour} à jour | Frais: ${totalFrais.toLocaleString('fr-FR')} FC | Payé: ${totalPaye.toLocaleString('fr-FR')} FC | Solde: ${soldeTotal.toLocaleString('fr-FR')} FC | Taux: ${tauxGlobal}%`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        shading: {
          type: 'clear',
          fill: 'E0E7FF',
        },
        run: { bold: true, size: 20 },
      }),
    ];

    // Ajouter une section par classe
    sections.forEach((sec, secIdx) => {
      if (secIdx > 0) {
        docChildren.push(
          new Paragraph({
            text: '',
            spacing: { after: 200 },
          }),
        );
      }

      // Titre de la classe
      docChildren.push(
        new Paragraph({
          text: `📚 Classe: ${sec.classe} (${sec.niveau})`,
          spacing: { after: 100 },
          run: { bold: true, size: 22, color: '1D4ED8' },
        }),
      );

      // Tableau des élèves de cette classe
      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENT },
          rows: [
            // En-têtes
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 10, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [
                    new Paragraph({
                      text: 'Matr.',
                      run: { bold: true, color: 'FFFFFF', size: 18 },
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 10, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [
                    new Paragraph({
                      text: 'Nom',
                      run: { bold: true, color: 'FFFFFF', size: 18 },
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 10, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [
                    new Paragraph({
                      text: 'Prénom',
                      run: { bold: true, color: 'FFFFFF', size: 18 },
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 10, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [
                    new Paragraph({
                      text: 'Frais',
                      run: { bold: true, color: 'FFFFFF', size: 18 },
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 10, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [
                    new Paragraph({
                      text: 'Payé',
                      run: { bold: true, color: 'FFFFFF', size: 18 },
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 10, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [
                    new Paragraph({
                      text: 'Solde',
                      run: { bold: true, color: 'FFFFFF', size: 18 },
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 8, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [
                    new Paragraph({
                      text: 'Taux%',
                      run: { bold: true, color: 'FFFFFF', size: 18 },
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 12, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [
                    new Paragraph({
                      text: 'Statut',
                      run: { bold: true, color: 'FFFFFF', size: 18 },
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 15, type: WidthType.PERCENT },
                  shading: { fill: '1E3A8A' },
                  children: [
                    new Paragraph({
                      text: 'Parent',
                      run: { bold: true, color: 'FFFFFF', size: 18 },
                    }),
                  ],
                }),
              ],
            }),
            // Données
            ...sec.rows,
          ],
          borders: {
            top: {
              color: '000000',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
            bottom: {
              color: '000000',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
            left: {
              color: '000000',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
            right: {
              color: '000000',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
            insideHorizontal: {
              color: 'CCCCCC',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
            insideVertical: {
              color: 'CCCCCC',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
        }),
      );
    });

    // Pied de page
    docChildren.push(
      new Paragraph({
        text: '',
        spacing: { before: 200 },
      }),
      new Paragraph({
        text: 'Généré par Gabkut-École | Collège Le Mérite',
        alignment: AlignmentType.CENTER,
        run: { italic: true, size: 18, color: '666666' },
      }),
      new Paragraph({
        text: `${new Date().toLocaleString('fr-FR')}`,
        alignment: AlignmentType.CENTER,
        run: { italic: true, size: 18, color: '666666' },
      }),
    );

    const doc = new Document({
      sections: [
        {
          children: docChildren,
          properties: {
            page: {
              margins: {
                top: convertInchesToTwip(0.5),
                right: convertInchesToTwip(0.5),
                bottom: convertInchesToTwip(0.5),
                left: convertInchesToTwip(0.5),
              },
            },
          },
        },
      ],
    });

    // Générer et envoyer
    const buffer = await Packer.toBuffer(doc);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  } catch (error) {
    console.error('❌ Erreur exportElevesWord:', error);
    next(error);
  }
};

console.log('✅ Exports PDF/Word Controller PRO chargé (PDFKit + docx library)');
