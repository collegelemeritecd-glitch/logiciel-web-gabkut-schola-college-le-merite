/************************************************************
 📧 PERCEPTEUR EMAILS CONTROLLER - BEAST MODE CORRIGÉ
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const nodemailer = require('nodemailer');
const Eleve = require('../../models/Eleve');

// 📧 TRANSPORTER SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  tls: { rejectUnauthorized: false },
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Templates d'emails
const TEMPLATES = {
  'relance-simple': {
    id: 'relance-simple',
    nom: 'Relance Amicale',
    badge: '📬 RELANCE AMICALE',
    objet: 'Rappel amical - Scolarité {{eleveNom}}',
    contenuHTML: `
      <p>Madame, Monsieur,</p>
      <p>Nous espérons que vous et votre famille vous portez bien.</p>
      <p>Nous nous permettons de vous rappeler amicalement qu'un solde reste dû concernant la scolarité de <strong>{{eleveNom}}</strong>.</p>
      <ul>
        <li><strong>Classe :</strong> {{classeNom}}</li>
        <li><strong>Montant dû :</strong> {{soldeDu}} USD</li>
        <li><strong>Année scolaire :</strong> {{anneeScolaire}}</li>
      </ul>
      <p>Nous vous remercions de bien vouloir régulariser cette situation dans les meilleurs délais.</p>
      <p>Cordialement,<br>L'administration du Collège Le Mérite</p>
    `
  },
  'relance-officielle': {
    id: 'relance-officielle',
    nom: 'Relance Officielle',
    badge: '⚠️ RELANCE OFFICIELLE',
    objet: 'RAPPEL OFFICIEL - Scolarité {{eleveNom}}',
    contenuHTML: `
      <p>Madame, Monsieur,</p>
      <p>Nous vous adressons cette relance officielle concernant le paiement de la scolarité de <strong>{{eleveNom}}</strong>.</p>
      <ul>
        <li><strong>Classe :</strong> {{classeNom}}</li>
        <li><strong>Solde restant dû :</strong> {{soldeDu}} USD</li>
        <li><strong>Année scolaire :</strong> {{anneeScolaire}}</li>
      </ul>
      <p>📅 Nous vous demandons de bien vouloir régulariser cette situation dans un délai de <strong>7 jours</strong>.</p>
      <p>Cordialement,<br>L'administration du Collège Le Mérite</p>
    `
  },
  'avertissement': {
    id: 'avertissement',
    nom: 'Avertissement Final',
    badge: '🚨 AVERTISSEMENT',
    objet: 'DERNIER AVERTISSEMENT - Scolarité {{eleveNom}}',
    contenuHTML: `
      <p>Madame, Monsieur,</p>
      <p>Malgré nos relances précédentes, nous constatons que le solde de la scolarité de <strong>{{eleveNom}}</strong> reste impayé.</p>
      <ul>
        <li><strong>Classe :</strong> {{classeNom}}</li>
        <li><strong>Montant dû :</strong> {{soldeDu}} USD</li>
      </ul>
      <p>⚠️ <strong>Ceci constitue notre dernier avertissement avant suspension.</strong></p>
      <p>Nous vous demandons de régulariser cette situation <strong>sous 48 heures</strong>.</p>
      <p>L'administration du Collège Le Mérite</p>
    `
  },
  'felicitations': {
    id: 'felicitations',
    nom: 'Félicitations',
    badge: '🎉 FÉLICITATIONS',
    objet: 'Félicitations - Paiement à jour de {{eleveNom}}',
    contenuHTML: `
      <p>Madame, Monsieur,</p>
      <p>Nous tenons à vous remercier chaleureusement pour votre ponctualité dans le paiement de la scolarité de <strong>{{eleveNom}}</strong>.</p>
      <p>🎓 Votre sérieux et votre engagement sont exemplaires.</p>
      <p>Cordialement,<br>L'administration du Collège Le Mérite</p>
    `
  }
};

// ========== ENVOYER UN EMAIL ==========
exports.sendEmail = async (req, res, next) => {
  try {
    const { eleveId, templateId, destinataire, objet, contenu } = req.body;

    if (!eleveId || !destinataire) {
      return res.status(400).json({
        success: false,
        message: 'Élève et destinataire requis'
      });
    }

    console.log('📧 Envoi email:', { eleveId, templateId, destinataire });

    // Récupérer l'élève
    const eleve = await Eleve.findById(eleveId)
      .populate('classe', 'nom')
      .lean();

    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable'
      });
    }

    // Préparer le contenu
    let emailObjet = objet;
    let emailContenu = contenu;

    if (templateId && TEMPLATES[templateId]) {
      const template = TEMPLATES[templateId];
      emailObjet = template.objet;
      emailContenu = template.contenuHTML;
    }

    // Remplacer les variables
    const variables = {
      '{{eleveNom}}': `${eleve.nom} ${eleve.prenom || ''}`.trim(),
      '{{classeNom}}': eleve.classe?.nom || 'N/A',
      '{{soldeDu}}': eleve.soldeDu || 0,
      '{{anneeScolaire}}': eleve.anneeScolaire || '2025-2026',
      '{{montantDu}}': eleve.montantDu || 0,
      '{{montantPaye}}': eleve.montantPaye || 0
    };

    Object.keys(variables).forEach(key => {
      emailObjet = emailObjet.replace(new RegExp(key, 'g'), variables[key]);
      emailContenu = emailContenu.replace(new RegExp(key, 'g'), variables[key]);
    });

    // Envoyer l'email
    const mailOptions = {
      from: `"Collège Le Mérite" <${process.env.SMTP_USER}>`,
      to: destinataire,
      subject: emailObjet,
      html: emailContenu
    };

    await transporter.sendMail(mailOptions);

    console.log(`✅ Email envoyé à ${destinataire}`);

    res.json({
      success: true,
      message: 'Email envoyé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur sendEmail:', error);
    next(error);
  }
};

// ========== ENVOI GROUPÉ ==========
exports.sendBulkEmails = async (req, res, next) => {
  try {
    const { elevesIds, templateId, objet, contenu } = req.body;

    if (!elevesIds || elevesIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Liste d\'élèves requise'
      });
    }

    console.log('📧 Envoi groupé:', elevesIds.length, 'élèves');

    let envoyes = 0;
    let erreurs = 0;

    for (const eleveId of elevesIds) {
      try {
        const eleve = await Eleve.findById(eleveId)
          .populate('classe', 'nom')
          .lean();

        if (!eleve) {
          erreurs++;
          continue;
        }

        const emailParent = eleve.parent?.email || eleve.emailParent;
        if (!emailParent || !emailParent.includes('@')) {
          erreurs++;
          continue;
        }

        // Préparer contenu
        let emailObjet = objet;
        let emailContenu = contenu;

        if (templateId && TEMPLATES[templateId]) {
          const template = TEMPLATES[templateId];
          emailObjet = template.objet;
          emailContenu = template.contenuHTML;
        }

        // Variables
        const variables = {
          '{{eleveNom}}': `${eleve.nom} ${eleve.prenom || ''}`.trim(),
          '{{classeNom}}': eleve.classe?.nom || 'N/A',
          '{{soldeDu}}': eleve.soldeDu || 0,
          '{{anneeScolaire}}': eleve.anneeScolaire || '2025-2026'
        };

        Object.keys(variables).forEach(key => {
          emailObjet = emailObjet.replace(new RegExp(key, 'g'), variables[key]);
          emailContenu = emailContenu.replace(new RegExp(key, 'g'), variables[key]);
        });

        // Envoyer
        await transporter.sendMail({
          from: `"Collège Le Mérite" <${process.env.SMTP_USER}>`,
          to: emailParent,
          subject: emailObjet,
          html: emailContenu
        });

        envoyes++;

      } catch (err) {
        console.error(`❌ Erreur envoi pour élève ${eleveId}:`, err.message);
        erreurs++;
      }
    }

    console.log(`✅ Envoi groupé terminé: ${envoyes} envoyés, ${erreurs} erreurs`);

    res.json({
      success: true,
      message: `${envoyes} email(s) envoyé(s)`,
      envoyes,
      erreurs
    });

  } catch (error) {
    console.error('❌ Erreur sendBulkEmails:', error);
    next(error);
  }
};

// ========== LISTE DES TEMPLATES ==========
exports.getTemplates = async (req, res, next) => {
  try {
    const templates = Object.values(TEMPLATES);

    res.json({
      success: true,
      templates
    });

  } catch (error) {
    console.error('❌ Erreur getTemplates:', error);
    next(error);
  }
};

// ========== HISTORIQUE D'ENVOI ==========
exports.getHistorique = async (req, res, next) => {
  try {
    res.json({
      success: true,
      historique: [],
      message: 'Historique non implémenté (fonctionnalité à venir)'
    });

  } catch (error) {
    console.error('❌ Erreur getHistorique:', error);
    next(error);
  }
};

console.log('✅ Percepteur Emails Controller chargé');
