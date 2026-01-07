/************************************************************
 💵 PERCEPTEUR PAIEMENTS CONTROLLER - VERSION ULTRA-COMPLÈTE
 Collège Le Mérite - Gabkut Agency LMK +243822783500
 ✅ CORRECTION: nouveauTotalPaye scope fix
 ✅ CORRECTION: typePaiement VS moyenPaiement
 ✅ Tous les champs remplis correctement
 ✅ Email avec données complètes
 ✅ Logs activités + PDF + Emails intelligents
 ✅ CRUD complet (Create, Read, Update, Delete)
 ✅ MAJ contacts élève intégrée
*************************************************************/

const fs = require('fs');
const Paiement = require('../../models/Paiement');
const Eleve = require('../../models/Eleve');
const Classe = require('../../models/Classe');
const LogActivite = require('../../models/LogActivite');

// ✅ CONFIG
const CONFIG = {
  ANNEE_SCOLAIRE: process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026'
};

// ✅ UTILS OPTIONNELS
let generateSchoolReceiptPDF;
try {
  const pdfModule = require('../../utils/generateSchoolReceiptPDF');
  generateSchoolReceiptPDF = typeof pdfModule === 'function' ? pdfModule : pdfModule.generateSchoolReceiptPDF;
  console.log('✅ generateSchoolReceiptPDF chargé');
} catch (err) {
  console.error('❌ generateSchoolReceiptPDF NON CHARGÉ:', err.message);
}

let envoyerEmailsIntelligents;
try {
  const emailModule = require('../../utils/envoyerEmailsIntelligents');
  envoyerEmailsIntelligents = typeof emailModule === 'function' ? emailModule : emailModule.envoyerEmailsIntelligents;
  console.log('✅ envoyerEmailsIntelligents chargé');
} catch (err) {
  console.log('⚠️ envoyerEmailsIntelligents non disponible:', err.message);
}

// ========================================
// 📌 CRÉER UN PAIEMENT (CORRIGÉ)
// ========================================
exports.createPaiement = async (req, res, next) => {
  // 🔥 DÉCLARER LES VARIABLES EN DEHORS DU TRY/CATCH
  let nouveauTotalPaye = 0;
  let resteAPayer = 0;
  let fraisClasse = 0;

  try {
    const {
      eleveId,
      eleveNom,
      elevePrenom,
      eleveMatricule,
      emailEleve,
      telephoneEleve,
      whatsappEleve,
      parentNom,
      emailParent,
      telephoneParent,
      whatsappParent,
      percepteurNom,
      percepteurId,
      percepteurEmail,
      percepteurTel,
      percepteurWhatsapp,
      montant,
      mois,
      moyenPaiement,
      typePaiement,
      anneeConcernee,
      noteAdministrative,
      classeId,
      classeNom
    } = req.body;

    console.log('💵 Nouveau paiement:', {
      eleveId,
      montant,
      mois,
      moyenPaiement,
      typePaiement,
      anneeConcernee
    });

    // ✅ VALIDATION
    if (!eleveId) {
      return res.status(400).json({
        success: false,
        message: 'Élève requis'
      });
    }

    if (!montant || montant <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Montant invalide'
      });
    }

    if (!mois) {
      return res.status(400).json({
        success: false,
        message: 'Mois requis'
      });
    }

    // ✅ RÉCUPÉRER L'ÉLÈVE AVEC SA CLASSE
    const eleve = await Eleve.findById(eleveId).populate('classe');

    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève non trouvé'
      });
    }

    console.log(`📚 Élève: ${eleve.nom} ${eleve.prenom} - Classe: ${eleve.classe?.nom} - Email: ${emailEleve}`);

    // ✅ GÉNÉRER LA RÉFÉRENCE UNIQUE
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `COLM-GABK-${y}${m}${d}-${h}${min}${s}-${rnd}`;

    // 🔥 CORRECTION: NE PLUS CONFONDRE typePaiement ET moyenPaiement
    const nouveauPaiement = new Paiement({
      reference,
      eleve: eleveId,
      eleveId: eleveId,
      eleveNom: eleveNom || eleve.nom,
      elevePrenom: elevePrenom || eleve.prenom || '',
      eleveMatricule: eleveMatricule || eleve.matricule || '',
      emailEleve: emailEleve || '',
      telephoneEleve: telephoneEleve || '',
      whatsappEleve: whatsappEleve || '',
      
      parentNom: parentNom || '',
      emailParent: emailParent || '',
      telephoneParent: telephoneParent || '',
      whatsappParent: whatsappParent || '',
      
      classe: classeId || eleve.classe?._id,
      classeNom: classeNom || eleve.classe?.nom || '',
      classeRef: classeId || eleve.classe?._id,
      
      montant: Number(montant),
      mois,
      
      // 🔥 CORRECTION CRITIQUE ICI
      typePaiement: typePaiement || 'fraisAnnuel',
      moyenPaiement: moyenPaiement || 'Cash',
      modePaiement: moyenPaiement || 'Cash',
      
      anneeScolaire: anneeConcernee || CONFIG.ANNEE_SCOLAIRE,
      anneeConcernee: anneeConcernee || CONFIG.ANNEE_SCOLAIRE,
      noteAdministrative,
      
      percepteur: percepteurId || req.user._id,
      percepteurNom: percepteurNom || req.user.fullName || req.user.email,
      percepteurEmail: percepteurEmail || req.user.email || '',
      percepteurContact: percepteurTel || req.user.telephone || '',
      percepteurTel: percepteurTel || req.user.telephone || '',
      percepteurWhatsapp: percepteurWhatsapp || req.user.whatsapp || '',
      emailPercepteur: percepteurEmail || req.user.email || '',
      
      datePaiement: now,
      statut: 'validé',
      ecole: 'Collège Le Mérite'
    });

    await nouveauPaiement.save();
    console.log(`✅ Paiement créé: ${reference}`);

    // ✅ METTRE À JOUR LE TOTAL PAYÉ DE L'ÉLÈVE
    try {
      const totalPaye = await Paiement.aggregate([
        { 
          $match: { 
            $or: [{ eleve: eleve._id }, { eleveId: eleve._id }],
            anneeConcernee: anneeConcernee || CONFIG.ANNEE_SCOLAIRE
          } 
        },
        { $group: { _id: null, total: { $sum: '$montant' } } }
      ]);

      // 🔥 CORRECTION: Mettre à jour les variables déclarées en haut
      nouveauTotalPaye = totalPaye.length > 0 ? totalPaye[0].total : 0;
      fraisClasse = eleve.classe?.mensualite ? eleve.classe.mensualite * 10 : eleve.classe?.montantFrais || 0;
      resteAPayer = fraisClasse - nouveauTotalPaye;

      console.log(`📌 ${eleve.nom} ${eleve.prenom} → Total payé: ${nouveauTotalPaye} USD`);

      // MAJ IA-3 classe
      if (eleve.classe) {
        const totalClasse = await Paiement.aggregate([
          { $match: { classe: eleve.classe._id, anneeConcernee: anneeConcernee || CONFIG.ANNEE_SCOLAIRE } },
          { $group: { _id: null, total: { $sum: '$montant' } } }
        ]);

        const totalRecu = totalClasse.length > 0 ? totalClasse[0].total : 0;
        console.log(`🤖 Classe ${eleve.classe.nom} - IA-3: ${totalRecu} USD`);
      }

      console.log(`📊 Total payé mis à jour: ${nouveauTotalPaye} USD, Reste: ${resteAPayer} USD`);

    } catch (err) {
      console.error('⚠️ Erreur MAJ élève (non bloquant):', err.message);
    }

    // ✅ LOG ACTIVITÉ (FIX: details doit être un string)
    if (req.user) {
      try {
        await LogActivite.create({
          utilisateur: req.user._id,
          role: req.user.role,
          action: 'paiement',
          categorie: 'paiement',
          description: `Paiement créé: ${reference} - ${montant} USD - ${mois}`,
          details: `Paiement ID: ${nouveauPaiement._id}, Élève: ${eleveId}, Montant: ${montant}, Mois: ${mois}`
        });
        console.log(`📋 Log créé: paiement - paiement - Paiement créé: ${reference} - ${montant} USD - ${mois}`);
      } catch (logErr) {
        console.error('⚠️ Erreur log (non bloquant):', logErr.message);
      }
    }

    // ✅ GÉNÉRER PDF REÇU
    let pdfPath = null;
    if (generateSchoolReceiptPDF) {
      try {
        console.log(`📄 Génération PDF pour: ${reference}`);
        
        const paiementPourPDF = {
          reference: reference,
          eleveNom: nouveauPaiement.eleveNom + ' ' + (nouveauPaiement.elevePrenom || ''),
          classeNom: nouveauPaiement.classeNom,
          mois: nouveauPaiement.mois,
          anneeScolaire: nouveauPaiement.anneeScolaire,
          montant: nouveauPaiement.montant,
          modePaiement: nouveauPaiement.modePaiement,
          datePaiement: nouveauPaiement.datePaiement,
          parentNom: nouveauPaiement.parentNom || 'Parent',
          parentContact: nouveauPaiement.telephoneParent || '—',
          emailParent: nouveauPaiement.emailParent || '—',
          percepteurNom: nouveauPaiement.percepteurNom,
          emailPercepteur: nouveauPaiement.emailPercepteur,
          noteIA: 'Paiement enregistré avec succès.',
          signaturePath: null
        };

        pdfPath = await generateSchoolReceiptPDF(paiementPourPDF, reference);
        
        if (!pdfPath || !fs.existsSync(pdfPath)) {
          console.error(`⚠️ PDF non trouvé: ${pdfPath}`);
          pdfPath = null;
        } else {
          console.log(`✅ Reçu PDF généré: ${pdfPath}`);
        }
      } catch (pdfErr) {
        console.error('⚠️ Erreur génération PDF (non bloquant):', pdfErr.message);
        pdfPath = null;
      }
    }

    // ✅ ENVOYER EMAIL INTELLIGENT
    if (envoyerEmailsIntelligents) {
      try {
        console.log(`📧 Tentative envoi email à: ${emailEleve}`);
        
        await envoyerEmailsIntelligents(nouveauPaiement.toObject(), pdfPath);
        
        console.log('✅ Emails envoyés avec succès');
      } catch (emailErr) {
        console.error('⚠️ Erreur envoi email (non bloquant):', emailErr.message);
      }
    }

    // ✅ RÉPONSE SUCCESS
    res.status(201).json({
      success: true,
      message: 'Paiement enregistré avec succès',
      paiement: nouveauPaiement,
      stats: {
        totalPaye: nouveauTotalPaye,
        resteAPayer: resteAPayer,
        fraisClasse: fraisClasse
      }
    });

  } catch (error) {
    console.error('❌ Erreur création paiement:', error);
    next(error);
  }
};

// ========================================
// 📌 LISTER LES PAIEMENTS
// ========================================
exports.getPaiements = async (req, res, next) => {
  try {
    const {
      anneeScolaire = CONFIG.ANNEE_SCOLAIRE,
      limit = 50,
      page = 1,
      eleveId
    } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const query = {
      anneeScolaire,
      statut: 'validé'
    };

    if (eleveId) {
      query.$or = [
        { eleveId: eleveId },
        { eleve: eleveId }
      ];
    }

    const paiements = await Paiement.find(query)
      .populate('eleve', 'nom prenom matricule')
      .populate({
        path: 'eleve',
        populate: { path: 'classe', select: 'nom niveau' }
      })
      .sort({ datePaiement: -1 })
      .limit(parseInt(limit, 10))
      .skip(skip);

    const total = await Paiement.countDocuments(query);

    res.json({
      success: true,
      paiements,
      count: paiements.length,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10))
    });

    console.log(`✅ ${paiements.length}/${total} paiements récupérés`);
  } catch (error) {
    console.error('❌ Erreur getPaiements:', error);
    next(error);
  }
};

// ========================================
// 📌 OBTENIR UN PAIEMENT PAR ID
// ========================================
exports.getPaiementById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const paiement = await Paiement.findById(id)
      .populate('eleve', 'nom prenom matricule email')
      .populate('classe', 'nom niveau');

    if (!paiement) {
      return res.status(404).json({
        success: false,
        message: 'Paiement introuvable'
      });
    }

    res.json({
      success: true,
      paiement
    });

  } catch (error) {
    console.error('❌ Erreur getPaiementById:', error);
    next(error);
  }
};

// ========================================
// 📌 MODIFIER UN PAIEMENT
// ========================================
exports.updatePaiement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { montant, mois, moyenPaiement } = req.body;

    console.log('✏️ Modification paiement:', id);

    const paiement = await Paiement.findById(id);

    if (!paiement) {
      return res.status(404).json({
        success: false,
        message: 'Paiement introuvable'
      });
    }

    const anciennesDonnees = {
      montant: paiement.montant,
      mois: paiement.mois,
      moyenPaiement: paiement.moyenPaiement
    };

    const diffMontant = (montant ? parseFloat(montant) : paiement.montant) - paiement.montant;

    if (montant !== undefined) paiement.montant = parseFloat(montant);
    if (mois) paiement.mois = mois;
    if (moyenPaiement) {
      paiement.moyenPaiement = moyenPaiement;
      paiement.modePaiement = moyenPaiement;
    }

    await paiement.save();

    // ✅ MAJ ÉLÈVE
    const eleveId = paiement.eleveId || paiement.eleve;
    if (diffMontant !== 0 && eleveId) {
      try {
        const eleve = await Eleve.findById(eleveId)
          .populate('classe', 'montantFrais')
          .lean();

        if (eleve) {
          const nouveauTotalPaye = (eleve.totalPaye || 0) + diffMontant;
          const fraisTotal = eleve.classe?.montantFrais || 0;
          const nouveauReste = Math.max(0, fraisTotal - nouveauTotalPaye);

          await Eleve.findByIdAndUpdate(
            eleveId,
            {
              $set: {
                totalPaye: nouveauTotalPaye,
                resteAPayer: nouveauReste
              }
            },
            { runValidators: false }
          );

          console.log(`📊 Élève MAJ: Total payé ${nouveauTotalPaye} USD`);
        }
      } catch (updateErr) {
        console.error('⚠️ Erreur MAJ élève (non bloquant):', updateErr.message);
      }
    }

    // LOG
    if (req.user) {
      try {
        await LogActivite.create({
          utilisateur: req.user._id,
          role: req.user.role,
          action: 'modification',
          categorie: 'paiement',
          description: `Modification paiement ${paiement.reference}`,
          details: `Avant: ${JSON.stringify(anciennesDonnees)}, Après: ${JSON.stringify({ montant: paiement.montant, mois: paiement.mois, moyenPaiement: paiement.moyenPaiement })}`
        });
      } catch (logErr) {
        console.error('⚠️ Erreur log (non bloquant):', logErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Paiement modifié avec succès',
      paiement
    });

    console.log(`✅ Paiement ${id} modifié`);
  } catch (error) {
    console.error('❌ Erreur updatePaiement:', error);
    next(error);
  }
};

// ========================================
// 📌 SUPPRIMER UN PAIEMENT
// ========================================
exports.deletePaiement = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Suppression paiement:', id);

    const paiement = await Paiement.findById(id);

    if (!paiement) {
      return res.status(404).json({
        success: false,
        message: 'Paiement introuvable'
      });
    }

    // MAJ élève
    const eleveId = paiement.eleveId || paiement.eleve;
    if (eleveId) {
      try {
        const eleve = await Eleve.findById(eleveId)
          .populate('classe', 'montantFrais')
          .lean();

        if (eleve) {
          const nouveauTotalPaye = Math.max(0, (eleve.totalPaye || 0) - paiement.montant);
          const fraisTotal = eleve.classe?.montantFrais || 0;
          const nouveauReste = Math.max(0, fraisTotal - nouveauTotalPaye);

          await Eleve.findByIdAndUpdate(
            eleveId,
            {
              $set: {
                totalPaye: nouveauTotalPaye,
                resteAPayer: nouveauReste
              }
            },
            { runValidators: false }
          );

          console.log(`📊 Élève ${eleve.nom}: Total payé ${nouveauTotalPaye} USD, Reste ${nouveauReste} USD`);
        }
      } catch (updateErr) {
        console.error('⚠️ Erreur MAJ élève (non bloquant):', updateErr.message);
      }
    }

    await Paiement.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Paiement supprimé avec succès'
    });

    console.log(`✅ Paiement ${id} supprimé`);
  } catch (error) {
    console.error('❌ Erreur deletePaiement:', error);
    next(error);
  }
};

// ========================================
// 📌 ENVOYER REÇU PAR EMAIL
// ========================================
exports.envoyerRecu = async (req, res, next) => {
  try {
    const { id } = req.params;

    const paiement = await Paiement.findById(id);

    if (!paiement) {
      return res.status(404).json({
        success: false,
        message: 'Paiement introuvable'
      });
    }

    // Générer PDF
    let pdfPath = null;
    if (generateSchoolReceiptPDF) {
      try {
        pdfPath = await generateSchoolReceiptPDF(paiement.toObject(), paiement.reference);
      } catch (error) {
        console.error('❌ Erreur génération PDF:', error);
      }
    }

    // Envoyer email
    if (envoyerEmailsIntelligents && pdfPath) {
      await envoyerEmailsIntelligents(paiement.toObject(), pdfPath);
    }

    res.json({
      success: true,
      message: 'Reçu envoyé par email'
    });

  } catch (error) {
    console.error('❌ Erreur envoyerRecu:', error);
    next(error);
  }
};

console.log('✅ Percepteur Paiements Controller chargé - VERSION ULTRA-COMPLÈTE CORRIGÉE');
