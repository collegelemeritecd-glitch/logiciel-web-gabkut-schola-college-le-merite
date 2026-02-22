// services/warningLetterService.js

/**
 * Génère le contenu texte d'une lettre d'avertissement d'assiduité.
 * student: { fullName }
 * payload: { classLabel, month, year, absenceDays, lateDays }
 */
function generateAttendanceWarningText(student, payload) {
  const { fullName } = student;
  const { classLabel, month, year, absenceDays, lateDays } = payload;

  return `
À l'attention des parents de ${fullName},

Objet : Avertissement d'assiduité

Madame, Monsieur,

Nous avons constaté que l'élève ${fullName}, inscrit en ${classLabel}, présente les difficultés d'assiduité suivantes pour le mois ${month}/${year} :

- Absences : ${absenceDays}
- Retards : ${lateDays}

Ces manquements risquent d'avoir un impact important sur ses résultats scolaires et sa progression.
Nous vous invitons à prendre rendez-vous avec l'établissement afin de faire le point sur la situation et trouver des solutions adaptées.

Dans l'attente de votre retour, nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

La Direction
`.trim();
}

/**
 * Génère une version HTML de la lettre (utile pour email ou prévisualisation).
 */
function generateAttendanceWarningHtml(student, payload) {
  const { fullName } = student;
  const { classLabel, month, year, absenceDays, lateDays } = payload;

  return `
<p>À l'attention des parents de <strong>${fullName}</strong>,</p>
<p><strong>Objet : Avertissement d'assiduité</strong></p>
<p>Madame, Monsieur,</p>
<p>Nous avons constaté que l'élève <strong>${fullName}</strong>, inscrit en <strong>${classLabel}</strong>, présente les difficultés d'assiduité suivantes pour le mois <strong>${month}/${year}</strong> :</p>
<ul>
  <li>Absences : <strong>${absenceDays}</strong></li>
  <li>Retards : <strong>${lateDays}</strong></li>
</ul>
<p>Ces manquements risquent d'avoir un impact important sur ses résultats scolaires et sa progression.</p>
<p>Nous vous invitons à prendre rendez-vous avec l'établissement afin de faire le point sur la situation et trouver des solutions adaptées.</p>
<p>Dans l'attente de votre retour, nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>
<p>La Direction</p>
`.trim();
}

module.exports = {
  generateAttendanceWarningText,
  generateAttendanceWarningHtml,
};
