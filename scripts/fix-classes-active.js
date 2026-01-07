require('dotenv').config();
const mongoose = require('mongoose');

const classeSchema = new mongoose.Schema({
  nom: String,
  niveau: String,
  montantFrais: Number,
  mensualite: Number,
  anneeScolaire: String,
  isActive: { type: Boolean, default: true }
});

const Classe = mongoose.model('Classe', classeSchema);

async function fixClasses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté');

    // Ajouter isActive: true à toutes les classes
    const result = await Classe.updateMany(
      {},
      { $set: { isActive: true } }
    );

    console.log(`✅ ${result.modifiedCount} classes mises à jour avec isActive: true`);

    const classes = await Classe.find({});
    console.log(`📊 Total classes actives: ${classes.length}`);
    
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixClasses();
