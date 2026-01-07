// backend/utils/matriculePro.js
const Eleve = require('../models/Eleve');

function randomMatriculePro() {
  const num = Math.floor(Math.random() * 100000); // 0..99999
  const partNum = String(num).padStart(5, '0');

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const l1 = alphabet[Math.floor(Math.random() * 26)];
  const l2 = alphabet[Math.floor(Math.random() * 26)];
  const l3 = alphabet[Math.floor(Math.random() * 26)];
  const letters = `${l1}${l2}${l3}`;

  return `${partNum}-${letters}`; // ex: 04523-QMT
}

async function genererMatriculePro() {
  let essais = 0;
  let code;
  let existe = true;

  while (existe && essais < 50) {
    code = randomMatriculePro();
    existe = await Eleve.exists({ matricule: code });
    essais++;
  }

  if (existe) {
    const suffix = String(Date.now() % 100000).padStart(5, '0');
    code = `${suffix}-ZZZ`;
  }

  return code;
}

module.exports = {
  randomMatriculePro,
  genererMatriculePro,
};
