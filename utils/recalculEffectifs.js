const Classe = require("../models/Classe");
const Eleve = require("../models/Eleve");

module.exports = async function recalculEffectifs(classeId) {
  try {
    if (!classeId) return;

    const nb = await Eleve.countDocuments({ classe: classeId });
    await Classe.findByIdAndUpdate(classeId, { effectif: nb });

    console.log(`🔁 Effectif mis à jour pour la classe ${classeId} → ${nb}`);
  } catch (err) {
    console.warn("⚠ recalculEffectifs erreur :", err.message);
  }
};
