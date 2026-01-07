/* ====================================================================
 📊 Gabkut-Schola — generateCharts.js (VERSION FINALE 2026)
 Génère 2 graphiques PNG professionnels façon Power BI sombre :
   • Camembert : Montants par classe
   • Histogramme : Montants par mois
 Chemins produits :
   temp-exports/camembert.png
   temp-exports/histogramme.png
 ==================================================================== */

const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const fs = require("fs");
const path = require("path");

/* 🎨 Dimensions HD pour PDF / Word */
const WIDTH = 1600;
const HEIGHT = 900;

/* 🎨 Palette dynamique stable (hash → couleur par libellé) */
const COLORS = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
  "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac"
];

const colorFromLabel = label => {
  let hash = 0;
  for (let i = 0; i < label.length; i++)
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
};

/* Addition groupée */
const groupSum = (rows, keyFn) => {
  return rows.reduce((acc, row) => {
    const key = keyFn(row);
    acc[key] = (acc[key] || 0) + Number(row.montant || 0);
    return acc;
  }, {});
};

/* ============================================================= */
async function generateCharts(rows) {
  const chartsDir = path.join(__dirname, "../../temp-exports");
  if (!fs.existsSync(chartsDir)) fs.mkdirSync(chartsDir);

  const renderer = new ChartJSNodeCanvas({
    width: WIDTH,
    height: HEIGHT,
    backgroundColour: "#1b1e23"   // 🖤 Mode sombre Power BI
  });

  /* ========== 1️⃣ CAMEMBERT — Montant par classe ========== */
  const sumClass = groupSum(rows, r => r.classe);
  const labelsClass = Object.keys(sumClass);
  const valuesClass = Object.values(sumClass);
  const colorsClass = labelsClass.map(l => colorFromLabel(l));

  const pieBuffer = await renderer.renderToBuffer({
    type: "pie",
    data: {
      labels: labelsClass,
      datasets: [{ data: valuesClass, backgroundColor: colorsClass }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Répartition des Paiements par Classe",
          color: "#ffffff",
          font: { size: 34, weight: "bold" }
        },
        legend: {
          labels: { color: "#ffffff", font: { size: 18 } }
        }
      }
    }
  });
  const camembertPath = path.join(chartsDir, "camembert.png");
  fs.writeFileSync(camembertPath, pieBuffer);

  /* ========== 2️⃣ BAR CHART — Montant par mois ========== */
  const sumMonth = groupSum(rows, r => r.mois);
  const labelsMonth = Object.keys(sumMonth);
  const valuesMonth = Object.values(sumMonth);
  const colorsMonth = labelsMonth.map(l => colorFromLabel(l));

  const barBuffer = await renderer.renderToBuffer({
    type: "bar",
    data: {
      labels: labelsMonth,
      datasets: [{
        label: "Montant ($)",
        data: valuesMonth,
        backgroundColor: colorsMonth,
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Paiements Mensuels (Histogramme)",
          color: "#ffffff",
          font: { size: 34, weight: "bold" }
        }
      },
      scales: {
        x: { ticks: { color: "#ffffff", font: { size: 16 } } },
        y: { ticks: { color: "#ffffff", font: { size: 16 } }, beginAtZero: true }
      }
    }
  });
  const histogramPath = path.join(chartsDir, "histogramme.png");
  fs.writeFileSync(histogramPath, barBuffer);

  /* 🔁 Renvoyer les chemins pour beautyExports */
  return { camembertPath, histogramPath };
}

module.exports = generateCharts;
