// services/schoolCalendarService.js

// Année scolaire 2025-2026, primaire / secondaire / technique
// Basé sur le calendrier officiel : 222 jours de classe du 01/09/2025 au 02/07/2026. [file:76]

const SCHOOL_YEAR_START = new Date('2025-09-01'); // lundi 1er septembre 2025
const SCHOOL_YEAR_END = new Date('2026-07-02');   // jeudi 02 juillet 2026

// Jours fériés légaux 2025-2026 (dans la période scolaire) [file:76]
const LEGAL_HOLIDAYS = new Set([
  '2025-12-25', // Nativité
  '2026-01-01', // Nouvel an
  '2026-01-04', // Martyrs de l'indépendance
  '2026-01-16', // L.D. Kabila
  '2026-01-17', // P.E. Lumumba
  '2026-04-06', // Simon Kimbangu / conscience africaine
  '2026-05-01', // Fête du Travail
  '2026-05-17', // FARDC
  '2026-06-30', // Indépendance
  '2026-08-01', // Fête des Parents (hors année scolaire mais on garde pour cohérence)
]);

// Vacances et congés pour primaire / secondaire / technique. [file:76]
const NON_SCHOOL_PERIODS = [
  // Vacances 1er trimestre : 18/12/2025 au 02/01/2026
  { from: '2025-12-18', to: '2026-01-02' },
  // Vacances 2e trimestre : 28/03/2026 au 11/04/2026
  { from: '2026-03-28', to: '2026-04-11' },
  // 1er congé de détente : 30/10/2025 au 01/11/2025
  { from: '2025-10-30', to: '2025-11-01' },
  // 2e congé de détente : 12/02/2026 au 14/02/2026
  { from: '2026-02-12', to: '2026-02-14' },
];

// utils simples

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function dateFromISO(iso) {
  const [y, m, d] = iso.split('-').map(v => parseInt(v, 10));
  return new Date(y, m - 1, d);
}

function isWithinPeriod(dateIso, period) {
  return dateIso >= period.from && dateIso <= period.to;
}

function isInNonSchoolPeriod(dateIso) {
  return NON_SCHOOL_PERIODS.some(p => isWithinPeriod(dateIso, p));
}

function isBeforeOrEqual(d1, d2) {
  return d1.getTime() <= d2.getTime();
}

// Renvoie tous les jours de classe de l'année 2025-2026 (primaire / secondaire / technique)
function getAllSchoolDaysForYear() {
  const days = [];
  let d = new Date(SCHOOL_YEAR_START.getTime());
  const end = new Date(SCHOOL_YEAR_END.getTime());
  d.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (isBeforeOrEqual(d, end)) {
    const iso = toISODate(d);
    const dow = d.getDay(); // 0 dimanche, 6 samedi

    const isSunday = dow === 0;
    const isNonSchool = isInNonSchoolPeriod(iso);
    const isHoliday = LEGAL_HOLIDAYS.has(iso);

    // Pour primaire / secondaire, samedis possibles, on ne retire que dimanches, vacances, fériés
    if (!isSunday && !isNonSchool && !isHoliday) {
      days.push(iso);
    }

    d.setDate(d.getDate() + 1);
  }

  return days;
}

// Calcul des jours de classe sur une période donnée, bornée par l'année scolaire officielle
function getSchoolDaysBetween(fromDate, toDate) {
  const start = new Date(Math.max(fromDate.getTime(), SCHOOL_YEAR_START.getTime()));
  const end = new Date(Math.min(toDate.getTime(), SCHOOL_YEAR_END.getTime()));
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const days = [];
  let d = new Date(start.getTime());

  while (isBeforeOrEqual(d, end)) {
    const iso = toISODate(d);
    const dow = d.getDay();
    const isSunday = dow === 0;
    const isNonSchool = isInNonSchoolPeriod(iso);
    const isHoliday = LEGAL_HOLIDAYS.has(iso);

    if (!isSunday && !isNonSchool && !isHoliday) {
      days.push(iso);
    }

    d.setDate(d.getDate() + 1);
  }

  return days;
}

module.exports = {
  SCHOOL_YEAR_START,
  SCHOOL_YEAR_END,
  LEGAL_HOLIDAYS,
  NON_SCHOOL_PERIODS,
  getAllSchoolDaysForYear,
  getSchoolDaysBetween,
  getWorkingDays: getSchoolDaysBetween, // <-- alias pour les controllers
  toISODate,
  dateFromISO,
};


