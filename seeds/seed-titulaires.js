// seeds/seed-titulaires.js
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Classe = require('../models/Classe');
const Enseignant = require('../models/Enseignant');

const MONGODB_URI = process.env.MONGODB_URI;

// 🔗 Mapping titulaires → classes (noms EXACTS comme dans ta DB)
const TITULAIRES_MAPPING = [
  { email: 'beya.gabriel@collegelemerite.school', classes: ['7ème année'] },
  {
    email: 'clementine.ngalula@collegelemerite.school',
    classes: ['8ème année', '1ère Coupe et couture', '2ème Coupe et couture'],
  },
  {
    email: 'jackson.munung@collegelemerite.school',
    classes: ['1ère Pédagogie', '2ème Humanité Pédagogique'],
  },
  {
    email: 'christin.mbatshi@collegelemerite.school',
    classes: ['3ème Pédagogie', '4ème Pédagogie'],
  },
  {
    email: 'paul.memba@collegelemerite.school',
    classes: ['1ère Commerciale et gestion', '2ème Commerciale et gestion'],
  },
  {
    email: 'joel.ngandu@collegelemerite.school',
    classes: ['3ème Commerciale et gestion', '4ème Commerciale et gestion'],
  },
  {
    email: 'judith.njiba@collegelemerite.school',
    classes: ['3ème Coupe et couture', '4ème Coupe et couture'],
  },
  {
    email: 'nicollette.nsamba@collegelemerite.school',
    classes: [
      '1ère Électricité',
      '2ème Électricité',
      '3ème Électricité',
      '4ème Électricité',
    ],
  },
  {
    email: 'balthazar@collegelemerite.school',
    classes: [
      '1ère Mécanique Générale',
      '2ème Mécanique Générale',
      '3ème Mécanique Générale',
      '4ème Mécanique Générale',
    ],
  },
  {
    email: 'joseph.ntumba@collegelemerite.school',
    classes: [
      '1ère Mécanique Automobile',
      '2ème Mécanique Automobile',
      '3ème Mécanique Automobile',
      '4ème Mécanique Automobile',
    ],
  },
  {
    email: 'augustin.kadjiba@collegelemerite.school',
    classes: [
      '1ère Littéraire',
      '2ème Humanité Littéraire',
      '3ème Littéraire',
      '4ème Littéraire',
    ],
  },
];

const run = async () => {
  try {
    console.log('🌱 Seed titulaires — début...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté');

    for (const item of TITULAIRES_MAPPING) {
      const { email, classes } = item;

      const user = await User.findOne({ email });
      if (!user) {
        console.log(`⚠️ User introuvable pour email: ${email}`);
        continue;
      }

      // S'assurer que le user est teacher
      if (user.role !== 'teacher') {
        user.role = 'teacher';
      }
      await user.save();

      for (const nomClasse of classes) {
        // ❗ Aucun filtre sur anneeScolaire
        const classe = await Classe.findOne({ nom: nomClasse });

        if (!classe) {
          console.log(`⚠️ Classe introuvable: "${nomClasse}"`);

          // Debug optionnel
          const candidates = await Classe.find({
            nom: { $regex: nomClasse.split(' ')[0], $options: 'i' },
          })
            .select('nom anneeScolaire')
            .lean();

          console.log('  ↳ Candidats possibles:', candidates);
          continue;
        }

        // On ne modifie que le titulaire
        classe.titulaire = user._id;
        await classe.save();

        console.log(`✅ Titulaire ${email} → Classe ${classe.nom}`);
      }

      // Synchroniser Enseignant.user + isTitulaire
      const enseignant = await Enseignant.findOne({ email });
      if (enseignant) {
        enseignant.user = user._id;
        enseignant.isTitulaire = true;
        await enseignant.save();
        console.log(`🔗 Enseignant lié + isTitulaire=true pour: ${email}`);
      }
    }

    console.log('🎉 Seed titulaires terminé.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-titulaires:', err);
    process.exit(1);
  }
};

run();
