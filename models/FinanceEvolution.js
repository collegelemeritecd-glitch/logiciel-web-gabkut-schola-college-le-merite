// models/FinanceEvolution.js
const mongoose = require('mongoose');

const financeEvolutionSchema = new mongoose.Schema(
  {
    jour: {
      type: String, // format 'YYYY-MM-DD'
      required: true,
      index: true,
    },
    total: {
      type: Number,
      default: 0,
    },
    anneeScolaire: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FinanceEvolution', financeEvolutionSchema);
