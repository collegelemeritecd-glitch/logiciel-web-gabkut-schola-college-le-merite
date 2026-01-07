const mongoose = require("mongoose");

const StatistiqueSchema = new mongoose.Schema({
  classe: String,
  cycle: String,
  effectif: Number,
  attendu: Number,
  paye: Number,
  mois: String,
  annee: Number,
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Statistique", StatistiqueSchema);



