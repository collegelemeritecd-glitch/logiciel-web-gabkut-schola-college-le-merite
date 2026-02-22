// controllers/teachers/teacherController.js
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const TeacherCourse = require('../../models/TeacherCourse');
const StudentGrade = require('../../models/StudentGrade');
const Attendance = require('../../models/Attendance');
const Eleve = require('../../models/Eleve');
const Classe = require('../../models/Classe');
const Enseignant = require('../../models/Enseignant');
const schoolCalendar = require('../../services/schoolCalendarService');
const mailingService = require('../../services/mailingService');
const notificationService = require('../../services/notificationService');
const warningLetterService = require('../../services/warningLetterService');
const { getClassesWithCoursesByClassId } = require('../../services/teacherCourseClassService');




const getCurrentSchoolYear = () => '2025-2026';

// ========== FONCTIONS DE CALCUL (SELON TON BULLETIN) ==========
const parseGrade = v => {
  if (v === null || typeof v === 'undefined' || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const computeT1 = r => {
  const P1 = parseGrade(r.P1);
  const P2 = parseGrade(r.P2);
  const EX1 = parseGrade(r.EX1);
  if (P1 === null && P2 === null && EX1 === null) return null;
  return (P1 || 0) + (P2 || 0) + (EX1 || 0);
};

const computeT2 = r => {
  const P3 = parseGrade(r.P3);
  const P4 = parseGrade(r.P4);
  const EX2 = parseGrade(r.EX2);
  if (P3 === null && P4 === null && EX2 === null) return null;
  return (P3 || 0) + (P4 || 0) + (EX2 || 0);
};

const computeTotal = r => {
  const T1 = computeT1(r);
  const T2 = computeT2(r);
  if (T1 === null && T2 === null) return null;
  return (T1 || 0) + (T2 || 0);
};

// Vérifie que la classe appartient au titulaire connecté
async function ensureTitularForClass(req, classId) {
  const teacherId = req.user.id; // ou req.user._id selon ton middleware
  const schoolYear = getCurrentSchoolYear();

  // On considère qu'un enseignant est titulaire de la classe s'il a au moins un cours dessus
  // ou si tu as un champ spécifique sur Classe (titulaire)
  const classe = await Classe.findOne({ _id: classId /*, titulaire: teacherId, anneeScolaire: schoolYear*/ })
    .select('nomClasse nom name niveau')
    .lean();

  if (!classe) {
    const err = new Error('Classe introuvable ou non attribuée à cet enseignant.');
    err.statusCode = 403;
    throw err;
  }

  return classe;
}

// ========== CONTROLLERS ==========

// GET /api/teachers/me/overview (FUSIONNÉ)
exports.getOverview = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const userId = req.user._id;
    const schoolYear = getCurrentSchoolYear();

    // 1) Profil / fiche enseignant
    const enseignant = await Enseignant.findOne({ user: userId }).lean();

    // 2) Classes dont il est titulaire
    const classesTitulaires = await Classe.find({ titulaire: userId })
      .select('nom niveau section')
      .lean();

    const isTitulaire = classesTitulaires.length > 0;

    // 3) Cours encodés pour ce prof
    const courses = await TeacherCourse.find({ teacher: userId, schoolYear }).lean();

    const stats = {
      coursesCount: courses.length,
      titularClassesCount: classesTitulaires.length,
      distinctClassesCount: new Set(
        courses.map(c => String(c.classId || c.className))
      ).size,
    };

    // "Cours du jour" simplifié : les 5 premiers cours
    const todayClasses = courses.slice(0, 5).map(c => ({
      className: c.className,
      subjectName: c.subjectName,
    }));

    // 4) Dernières notes encodées
    const lastGrades = await StudentGrade.find({
      teacher: teacherId,
      schoolYear,
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('classId', 'nomClasse nom name')
      .lean();

    const lastGradesMapped = lastGrades.map(g => ({
      className: g.classId?.nomClasse || g.classId?.nom || g.classId?.name || '',
      subjectName: '', // à remplir via courseId si besoin
      period: g.period,
      date: g.updatedAt,
    }));

    // 5) Notifications (à enrichir plus tard)
    const notifications = [];

    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          role: req.user.role,
        },
        enseignant,
        isTitulaire,
        classesTitulaires,
        stats,
        todayClasses,
        lastGrades: lastGradesMapped,
        notifications,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/teachers/me/courses
exports.getCourses = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();

    const courses = await TeacherCourse.find({ teacher: teacherId, schoolYear })
      .sort({ optionCode: 1, className: 1, subjectName: 1 })
      .lean();

    res.json({
      success: true,
      courses: courses.map(c => ({
        id: c._id.toString(),
        classId: c.classId?.toString(),
        className: c.className,
        subjectId: c.subjectId ? c.subjectId.toString() : null,
        subjectName: c.subjectName,
        periodsLabel: c.periodsLabel,
        weight: c.weight,
        optionCode: c.optionCode,
        optionLabel: c.optionLabel,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/teachers/me/grades?classId=&subjectId=&period=
exports.getGrades = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, subjectId, period } = req.query;

    if (!classId || !period) {
      return res.status(400).json({
        success: false,
        message: 'classId et period sont requis',
      });
    }

    const eleves = await Eleve.find({
      classe: classId,
      anneeScolaire: schoolYear,
    })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    const gradeFilter = {
      teacher: teacherId,
      classId,
      period,
      schoolYear,
    };

    if (subjectId && subjectId !== 'null') {
      gradeFilter.subjectId = subjectId;
    }

    const grades = await StudentGrade.find(gradeFilter).lean();

    const gradesMap = new Map();
    grades.forEach((g) => {
      gradesMap.set(String(g.student), g.value);
    });

    const studentsResponse = eleves.map((el, index) => ({
      studentId: el._id,
      order: index + 1,
      fullName: `${el.nom} ${el.prenom}`.trim(),
      gender: el.sexe,
      gradeValue: gradesMap.get(String(el._id)) ?? null,
    }));

    res.json({
      success: true,
      students: studentsResponse,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/teachers/me/grades
// body: { classId, subjectId, period, grades: [{ studentId, value }] }
exports.saveGrades = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, subjectId, period, grades } = req.body;

    if (!classId || !period || !Array.isArray(grades)) {
      return res.status(400).json({
        success: false,
        message: 'classId, period et grades sont requis',
      });
    }

    const gradeFilterBase = {
      teacher: teacherId,
      classId,
      period,
      schoolYear,
    };

    if (subjectId) {
      gradeFilterBase.subjectId = subjectId;
    }

    const bulkOps = grades.map((g) => {
      const filter = {
        ...gradeFilterBase,
        student: g.studentId,
      };
      const update = {
        $set: {
          value: g.value,
        },
      };
      return {
        updateOne: {
          filter,
          update,
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await StudentGrade.bulkWrite(bulkOps);
    }

    res.json({
      success: true,
      message: 'Notes enregistrées avec succès',
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/teachers/me/attendance?classId=&date=
exports.getAttendance = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, date } = req.query;

    if (!classId || !date) {
      return res.status(400).json({
        success: false,
        message: 'classId et date sont requis',
      });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const eleves = await Eleve.find({
      classe: classId,
      anneeScolaire: schoolYear,
    })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    const attendances = await Attendance.find({
      teacher: teacherId,
      classId,
      schoolYear,
      date: { $gte: targetDate, $lt: nextDate },
    }).lean();

    const attMap = new Map();
    attendances.forEach((a) => {
      attMap.set(String(a.student), a);
    });

    const studentsResponse = eleves.map((el, index) => {
      const rec = attMap.get(String(el._id));
      return {
        studentId: el._id,
        order: index + 1,
        fullName: `${el.nom} ${el.prenom}`.trim(),
        present: rec?.present || false,
        absent: rec?.absent || false,
        late: rec?.late || false,
      };
    });

    res.json({
      success: true,
      students: studentsResponse,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/teachers/me/attendance
// body: { classId, date, entries: [{ studentId, present, absent, late }] }
exports.saveAttendance = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, date, entries } = req.body;

    if (!classId || !date || !Array.isArray(entries)) {
      return res.status(400).json({
        success: false,
        message: 'classId, date et entries sont requis',
      });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const bulkOps = entries.map((e) => {
      const filter = {
        teacher: teacherId,
        student: e.studentId,
        classId,
        schoolYear,
        date: targetDate,
      };
      const update = {
        $set: {
          present: !!e.present,
          absent: !!e.absent,
          late: !!e.late,
        },
      };
      return {
        updateOne: {
          filter,
          update,
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps);
    }

    res.json({
      success: true,
      message: 'Présences enregistrées avec succès',
    });
  } catch (err) {
    next(err);
  }
};

// ---------- Helper "classes titulaires" (fallback = classes où le prof a un cours) ----------
const getTeacherHomeroomClasses = async (teacherId, schoolYear) => {
  // Fallback : on considère comme "titulaires" les classes où il a au moins un cours
  const courses = await TeacherCourse.find({ teacher: teacherId, schoolYear }).lean();

  const map = new Map();
  courses.forEach((c) => {
    const classId = String(c.classId);
    const className = c.className || '';
    if (!classId || !className) return;
    if (!map.has(classId)) {
      map.set(classId, { classId, className });
    }
  });

  return Array.from(map.values());
};

// GET /api/teachers/me/bulletins
// GET /api/teachers/me/bulletins
exports.getBulletins = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const schoolId = req.user?.ecoleId || null;

    // 1) Tous les cours de cet enseignant pour l'année
    const courses = await TeacherCourse.find({
      teacher: teacherId,
      schoolYear,
      ...(schoolId ? { schoolId } : {}),
    }).lean();

    if (!courses.length) {
      return res.json({ success: true, bulletins: [] });
    }

    // 2) Récupérer les classIds uniques
    const classIds = [
      ...new Set(courses.map(c => String(c.classId)).filter(Boolean)),
    ];

    if (!classIds.length) {
      return res.json({ success: true, bulletins: [] });
    }

    // 3) Charger uniquement les classes qui existent vraiment pour cette année
    const classes = await Classe.find({
      _id: { $in: classIds },
      ...(schoolId ? { ecole: schoolId } : {}),
      anneeScolaire: schoolYear,
    })
      .select('_id nomClasse nom name')
      .lean();

    if (!classes.length) {
      return res.json({ success: true, bulletins: [] });
    }

    const validClassIds = new Set(classes.map(cl => String(cl._id)));
    const classLabelMap = new Map();
    classes.forEach(cl => {
      const label = cl.nomClasse || cl.nom || cl.name || '';
      if (!label) return;
      classLabelMap.set(String(cl._id), label);
    });

    // 4) Construire bulletins uniquement pour les classes valides
    const bulletins = [];

    validClassIds.forEach(classId => {
      const className = classLabelMap.get(classId) || '';
      if (!className) return;

      bulletins.push({
        id: `${classId}-S1`,
        className,
        semesterLabel: '1er semestre',
        typeLabel: 'Bulletin partiel',
      });

      bulletins.push({
        id: `${classId}-S2`,
        className,
        semesterLabel: '2ème semestre',
        typeLabel: 'Bulletin global',
      });
    });

    return res.json({ success: true, bulletins });
  } catch (err) {
    return next(err);
  }
};


exports.getTeacherClassesGrouped = async (req, res, next) => {
  try {
    const teacherId = req.user?.id; // ou _id selon ton auth
    const schoolYear = req.query.schoolYear || getCurrentSchoolYear();
    const schoolId = req.user?.ecoleId || null;

    const classes = await getClassesWithCoursesByClassId({
      schoolYear,
      teacherId,
      schoolId,
    });

    return res.json({
      success: true,
      count: classes.length,
      data: classes,
    });
  } catch (err) {
    console.error('Erreur getTeacherClassesGrouped:', err);
    return next(err);
  }
};

exports.exportTeacherClassesExcel = async (req, res, next) => {
  try {
    const teacherId = req.user?.id;
    const schoolYear = req.query.schoolYear || getCurrentSchoolYear();
    const schoolId = req.user?.ecoleId || null;

    const classes = await getClassesWithCoursesByClassId({
      schoolYear,
      teacherId,
      schoolId,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gabkut Schola';
    workbook.lastModifiedBy = 'Export classes / cours';
    const now = new Date();
    workbook.created = now;
    workbook.modified = now;

    const titleFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF111827' },
    };
    const headerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    const borderThin = {
      top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
    };

    // ============= ONGLET 1 : SYNTHÈSE PAR CLASSE =============
    const wsSynth = workbook.addWorksheet('Classes & cours', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    wsSynth.mergeCells('A1', 'G1');
    wsSynth.getCell('A1').value = 'Cours par classe (groupé par classId)';
    wsSynth.getCell('A1').font = {
      bold: true,
      size: 14,
      color: { argb: 'FFFFFFFF' },
    };
    wsSynth.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    wsSynth.getCell('A1').fill = titleFill;

    wsSynth.mergeCells('A2', 'G2');
    wsSynth.getCell('A2').value = `Année scolaire ${schoolYear}`;
    wsSynth.getCell('A2').font = {
      bold: true,
      size: 11,
      color: { argb: 'FFFFFFFF' },
    };
    wsSynth.getCell('A2').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    wsSynth.getCell('A2').fill = titleFill;

    wsSynth.getRow(1).height = 22;
    wsSynth.getRow(2).height = 18;
    wsSynth.addRow([]);

    wsSynth.columns = [
      { header: 'ClassId', key: 'classId', width: 28 },
      { header: 'Classe', key: 'className', width: 20 },
      { header: 'Option', key: 'optionLabel', width: 18 },
      { header: 'Pondération totale', key: 'totalWeight', width: 18 },
      { header: 'Nb cours', key: 'nbCourses', width: 10 },
      { header: 'Périodes', key: 'periodsLabel', width: 18 },
      { header: 'SchoolId', key: 'schoolId', width: 22 },
    ];

    const headerRowSynth = wsSynth.getRow(4);
    headerRowSynth.font = { bold: true, color: { argb: 'FF111827' }, size: 11 };
    headerRowSynth.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRowSynth.fill = headerFill;
    headerRowSynth.height = 20;
    headerRowSynth.eachCell((cell) => {
      cell.border = borderThin;
    });

    let synthRowIndex = 0;
    for (const cl of classes) {
      const totalWeight = cl.courses.reduce(
        (sum, c) => sum + (c.weight || 0),
        0
      );
      const row = wsSynth.addRow({
        classId: cl.classId,
        className: cl.className || '',
        optionLabel: cl.optionLabel || '',
        totalWeight,
        nbCourses: cl.courses.length,
        periodsLabel: cl.periodsLabel || '',
        schoolId: cl.schoolId || '',
      });
      synthRowIndex++;

      const bgColor = synthRowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';

      row.eachCell((cell, col) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.border = borderThin;
        cell.alignment = {
          vertical: 'middle',
          horizontal: col <= 2 ? 'left' : 'right',
        };
        if (col === 4 || col === 5) {
          cell.numFmt = '0';
        }
      });
    }

    // ============= ONGLET 2 : DÉTAIL COURS =============
    const wsDetail = workbook.addWorksheet('Détail cours', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    wsDetail.mergeCells('A1', 'F1');
    wsDetail.getCell('A1').value = 'Détail des cours par classeId';
    wsDetail.getCell('A1').font = {
      bold: true,
      size: 14,
      color: { argb: 'FFFFFFFF' },
    };
    wsDetail.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    wsDetail.getCell('A1').fill = titleFill;

    wsDetail.mergeCells('A2', 'F2');
    wsDetail.getCell('A2').value = `Année scolaire ${schoolYear}`;
    wsDetail.getCell('A2').font = {
      bold: true,
      size: 11,
      color: { argb: 'FFFFFFFF' },
    };
    wsDetail.getCell('A2').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    wsDetail.getCell('A2').fill = titleFill;

    wsDetail.getRow(1).height = 22;
    wsDetail.getRow(2).height = 18;
    wsDetail.addRow([]);

    wsDetail.columns = [
      { header: 'ClassId', key: 'classId', width: 28 },
      { header: 'Classe', key: 'className', width: 18 },
      { header: 'Matière', key: 'subjectName', width: 30 },
      { header: 'Pondération', key: 'weight', width: 14 },
      { header: 'TeacherId', key: 'teacherId', width: 28 },
      { header: 'Option', key: 'optionLabel', width: 18 },
    ];

    const headerRowDet = wsDetail.getRow(4);
    headerRowDet.font = { bold: true, color: { argb: 'FF111827' }, size: 11 };
    headerRowDet.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRowDet.fill = headerFill;
    headerRowDet.height = 20;
    headerRowDet.eachCell((cell) => {
      cell.border = borderThin;
    });

    let detIndex = 0;
    for (const cl of classes) {
      for (const c of cl.courses) {
        const row = wsDetail.addRow({
          classId: cl.classId,
          className: cl.className || '',
          subjectName: c.subjectName || '',
          weight: c.weight || 0,
          teacherId: c.teacher,
          optionLabel: cl.optionLabel || '',
        });
        detIndex++;

        const bgColor = detIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';

        row.eachCell((cell, col) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor },
          };
          cell.border = borderThin;
          cell.alignment = {
            vertical: 'middle',
            horizontal: col <= 3 ? 'left' : 'right',
          };
          if (col === 4) {
            cell.numFmt = '0';
          }
        });
      }
    }

    const fileName = `classes_cours_${schoolYear}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  } catch (err) {
    console.error('Erreur exportTeacherClassesExcel:', err);
    return next(err);
  }
};

// GET /api/teachers/me/bulletins/:id
// :id = classId-S1 ou classId-S2
exports.getBulletinDetail = async (req, res, next) => {
  try {
    const schoolYear = getCurrentSchoolYear();
    const { id } = req.params;
    const teacherId = req.user.id;

    const lastDash = id.lastIndexOf('-');
    if (lastDash <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Identifiant de bulletin invalide.',
      });
    }

    const classId = id.substring(0, lastDash);
    const semestreCode = id.substring(lastDash + 1); // "S1" ou "S2"

    if (!classId || !semestreCode) {
      return res.status(400).json({
        success: false,
        message: 'Identifiant de bulletin invalide.',
      });
    }

    // contrôle d’accès: le prof doit au moins avoir un cours dans cette classe (fallback titulaire)
    const homeroomClasses = await getTeacherHomeroomClasses(teacherId, schoolYear);
    const canSee = homeroomClasses.some((c) => c.classId === String(classId));

    if (!canSee) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à consulter le bulletin de cette classe.",
      });
    }

    const classe = await Classe.findById(classId)
      .select('nomClasse nom name niveau')
      .lean();

    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable.',
      });
    }

    const eleves = await Eleve.find({
      classe: classId,
      anneeScolaire: schoolYear,
    })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    if (!eleves.length) {
      return res.json({
        success: true,
        anneeScolaire: schoolYear,
        classe: {
          id: String(classId),
          label: classe.nomClasse || classe.nom || classe.name || '',
        },
        semestre: semestreCode,
        students: [],
      });
    }

    const studentIds = eleves.map((e) => String(e._id));

    const courses = await TeacherCourse.find({
      classId,
      schoolYear,
    })
      .sort({ subjectName: 1 })
      .lean();

    if (!courses.length) {
      return res.json({
        success: true,
        anneeScolaire: schoolYear,
        classe: {
          id: String(classId),
          label: classe.nomClasse || classe.nom || classe.name || '',
        },
        semestre: semestreCode,
        students: [],
      });
    }

    const grades = await StudentGrade.find({
      classId,
      schoolYear,
      student: { $in: studentIds },
    })
      .select('student classId courseId subjectId teacher period value')
      .lean();

    const gradesByCourse = new Map();
    const gradesFallback = new Map();

    grades.forEach((g) => {
      const sid = String(g.student);
      const cid = g.courseId ? String(g.courseId) : null;
      const period = g.period;

      if (cid) {
        const key = `${sid}|${cid}|${period}`;
        gradesByCourse.set(key, g.value);
      } else {
        const keyFb = `${sid}|${period}`;
        gradesFallback.set(keyFb, g.value);
      }
    });

    function getGroupForSubject(subjectName = '') {
      const s = subjectName.toLowerCase();

      if (s.includes('religion') || s.includes('vie') || s.includes('civ') || s.includes('morale')) {
        return 'Éducation religieuse, civique et morale';
      }
      if (s.includes('chimie') || s.includes('physique') || s.includes('microbio') || s.includes('biologie')) {
        return 'Sciences';
      }
      if (s.includes('dessin') || s.includes('travail manuel') || s.includes('écriture')) {
        return 'Dessin et travaux pratiques';
      }
      if (s.includes('economie')) {
        return 'Sciences économiques';
      }
      if (s.includes('ed. phys') || s.includes('education physique')) {
        return 'Éducation physique';
      }
      if (s.includes('mus') || s.includes('théatr')) {
        return 'Éducation musicale / Théâtrale';
      }
      if (s.includes('geo')) {
        return 'Géographie';
      }
      if (s.includes('hist')) {
        return 'Histoire';
      }
      if (s.includes('info')) {
        return 'Informatique';
      }
      if (s.includes('langue') || s.includes('franç') || s.includes('anglais')) {
        return 'Langues';
      }
      if (s.includes('pédagogie') || s.includes('psychologie') || s.includes('didactique')) {
        return 'Pédagogie / Didactique';
      }

      return 'Autres branches';
    }

    function buildLinesForStudent(studentId) {
      const lines = [];

      courses.forEach((c) => {
        const cid = String(c._id);
        const subj = c.subjectName || '';

        const keyP1 = `${studentId}|${cid}|P1`;
        const keyP2 = `${studentId}|${cid}|P2`;
        const keyEX1 = `${studentId}|${cid}|EX1`;
        const keyP3 = `${studentId}|${cid}|P3`;
        const keyP4 = `${studentId}|${cid}|P4`;
        const keyEX2 = `${studentId}|${cid}|EX2`;

        let P1 = gradesByCourse.has(keyP1) ? gradesByCourse.get(keyP1) : null;
        let P2 = gradesByCourse.has(keyP2) ? gradesByCourse.get(keyP2) : null;
        let EX1 = gradesByCourse.has(keyEX1) ? gradesByCourse.get(keyEX1) : null;
        let P3 = gradesByCourse.has(keyP3) ? gradesByCourse.get(keyP3) : null;
        let P4 = gradesByCourse.has(keyP4) ? gradesByCourse.get(keyP4) : null;
        let EX2 = gradesByCourse.has(keyEX2) ? gradesByCourse.get(keyEX2) : null;

        if (P1 == null) P1 = gradesFallback.get(`${studentId}|P1`) ?? null;
        if (P2 == null) P2 = gradesFallback.get(`${studentId}|P2`) ?? null;
        if (EX1 == null) EX1 = gradesFallback.get(`${studentId}|EX1`) ?? null;
        if (P3 == null) P3 = gradesFallback.get(`${studentId}|P3`) ?? null;
        if (P4 == null) P4 = gradesFallback.get(`${studentId}|P4`) ?? null;
        if (EX2 == null) EX2 = gradesFallback.get(`${studentId}|EX2`) ?? null;

        const sem1Tot = (P1 || 0) + (P2 || 0) + (EX1 || 0);
        const sem2Tot = (P3 || 0) + (P4 || 0) + (EX2 || 0);
        const tg = sem1Tot + sem2Tot;

        lines.push({
          group: getGroupForSubject(subj),
          matiere: subj,
          sem1: {
            p1: P1,
            p2: P2,
            exam: EX1,
            tot: sem1Tot || null,
          },
          sem2: {
            p3: P3,
            p4: P4,
            exam: EX2,
            tot: sem2Tot || null,
          },
          tg: tg || null,
        });
      });

      return lines;
    }

    function computeAggregates(lines) {
      const agg = {
        sem1: { p1: 0, p2: 0, exam: 0, tot: 0 },
        sem2: { p3: 0, p4: 0, exam: 0, tot: 0 },
        tg: 0,
      };

      lines.forEach((l) => {
        const s1 = l.sem1 || {};
        const s2 = l.sem2 || {};

        if (s1.p1 != null) agg.sem1.p1 += s1.p1;
        if (s1.p2 != null) agg.sem1.p2 += s1.p2;
        if (s1.exam != null) agg.sem1.exam += s1.exam;
        if (s1.tot != null) agg.sem1.tot += s1.tot;

        if (s2.p3 != null) agg.sem2.p3 += s2.p3;
        if (s2.p4 != null) agg.sem2.p4 += s2.p4;
        if (s2.exam != null) agg.sem2.exam += s2.exam;
        if (s2.tot != null) agg.sem2.tot += s2.tot;

        if (l.tg != null) agg.tg += l.tg;
      });

      const nbBranches = lines.length || 1;
      const perNoteMax = 20;

      const globalMaxima = {
        sem1: {
          p1: nbBranches * perNoteMax,
          p2: nbBranches * perNoteMax,
          exam: nbBranches * perNoteMax,
          tot: nbBranches * perNoteMax * 3,
        },
        sem2: {
          p3: nbBranches * perNoteMax,
          p4: nbBranches * perNoteMax,
          exam: nbBranches * perNoteMax,
          tot: nbBranches * perNoteMax * 3,
        },
        tg: nbBranches * perNoteMax * 6,
      };

      const totaux = agg;

      function safePct(total, max) {
        if (!max || max <= 0) return 0;
        return (total * 100) / max;
      }

      const pourcentages = {
        sem1: {
          p1: safePct(agg.sem1.p1, globalMaxima.sem1.p1),
          p2: safePct(agg.sem1.p2, globalMaxima.sem1.p2),
          exam: safePct(agg.sem1.exam, globalMaxima.sem1.exam),
          tot: safePct(agg.sem1.tot, globalMaxima.sem1.tot),
        },
        sem2: {
          p3: safePct(agg.sem2.p3, globalMaxima.sem2.p3),
          p4: safePct(agg.sem2.p4, globalMaxima.sem2.p4),
          exam: safePct(agg.sem2.exam, globalMaxima.sem2.exam),
          tot: safePct(agg.sem2.tot, globalMaxima.sem2.tot),
        },
        tg: safePct(agg.tg, globalMaxima.tg),
      };

      return { globalMaxima, totaux, pourcentages };
    }

    const studentsPayload = eleves.map((el) => {
      const sid = String(el._id);
      const lines = buildLinesForStudent(sid);
      const { globalMaxima, totaux, pourcentages } = computeAggregates(lines);

      return {
        id: sid,
        nom: `${el.nom} ${el.prenom}`.trim(),
        sexe: el.sexe || '',
        dateNaiss: el.dateNaiss
          ? new Date(el.dateNaiss).toISOString().slice(0, 10)
          : '',
        classe: classe.nomClasse || classe.nom || classe.name || '',
        perm: el.perm || el.code || '',
        province: el.province || '',
        ville: el.ville || '',
        commune: el.commune || el.territoire || '',
        ecole: el.ecole || 'Collège Le Mérite',

        lines,
        maximaBlocks: [],
        globalMaxima,
        totaux,
        pourcentages,
      };
    });

    return res.json({
      success: true,
      anneeScolaire: schoolYear,
      classe: {
        id: String(classId),
        label: classe.nomClasse || classe.nom || classe.name || '',
      },
      semestre: semestreCode,
      students: studentsPayload,
    });
  } catch (err) {
    return next(err);
  }
};






// POST /api/teachers/me/courses
exports.createCourse = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const {
      classId,
      className,
      subjectName,
      weight,
      periodsLabel,
    } = req.body;

    if (!classId || !subjectName) {
      return res.status(400).json({
        success: false,
        message: 'classId et subjectName sont requis',
      });
    }

    const course = await TeacherCourse.create({
      teacher: teacherId,
      classId,
      className,
      subjectName: subjectName.trim(),
      optionCode: null,
      optionLabel: null,
      weight: Number(weight) || 0,
      periodsLabel: periodsLabel || 'P1-P6 / EX',
      schoolYear: getCurrentSchoolYear(),
      schoolId: null,
    });

    return res.status(201).json({ success: true, course });
  } catch (err) {
    return next(err);
  }
};

// PUT /api/teachers/me/courses/:id
exports.updateCourse = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const courseId = req.params.id;

    const course = await TeacherCourse.findOneAndUpdate(
      { _id: courseId, teacher: teacherId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé',
      });
    }

    return res.json({ success: true, course });
  } catch (err) {
    return next(err);
  }
};

// DELETE /api/teachers/me/courses/:id
exports.deleteCourse = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const courseId = req.params.id;

    const deleted = await TeacherCourse.findOneAndDelete({
      _id: courseId,
      teacher: teacherId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé',
      });
    }

    return res.json({ success: true, message: 'Cours supprimé' });
  } catch (err) {
    return next(err);
  }
};

// EXPORT NOTES D'UNE PÉRIODE (simple)
exports.exportGradesXlsx = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, subjectId, period } = req.query;

    if (!classId || !period) {
      return res.status(400).json({
        success: false,
        message: 'classId et period sont requis pour exporter.',
      });
    }

    // Récupération des élèves et notes
    const students = await getStudentsAndGradesForExport(
      teacherId,
      classId,
      subjectId,
      period
    );

    if (!students || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun élève trouvé pour cette classe.',
      });
    }

    // Récupération info classe et cours
    const classe = await Classe.findById(classId)
      .select('nomClasse nom name niveau')
      .lean();
    
    const classLabel = classe
      ? classe.nomClasse || classe.nom || classe.name || classe.niveau || 'Classe'
      : 'Classe';

    let subjectLabel = 'Cours';
    if (subjectId) {
      const course = await TeacherCourse.findOne({
        _id: subjectId,
        teacher: teacherId,
      })
        .select('subjectName')
        .lean();
      
      if (course) {
        subjectLabel = course.subjectName || 'Cours';
      }
    }

    // ===== CALCUL DES STATISTIQUES =====
    const gradesWithValues = students.filter(s => s.gradeValue != null);
    const grades = gradesWithValues.map(s => Number(s.gradeValue));

    let stats = {
      nbEleves: students.length,
      nbAvecNote: gradesWithValues.length,
      nbSansNote: students.length - gradesWithValues.length,
      moyenne: null,
      mediane: null,
      max: null,
      min: null,
      tauxReussite: null,
      repartition: {
        'Excellent (>=80)': 0,
        'Bien (60-79)': 0,
        'Passable (40-59)': 0,
        'Échec (<40)': 0,
      },
    };

    if (grades.length > 0) {
      const sum = grades.reduce((acc, g) => acc + g, 0);
      stats.moyenne = +(sum / grades.length).toFixed(2);
      stats.max = Math.max(...grades);
      stats.min = Math.min(...grades);

      // Médiane
      const sorted = [...grades].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      stats.mediane =
        sorted.length % 2 === 0
          ? +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2)
          : sorted[mid];

      // Répartition
      grades.forEach(g => {
        if (g >= 80) stats.repartition['Excellent (>=80)']++;
        else if (g >= 60) stats.repartition['Bien (60-79)']++;
        else if (g >= 40) stats.repartition['Passable (40-59)']++;
        else stats.repartition['Échec (<40)']++;
      });

      // Taux de réussite (>=50 ou >=40 selon ton système)
      const reussis = grades.filter(g => g >= 50).length;
      stats.tauxReussite = +((reussis / grades.length) * 100).toFixed(2);
    }

    // ===== CRÉATION WORKBOOK =====
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Système de Gestion Scolaire';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ========== ONGLET 1: STATISTIQUES ==========
    const statsSheet = workbook.addWorksheet('Statistiques', {
      views: [{ showGridLines: false }],
    });

    // Titre principal
    statsSheet.mergeCells('A1:E2');
    const titleCell = statsSheet.getCell('A1');
    titleCell.value = `📊 STATISTIQUES DES NOTES`;
    titleCell.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E86AB' },
    };

    // Informations contextuelles
    statsSheet.mergeCells('A3:E3');
    const infoCell = statsSheet.getCell('A3');
    infoCell.value = `${classLabel} • ${subjectLabel} • Période: ${period} • ${schoolYear}`;
    infoCell.font = { size: 13, bold: true };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    infoCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F4F8' },
    };

    statsSheet.addRow([]);

    // KPI Cards
    const kpiRow = 5;
    const kpiData = [
      { label: 'ÉLÈVES', value: stats.nbEleves, icon: '👥', color: 'FF4A90E2' },
      { label: 'AVEC NOTE', value: stats.nbAvecNote, icon: '✅', color: 'FF34C759' },
      { label: 'SANS NOTE', value: stats.nbSansNote, icon: '⚠️', color: 'FFFF9500' },
      { label: 'MOYENNE', value: stats.moyenne ?? '-', icon: '📊', color: 'FF5856D6' },
      { label: 'MAX', value: stats.max ?? '-', icon: '🏆', color: 'FFFFC107' },
    ];

    kpiData.forEach((kpi, idx) => {
      const col = String.fromCharCode(65 + idx); // A, B, C, D, E

      const iconCell = statsSheet.getCell(`${col}${kpiRow}`);
      iconCell.value = kpi.icon;
      iconCell.font = { size: 24 };
      iconCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const valueCell = statsSheet.getCell(`${col}${kpiRow + 1}`);
      valueCell.value = kpi.value;
      valueCell.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: kpi.color },
      };

      const labelCell = statsSheet.getCell(`${col}${kpiRow + 2}`);
      labelCell.value = kpi.label;
      labelCell.font = { size: 10, bold: true };
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' },
      };

      statsSheet.getColumn(col).width = 16;
    });

    statsSheet.getRow(kpiRow).height = 30;
    statsSheet.getRow(kpiRow + 1).height = 38;
    statsSheet.getRow(kpiRow + 2).height = 24;

    // Statistiques supplémentaires
    const extraRow = kpiRow + 4;
    statsSheet.mergeCells(`A${extraRow}:E${extraRow}`);
    const extraTitle = statsSheet.getCell(`A${extraRow}`);
    extraTitle.value = '📈 INDICATEURS DÉTAILLÉS';
    extraTitle.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    extraTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    extraTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5856D6' },
    };

    const extraData = [
      { label: 'Note Minimale', value: stats.min ?? '-', color: 'FFFF3B30' },
      { label: 'Note Médiane', value: stats.mediane ?? '-', color: 'FF3498DB' },
      { label: 'Taux de Réussite (≥50)', value: stats.tauxReussite ? `${stats.tauxReussite}%` : '-', color: 'FF2ECC71' },
    ];

    extraData.forEach((item, idx) => {
      const row = extraRow + idx + 1;
      
      statsSheet.mergeCells(`A${row}:C${row}`);
      const labelCell = statsSheet.getCell(`A${row}`);
      labelCell.value = item.label;
      labelCell.font = { size: 12, bold: true };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9F9F9' },
      };

      statsSheet.mergeCells(`D${row}:E${row}`);
      const valueCell = statsSheet.getCell(`D${row}`);
      valueCell.value = item.value;
      valueCell.font = { size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: item.color },
      };

      statsSheet.getRow(row).height = 24;
    });

    // Répartition des notes
    const repRow = extraRow + 5;
    statsSheet.mergeCells(`A${repRow}:E${repRow}`);
    const repTitle = statsSheet.getCell(`A${repRow}`);
    repTitle.value = '📊 RÉPARTITION DES NOTES';
    repTitle.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    repTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    repTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16A085' },
    };

    const repData = [
      { label: 'Excellent (≥80)', value: stats.repartition['Excellent (>=80)'], color: 'FF27AE60' },
      { label: 'Bien (60-79)', value: stats.repartition['Bien (60-79)'], color: 'FF3498DB' },
      { label: 'Passable (40-59)', value: stats.repartition['Passable (40-59)'], color: 'FFF39C12' },
      { label: 'Échec (<40)', value: stats.repartition['Échec (<40)'], color: 'FFE74C3C' },
    ];

    repData.forEach((item, idx) => {
      const row = repRow + idx + 1;
      
      statsSheet.mergeCells(`A${row}:C${row}`);
      const labelCell = statsSheet.getCell(`A${row}`);
      labelCell.value = item.label;
      labelCell.font = { size: 12, bold: true };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9F9F9' },
      };

      statsSheet.mergeCells(`D${row}:E${row}`);
      const valueCell = statsSheet.getCell(`D${row}`);
      valueCell.value = item.value;
      valueCell.font = { size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: item.color },
      };

      statsSheet.getRow(row).height = 24;
    });

    // ========== ONGLET 2: NOTES DÉTAILLÉES ==========
    const notesSheet = workbook.addWorksheet('Notes Détaillées');

    const headerRow = notesSheet.addRow(['N°', 'Nom complet', 'Genre', 'Note', 'Appréciation']);

    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2C3E50' },
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } },
      };
    });

    notesSheet.getRow(1).height = 28;
    notesSheet.getColumn(1).width = 6;
    notesSheet.getColumn(2).width = 35;
    notesSheet.getColumn(3).width = 10;
    notesSheet.getColumn(4).width = 12;
    notesSheet.getColumn(5).width = 18;

    // Fonction d'appréciation
    const getAppreciation = (note) => {
      if (note == null) return '';
      if (note >= 80) return 'Excellent';
      if (note >= 60) return 'Bien';
      if (note >= 50) return 'Assez Bien';
      if (note >= 40) return 'Passable';
      return 'Échec';
    };

    students.forEach((st, index) => {
      const row = notesSheet.addRow([
        index + 1,
        st.fullName || '',
        st.gender || '',
        st.gradeValue ?? '',
        getAppreciation(st.gradeValue),
      ]);

      row.height = 22;

      // Alternance de couleurs
      const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA';

      row.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

      // Couleur conditionnelle pour la note
      const noteCell = row.getCell(4);
      const appreciationCell = row.getCell(5);
      const note = st.gradeValue;

      if (note != null) {
        if (note >= 80) {
          noteCell.font = { color: { argb: 'FF006100' }, bold: true, size: 12 };
          appreciationCell.font = { color: { argb: 'FF006100' }, bold: true };
        } else if (note >= 60) {
          noteCell.font = { color: { argb: 'FF0563C1' }, bold: true, size: 12 };
          appreciationCell.font = { color: { argb: 'FF0563C1' }, bold: true };
        } else if (note >= 50) {
          noteCell.font = { color: { argb: 'FF9C6500' }, bold: true, size: 12 };
          appreciationCell.font = { color: { argb: 'FF9C6500' }, bold: true };
        } else if (note >= 40) {
          noteCell.font = { color: { argb: 'FFE36C09' }, bold: true, size: 12 };
          appreciationCell.font = { color: { argb: 'FFE36C09' }, bold: true };
        } else {
          noteCell.font = { color: { argb: 'FF9C0006' }, bold: true, size: 12 };
          appreciationCell.font = { color: { argb: 'FF9C0006' }, bold: true };
        }
      }
    });

    // ========== ONGLET 3: CLASSEMENT ==========
    const rankingSheet = workbook.addWorksheet('Classement');

    const rankingHeader = rankingSheet.addRow(['Rang', 'Nom complet', 'Note', 'Appréciation']);

    rankingHeader.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF34495E' },
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } },
      };
    });

    rankingSheet.getRow(1).height = 28;
    rankingSheet.getColumn(1).width = 8;
    rankingSheet.getColumn(2).width = 35;
    rankingSheet.getColumn(3).width = 12;
    rankingSheet.getColumn(4).width = 18;

    // Tri par note décroissante
    const studentsWithGrades = students.filter(s => s.gradeValue != null);
    const sorted = [...studentsWithGrades].sort((a, b) => b.gradeValue - a.gradeValue);

    sorted.forEach((st, index) => {
      const row = rankingSheet.addRow([
        index + 1,
        st.fullName || '',
        st.gradeValue,
        getAppreciation(st.gradeValue),
      ]);

      row.height = 22;

      // Médaille pour les 3 premiers
      if (index === 0) {
        row.getCell(1).value = '🥇';
        row.getCell(1).font = { size: 16 };
      } else if (index === 1) {
        row.getCell(1).value = '🥈';
        row.getCell(1).font = { size: 16 };
      } else if (index === 2) {
        row.getCell(1).value = '🥉';
        row.getCell(1).font = { size: 16 };
      }

      const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA';

      row.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

      // Couleur pour la note
      const noteCell = row.getCell(3);
      const appreciationCell = row.getCell(4);
      const note = st.gradeValue;

      if (note >= 80) {
        noteCell.font = { color: { argb: 'FF006100' }, bold: true, size: 12 };
        appreciationCell.font = { color: { argb: 'FF006100' }, bold: true };
      } else if (note >= 60) {
        noteCell.font = { color: { argb: 'FF0563C1' }, bold: true, size: 12 };
        appreciationCell.font = { color: { argb: 'FF0563C1' }, bold: true };
      } else if (note >= 50) {
        noteCell.font = { color: { argb: 'FF9C6500' }, bold: true, size: 12 };
        appreciationCell.font = { color: { argb: 'FF9C6500' }, bold: true };
      } else {
        noteCell.font = { color: { argb: 'FF9C0006' }, bold: true, size: 12 };
        appreciationCell.font = { color: { argb: 'FF9C0006' }, bold: true };
      }
    });

    // ===== GÉNÉRATION DU FICHIER =====
    const fileName = `notes_${classLabel}_${period}_${Date.now()}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  } catch (err) {
    console.error('exportGradesXlsx error:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du fichier Excel.',
    });
  }
};

async function getStudentsAndGradesForExport(teacherId, classId, subjectId, period) {
  const schoolYear = getCurrentSchoolYear();

  const eleves = await Eleve.find({
    classe: classId,
    anneeScolaire: schoolYear,
  })
    .sort({ nom: 1, prenom: 1 })
    .lean();

  const gradeFilter = {
    teacher: teacherId,
    classId,
    period,
    schoolYear,
  };

  if (subjectId && subjectId !== 'null') {
    gradeFilter.subjectId = subjectId;
  }

  const grades = await StudentGrade.find(gradeFilter).lean();

  const gradesMap = new Map();
  grades.forEach((g) => {
    gradesMap.set(String(g.student), g.value);
  });

  const students = eleves.map((el, index) => ({
    studentId: el._id,
    order: index + 1,
    fullName: `${el.nom} ${el.prenom}`.trim(),
    gender: el.sexe,
    gradeValue: gradesMap.get(String(el._id)) ?? null,
  }));

  return students;
}

// ========== RÉCAPITULATIF NOTES ==========
exports.getGradesRecap = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();

    const {
      classId,
      courseId,
      period,
      gender,
      hasGrade,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(200, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const courses = await TeacherCourse.find({ teacher: teacherId, schoolYear }).lean();

    if (!courses.length) {
      return res.json({
        success: true,
        rows: [],
        total: 0,
        totalPages: 0,
        offset: 0,
        meta: {
          classes: [],
          courses: [],
        },
      });
    }

    const classIds = [...new Set(courses.map(c => String(c.classId)))];
    const classes = await Classe.find({ _id: { $in: classIds } })
      .select('nomClasse nom name niveau')
      .lean();

    const classMap = new Map();
    classes.forEach(cl => {
      const label =
        cl.nomClasse ||
        cl.nom ||
        cl.name ||
        cl.niveau ||
        '';
      classMap.set(String(cl._id), label);
    });

    const metaClasses = classIds.map(id => {
      const fromMap = classMap.get(id) || '';
      const fromCourse = (courses.find(c => String(c.classId) === id)?.className) || '';
      return {
        id,
        name: fromMap || fromCourse || '(Classe sans nom)',
      };
    });

    const metaCourses = courses.map(c => ({
      id: String(c._id),
      classId: String(c.classId),
      className: c.className || classMap.get(String(c.classId)) || '',
      subjectName: c.subjectName || '',
    }));

    let filteredCourses = courses;
    if (classId) {
      filteredCourses = filteredCourses.filter(c => String(c.classId) === String(classId));
    }
    if (courseId) {
      filteredCourses = filteredCourses.filter(c => String(c._id) === String(courseId));
    }

    if (!filteredCourses.length) {
      return res.json({
        success: true,
        rows: [],
        total: 0,
        totalPages: 0,
        offset: 0,
        meta: {
          classes: metaClasses,
          courses: metaCourses,
        },
      });
    }

    const targetClassIds = [...new Set(filteredCourses.map(c => String(c.classId)))];

    const eleves = await Eleve.find({
      classe: { $in: targetClassIds },
      anneeScolaire: schoolYear,
    })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    if (!eleves.length) {
      return res.json({
        success: true,
        rows: [],
        total: 0,
        totalPages: 0,
        offset: 0,
        meta: {
          classes: metaClasses,
          courses: metaCourses,
        },
      });
    }

    const studentIds = eleves.map(e => String(e._id));

    const gradeFilter = {
      teacher: teacherId,
      schoolYear,
      student: { $in: studentIds },
    };

    if (period) {
      gradeFilter.period = period;
    }

    const courseIdsForFilter = filteredCourses.map(c => String(c._id));
    gradeFilter.courseId = { $in: courseIdsForFilter };

    const grades = await StudentGrade.find(gradeFilter)
      .select('student classId subjectId courseId period value')
      .lean();

    const gradesByStudentCoursePeriod = new Map();
    grades.forEach(g => {
      const key = `${String(g.student)}|${String(g.courseId)}|${g.period}`;
      gradesByStudentCoursePeriod.set(key, g.value);
    });

    const rowsAll = [];
    eleves.forEach(el => {
      const className =
        classMap.get(String(el.classe)) ||
        (filteredCourses.find(c => String(c.classId) === String(el.classe))?.className) ||
        '';

      filteredCourses.forEach(c => {
        if (String(c.classId) !== String(el.classe)) return;

        const getValue = (p) => {
          const k = `${String(el._id)}|${String(c._id)}|${p}`;
          return gradesByStudentCoursePeriod.has(k)
            ? gradesByStudentCoursePeriod.get(k)
            : null;
        };

        const row = {
          classId: String(c.classId),
          className,
          courseId: String(c._id),
          subjectName: c.subjectName || '',
          studentId: String(el._id),
          fullName: `${el.nom} ${el.prenom}`.trim(),
          gender: el.sexe || '',
          P1: getValue('P1'),
          P2: getValue('P2'),
          EX1: getValue('EX1'),
          P3: getValue('P3'),
          P4: getValue('P4'),
          EX2: getValue('EX2'),
        };

        rowsAll.push(row);
      });
    });

    let rowsFiltered = rowsAll;

    if (gender) {
      rowsFiltered = rowsFiltered.filter(r => (r.gender || '').toUpperCase() === gender.toUpperCase());
    }

    if (hasGrade === 'with') {
      rowsFiltered = rowsFiltered.filter(r =>
        r.P1 != null || r.P2 != null || r.EX1 != null || r.P3 != null || r.P4 != null || r.EX2 != null
      );
    } else if (hasGrade === 'without') {
      rowsFiltered = rowsFiltered.filter(r =>
        r.P1 == null && r.P2 == null && r.EX1 == null && r.P3 == null && r.P4 == null && r.EX2 == null
      );
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      rowsFiltered = rowsFiltered.filter(r =>
        r.fullName.toLowerCase().includes(term) ||
        (r.className || '').toLowerCase().includes(term) ||
        (r.subjectName || '').toLowerCase().includes(term)
      );
    }

    const total = rowsFiltered.length;
    const totalPages = total ? Math.ceil(total / pageSize) : 0;
    const slice = rowsFiltered.slice(skip, skip + pageSize);

    return res.json({
      success: true,
      rows: slice,
      total,
      totalPages,
      offset: skip,
      meta: {
        classes: metaClasses,
        courses: metaCourses,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// EXPORT XLSX RÉCAP (AVEC T1 / T2 / TOTAL)
exports.exportGradesRecapXlsx = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();

    const {
      classId,
      courseId,
      period,
      gender,
      hasGrade,
      search,
    } = req.query;

    // 1) Récup cours du prof
    const courses = await TeacherCourse.find({ teacher: teacherId, schoolYear }).lean();

    if (!courses.length) {
      return res.status(400).json({
        success: false,
        message: 'Aucun cours trouvé pour générer le récapitulatif.',
      });
    }

    const classIds = [...new Set(courses.map(c => String(c.classId)))];
    const classes = await Classe.find({ _id: { $in: classIds } })
      .select('nomClasse nom name niveau')
      .lean();

    const classMap = new Map();
    classes.forEach(cl => {
      const label =
        cl.nomClasse ||
        cl.nom ||
        cl.name ||
        cl.niveau ||
        '';
      classMap.set(String(cl._id), label);
    });

    // Filtres sur les cours
    let filteredCourses = courses;
    if (classId) {
      filteredCourses = filteredCourses.filter(c => String(c.classId) === String(classId));
    }
    if (courseId) {
      filteredCourses = filteredCourses.filter(c => String(c._id) === String(courseId));
    }

    if (!filteredCourses.length) {
      return res.status(400).json({
        success: false,
        message: 'Aucun cours correspondant aux filtres.',
      });
    }

    const targetClassIds = [...new Set(filteredCourses.map(c => String(c.classId)))];

    const eleves = await Eleve.find({
      classe: { $in: targetClassIds },
      anneeScolaire: schoolYear,
    })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    if (!eleves.length) {
      return res.status(400).json({
        success: false,
        message: 'Aucun élève trouvé pour les classes sélectionnées.',
      });
    }

    const studentIds = eleves.map(e => String(e._id));

    const gradeFilter = {
      teacher: teacherId,
      schoolYear,
      student: { $in: studentIds },
    };

    if (period) {
      gradeFilter.period = period;
    }

    const courseIdsForFilter = filteredCourses.map(c => String(c._id));
    gradeFilter.courseId = { $in: courseIdsForFilter };

    const grades = await StudentGrade.find(gradeFilter)
      .select('student classId subjectId courseId period value')
      .lean();

    const gradesByStudentCoursePeriod = new Map();
    grades.forEach(g => {
      const key = `${String(g.student)}|${String(g.courseId)}|${g.period}`;
      gradesByStudentCoursePeriod.set(key, g.value);
    });

    // Construction des lignes "logiques"
    let rowsAll = [];
    eleves.forEach(el => {
      const className =
        classMap.get(String(el.classe)) ||
        (filteredCourses.find(c => String(c.classId) === String(el.classe))?.className) ||
        '';

      filteredCourses.forEach(c => {
        if (String(c.classId) !== String(el.classe)) return;

        const getValue = (p) => {
          const k = `${String(el._id)}|${String(c._id)}|${p}`;
          return gradesByStudentCoursePeriod.has(k)
            ? gradesByStudentCoursePeriod.get(k)
            : null;
        };

        const row = {
          classId: String(c.classId),
          className,
          courseId: String(c._id),
          subjectName: c.subjectName || '',
          studentId: String(el._id),
          fullName: `${el.nom} ${el.prenom}`.trim(),
          gender: el.sexe || '',
          P1: getValue('P1'),
          P2: getValue('P2'),
          EX1: getValue('EX1'),
          P3: getValue('P3'),
          P4: getValue('P4'),
          EX2: getValue('EX2'),
        };

        rowsAll.push(row);
      });
    });

    // Filtres supplémentaires
    if (gender) {
      rowsAll = rowsAll.filter(r => (r.gender || '').toUpperCase() === gender.toUpperCase());
    }

    if (hasGrade === 'with') {
      rowsAll = rowsAll.filter(r =>
        r.P1 != null || r.P2 != null || r.EX1 != null || r.P3 != null || r.P4 != null || r.EX2 != null
      );
    } else if (hasGrade === 'without') {
      rowsAll = rowsAll.filter(r =>
        r.P1 == null && r.P2 == null && r.EX1 == null && r.P3 == null && r.P4 == null && r.EX2 == null
      );
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      rowsAll = rowsAll.filter(r =>
        r.fullName.toLowerCase().includes(term) ||
        (r.className || '').toLowerCase().includes(term) ||
        (r.subjectName || '').toLowerCase().includes(term)
      );
    }

    if (!rowsAll.length) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à exporter pour les filtres sélectionnés.',
      });
    }

    // Fonctions de calcul – tu les as déjà, je suppose
    const computeT1Safe = (r) => {
      const v = computeT1(r);
      return v === null || v === undefined ? null : v;
    };
    const computeT2Safe = (r) => {
      const v = computeT2(r);
      return v === null || v === undefined ? null : v;
    };
    const computeTotalSafe = (r) => {
      const v = computeTotal(r);
      return v === null || v === undefined ? null : v;
    };

    // Préparation stats globales
    let stats = {
      nbLignes: rowsAll.length,
      nbEleves: new Set(rowsAll.map(r => r.studentId)).size,
      nbCours: new Set(rowsAll.map(r => r.courseId)).size,
      moyenneGlobale: null,
      maxNote: null,
      minNote: null,
      repartition: {
        '>= 80': 0,
        '60-79': 0,
        '40-59': 0,
        '< 40': 0,
      },
    };

    const totals = [];

    rowsAll.forEach(r => {
      const T1 = computeT1Safe(r);
      const T2 = computeT2Safe(r);
      const TOT = computeTotalSafe(r);

      r.T1 = T1;
      r.T2 = T2;
      r.TOTAL = TOT;

      if (TOT != null) {
        totals.push(TOT);
        if (stats.maxNote == null || TOT > stats.maxNote) stats.maxNote = TOT;
        if (stats.minNote == null || TOT < stats.minNote) stats.minNote = TOT;

        if (TOT >= 80) stats.repartition['>= 80']++;
        else if (TOT >= 60) stats.repartition['60-79']++;
        else if (TOT >= 40) stats.repartition['40-59']++;
        else stats.repartition['< 40']++;
      }
    });

    if (totals.length > 0) {
      const sum = totals.reduce((acc, n) => acc + n, 0);
      stats.moyenneGlobale = +(sum / totals.length).toFixed(2);
    }

    // =======================
    //   CRÉATION WORKBOOK
    // =======================
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Système de Gestion Scolaire';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ========== ONGLET 1 : DASHBOARD ==========
    const dash = workbook.addWorksheet('Dashboard Notes', {
      views: [{ showGridLines: false }],
    });

    dash.mergeCells('A1:F2');
    const title = dash.getCell('A1');
    title.value = '📚 RÉCAPITULATIF DES NOTES';
    title.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E86AB' },
    };

    dash.mergeCells('A3:F3');
    const info = dash.getCell('A3');
    info.value = `Année scolaire: ${schoolYear} • Prof: ${req.user?.name || ''}`;
    info.font = { size: 13, bold: true };
    info.alignment = { horizontal: 'center', vertical: 'middle' };
    info.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F4F8' },
    };

    dash.addRow([]);

    const kpiRowIndex = 5;
    const kpis = [
      { label: 'ÉLÈVES', value: stats.nbEleves, icon: '👥', color: 'FF4A90E2' },
      { label: 'COURS', value: stats.nbCours, icon: '📘', color: 'FF50C878' },
      { label: 'LIGNES', value: stats.nbLignes, icon: '📄', color: 'FF9B59B6' },
      { label: 'MOYENNE', value: stats.moyenneGlobale ?? '-', icon: '📊', color: 'FF34C759' },
      { label: 'MAX', value: stats.maxNote ?? '-', icon: '🏅', color: 'FFFFC107' },
      { label: 'MIN', value: stats.minNote ?? '-', icon: '⚠️', color: 'FFFF3B30' },
    ];

    kpis.forEach((kpi, idx) => {
      const col = String.fromCharCode(65 + idx); // A,B,C...
      const iconCell = dash.getCell(`${col}${kpiRowIndex}`);
      iconCell.value = kpi.icon;
      iconCell.font = { size: 22 };
      iconCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const valueCell = dash.getCell(`${col}${kpiRowIndex + 1}`);
      valueCell.value = kpi.value;
      valueCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: kpi.color },
      };

      const labelCell = dash.getCell(`${col}${kpiRowIndex + 2}`);
      labelCell.value = kpi.label;
      labelCell.font = { size: 10, bold: true };
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' },
      };

      dash.getColumn(col).width = 14;
    });

    dash.getRow(kpiRowIndex).height = 28;
    dash.getRow(kpiRowIndex + 1).height = 35;
    dash.getRow(kpiRowIndex + 2).height = 22;

    // Répartition des notes
    const repRowStart = kpiRowIndex + 4;
    dash.mergeCells(`A${repRowStart}:F${repRowStart}`);
    const repTitle = dash.getCell(`A${repRowStart}`);
    repTitle.value = '📈 RÉPARTITION DES NOTES (TOTAL)';
    repTitle.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    repTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    repTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5856D6' },
    };

    const repData = [
      { label: '>= 80', value: stats.repartition['>= 80'], color: 'FF2ECC71' },
      { label: '60 - 79', value: stats.repartition['60-79'], color: 'FF27AE60' },
      { label: '40 - 59', value: stats.repartition['40-59'], color: 'FFF1C40F' },
      { label: '< 40', value: stats.repartition['< 40'], color: 'FFE74C3C' },
    ];

    repData.forEach((r, idx) => {
      const rowIdx = repRowStart + idx + 1;
      dash.mergeCells(`A${rowIdx}:C${rowIdx}`);
      const labelCell = dash.getCell(`A${rowIdx}`);
      labelCell.value = r.label;
      labelCell.font = { size: 12, bold: true };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9F9F9' },
      };

      dash.mergeCells(`D${rowIdx}:F${rowIdx}`);
      const valueCell = dash.getCell(`D${rowIdx}`);
      valueCell.value = r.value;
      valueCell.font = { size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: r.color },
      };

      dash.getRow(rowIdx).height = 22;
    });

    // ========== ONGLET 2 : RÉCAP DÉTAILLÉ ==========
    const recap = workbook.addWorksheet('Recap Détail', {
      views: [{ state: 'frozen', xSplit: 6, ySplit: 1 }],
    });

    const headerRow = recap.addRow([
      'N°',
      'Classe',
      'Cours',
      'ID élève',
      'Nom élève',
      'Genre',
      'P1',
      'P2',
      'EX1',
      'T1',
      'P3',
      'P4',
      'EX2',
      'T2',
      'TOTAL',
    ]);

    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2C3E50' },
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } },
      };
    });
    recap.getRow(1).height = 30;

    recap.getColumn(1).width = 5;   // N°
    recap.getColumn(2).width = 18;  // Classe
    recap.getColumn(3).width = 22;  // Cours
    recap.getColumn(4).width = 12;  // ID élève
    recap.getColumn(5).width = 28;  // Nom élève
    recap.getColumn(6).width = 8;   // Genre
    for (let i = 7; i <= 15; i++) {
      recap.getColumn(i).width = 8;
    }

    rowsAll.forEach((r, index) => {
      const row = recap.addRow([
        index + 1,
        r.className || '',
        r.subjectName || '',
        r.studentId,
        r.fullName || '',
        r.gender || '',
        r.P1 ?? '',
        r.P2 ?? '',
        r.EX1 ?? '',
        r.T1 ?? '',
        r.P3 ?? '',
        r.P4 ?? '',
        r.EX2 ?? '',
        r.T2 ?? '',
        r.TOTAL ?? '',
      ]);

      row.height = 20;

      // Alternance
      const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA';

      row.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };

      // Mise en évidence TOTAL
      const totalCell = row.getCell(15);
      const totalVal = Number(r.TOTAL);
      if (!isNaN(totalVal)) {
        if (totalVal >= 80) {
          totalCell.font = { color: { argb: 'FF006100' }, bold: true };
        } else if (totalVal >= 60) {
          totalCell.font = { color: { argb: 'FF9C6500' }, bold: true };
        } else {
          totalCell.font = { color: { argb: 'FF9C0006' }, bold: true };
        }
      }
    });

    // ========== ONGLET 3 : STAT PAR COURS ==========
    const byCourseSheet = workbook.addWorksheet('Stats par Cours');

    const byCourseHeader = byCourseSheet.addRow([
      'Cours',
      'Classe',
      'Nombre de lignes',
      'Moyenne',
      'Max',
      'Min',
    ]);
    byCourseHeader.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF34495E' },
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } },
      };
    });
    byCourseSheet.getRow(1).height = 28;

    byCourseSheet.getColumn(1).width = 25;
    byCourseSheet.getColumn(2).width = 18;
    byCourseSheet.getColumn(3).width = 15;
    byCourseSheet.getColumn(4).width = 12;
    byCourseSheet.getColumn(5).width = 12;
    byCourseSheet.getColumn(6).width = 12;

    // Groupement par cours
    const courseStatsMap = new Map();
    rowsAll.forEach(r => {
      const key = `${r.courseId}`;
      if (!courseStatsMap.has(key)) {
        courseStatsMap.set(key, {
          courseId: r.courseId,
          subjectName: r.subjectName,
          className: r.className,
          lines: [],
        });
      }
      courseStatsMap.get(key).lines.push(r);
    });

    let idxCourse = 0;
    courseStatsMap.forEach(cs => {
      idxCourse++;
      const totalsCourse = cs.lines
        .map(l => l.TOTAL)
        .filter(v => v != null);

      let avg = null, max = null, min = null;
      if (totalsCourse.length) {
        const sum = totalsCourse.reduce((a, n) => a + n, 0);
        avg = +(sum / totalsCourse.length).toFixed(2);
        max = Math.max(...totalsCourse);
        min = Math.min(...totalsCourse);
      }

      const row = byCourseSheet.addRow([
        cs.subjectName,
        cs.className,
        cs.lines.length,
        avg ?? '',
        max ?? '',
        min ?? '',
      ]);

      const color = idxCourse % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA';
      row.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // ========== ONGLET 4 : LÉGENDE ==========
    const legend = workbook.addWorksheet('Légende', {
      views: [{ showGridLines: false }],
    });

    legend.mergeCells('A1:D1');
    const lTitle = legend.getCell('A1');
    lTitle.value = 'LÉGENDE ET LECTURE DU RÉCAP NOTES';
    lTitle.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    lTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    lTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16A085' },
    };
    legend.getRow(1).height = 35;

    legend.addRow([]);
    legend.addRow(['Colonne', 'Signification', '', '']);
    legend.getRow(3).font = { bold: true };
    legend.getRow(3).height = 24;

    const legendColumns = [
      ['P1 / P2 / P3 / P4', 'Points des périodes'],
      ['EX1 / EX2', 'Points des examens'],
      ['T1', 'Total / moyenne du 1er semestre (selon ta règle)'],
      ['T2', 'Total / moyenne du 2ème semestre (selon ta règle)'],
      ['TOTAL', 'Total général ou moyenne annuelle du cours'],
    ];

    legendColumns.forEach(item => {
      const row = legend.addRow([item[0], item[1], '', '']);
      row.height = 22;
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      });
    });

    legend.getColumn(1).width = 22;
    legend.getColumn(2).width = 60;
    legend.getColumn(3).width = 5;
    legend.getColumn(4).width = 5;

    legend.addRow([]);
    legend.addRow([]);
    legend.mergeCells('A' + legend.rowCount + ':D' + legend.rowCount);
    const instrTitle = legend.getCell('A' + legend.rowCount);
    instrTitle.value = '📋 CONSEILS D\'UTILISATION';
    instrTitle.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    instrTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    instrTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3498DB' },
    };
    legend.getRow(legend.rowCount).height = 28;

    const instructions = [
      'Utilisez "Dashboard Notes" pour une vue synthétique (KPI, répartition des notes).',
      '"Recap Détail" pour les notes complètes par élève et par cours.',
      '"Stats par Cours" pour comparer les moyennes, max et min entre cours.',
      'La colonne TOTAL est mise en couleur selon le niveau (vert, orange, rouge).',
    ];

    instructions.forEach(text => {
      legend.addRow([]);
      legend.mergeCells('A' + legend.rowCount + ':D' + legend.rowCount);
      const cell = legend.getCell('A' + legend.rowCount);
      cell.value = text;
      cell.font = { size: 11 };
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      legend.getRow(legend.rowCount).height = 20;
    });

    // ========= ENVOI =========
    const fileName = 'recap_notes.xlsx';

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="' + fileName + '"'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du fichier Excel.',
    });
  }
};

// POST /teachers/me/grades/recap-edit
// body: { classId, courseId, grades: [{ studentId, P1, P2, EX1, P3, P4, EX2 }] }
exports.saveRecapGrades = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();

    const { classId, courseId, grades } = req.body;

    if (!classId || !courseId || !Array.isArray(grades)) {
      return res.status(400).json({
        success: false,
        message: 'classId, courseId et grades sont requis.',
      });
    }

    const course = await TeacherCourse.findOne({
      _id: courseId,
      teacher: teacherId,
      classId: classId,
      schoolYear,
    }).lean();

    if (!course) {
      return res.status(403).json({
        success: false,
        message: 'Cours introuvable ou non attribué à cet enseignant.',
      });
    }

    const periodsMap = {
      P1: 'P1',
      P2: 'P2',
      EX1: 'EX1',
      P3: 'P3',
      P4: 'P4',
      EX2: 'EX2',
    };

    const bulkOps = [];

    grades.forEach(g => {
      const studentId = g.studentId;
      if (!studentId) return;

      Object.keys(periodsMap).forEach(col => {
        const valueRaw = g[col];
        const period = periodsMap[col];

        if (valueRaw === '' || valueRaw === null || typeof valueRaw === 'undefined') {
          bulkOps.push({
            deleteOne: {
              filter: {
                teacher: teacherId,
                student: studentId,
                classId,
                courseId,
                subjectId: course.subjectId,
                period,
                schoolYear,
              },
            },
          });
          return;
        }

        const value = Number(valueRaw);
        if (Number.isNaN(value)) return;

        bulkOps.push({
          updateOne: {
            filter: {
              teacher: teacherId,
              student: studentId,
              classId,
              courseId,
              subjectId: course.subjectId,
              period,
              schoolYear,
            },
            update: {
              $set: { value },
            },
            upsert: true,
          },
        });
      });
    });

    if (!bulkOps.length) {
      return res.json({
        success: true,
        message: 'Aucune modification à enregistrer.',
      });
    }

    await StudentGrade.bulkWrite(bulkOps);

    return res.json({
      success: true,
      message: 'Notes du récapitulatif enregistrées avec succès.',
    });
  } catch (err) {
    next(err);
  }
};

// =====================
// GET /api/teachers/me/attendance-recap?classId=&from=&to=&month=
// =====================

// =====================
// GET /api/teachers/me/attendance-recap?classId=&from=&to=&month=
// =====================

// =====================
// GET /api/teachers/me/attendance-recap?classId=&from=&to=&month=
// =====================

exports.getAttendanceRecap = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, from, to, month } = req.query;

    if (!classId || !from || !to) {
      return res.status(400).json({
        success: false,
        message: 'classId, from et to sont requis.',
      });
    }

    await ensureTitularForClass(req, classId);

    const fromDate = new Date(from);
    const toDate = new Date(to);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    let monthFilter = null;
    if (month) {
      const m = parseInt(month, 10);
      if (!Number.isNaN(m) && m >= 1 && m <= 12) {
        monthFilter = m;
      }
    }

    // Jours de cours EPST dans l’intervalle
    const workingDays = schoolCalendar.getSchoolDaysBetween(fromDate, toDate);
    const workingDaysSet = new Set(workingDays);

    const eleves = await Eleve.find({
      classe: classId,
      anneeScolaire: schoolYear,
    })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    if (!eleves.length) {
      return res.json({
        success: true,
        rows: [],
        meta: {
          workingDaysCount: workingDays.length,
        },
      });
    }

    const studentIds = eleves.map((e) => String(e._id || e.id));

    const attFilter = {
      teacher: teacherId,
      classId,
      schoolYear,
      student: { $in: studentIds },
      date: {
        $gte: fromDate,
        $lte: toDate,
      },
    };

    const attendances = await Attendance.find(attFilter)
      .select('student date present absent late')
      .lean();

    // Agrégation par élève ET par jour
    // Map studentId -> Map(dateISO -> { present, absent, late })
    const byStudentPerDate = new Map();

    attendances.forEach((a) => {
      const sid = String(a.student);
      const d = new Date(a.date);
      const iso = schoolCalendar.toISODate(d);

      if (monthFilter && d.getMonth() + 1 !== monthFilter) return;
      if (!workingDaysSet.has(iso)) return; // on ne compte que les jours de cours EPST

      if (!byStudentPerDate.has(sid)) {
        byStudentPerDate.set(sid, new Map());
      }
      const perDate = byStudentPerDate.get(sid);

      if (!perDate.has(iso)) {
        perDate.set(iso, { present: false, absent: false, late: false });
      }
      const flags = perDate.get(iso);

      if (a.present) flags.present = true;
      if (a.absent) flags.absent = true;
      if (a.late) flags.late = true;
    });

    const rows = eleves.map((el) => {
      const sid = String(el._id || el.id);
      const perDate = byStudentPerDate.get(sid) || new Map();

      let presenceDays = 0;
      let absenceDays = 0;
      let lateDays = 0;

      perDate.forEach((flags) => {
        if (flags.present) presenceDays += 1;
        if (flags.absent) absenceDays += 1;
        if (flags.late) lateDays += 1;
      });

      const workingDaysCount = workingDays.length;
      const attendanceRate =
        workingDaysCount > 0 ? presenceDays / workingDaysCount : 0;

      return {
        studentId: sid,
        fullName: `${el.nom} ${el.prenom}`.trim(),
        gender: el.sexe || '',
        presenceDays,
        absenceDays,
        lateDays,
        workingDays: workingDaysCount,
        attendanceRate, // fraction 0–1
      };
    });

    return res.json({
      success: true,
      rows,
      meta: {
        workingDaysCount: workingDays.length,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
};


// =====================
// GET /api/teachers/me/attendance-recap-export-xlsx?classId=&from=&to=&month=
// =====================

exports.exportAttendanceRecapXlsx = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, from, to, month } = req.query;

    if (!classId || !from || !to) {
      return res.status(400).json({
        success: false,
        message: 'classId, from et to sont requis pour exporter.',
      });
    }

    const classe = await ensureTitularForClass(req, classId);
    const classLabel =
      classe.nomClasse || classe.nom || classe.name || classe.niveau || 'Classe';

    const fromDate = new Date(from);
    const toDate = new Date(to);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    let monthFilter = null;
    if (month) {
      const m = parseInt(month, 10);
      if (!Number.isNaN(m) && m >= 1 && m <= 12) {
        monthFilter = m;
      }
    }

    const workingDays = schoolCalendar.getSchoolDaysBetween(fromDate, toDate);
    const workingDaysSet = new Set(workingDays);

    const eleves = await Eleve.find({
      classe: classId,
      anneeScolaire: schoolYear,
    })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    if (!eleves.length) {
      return res.status(400).json({
        success: false,
        message: 'Aucun élève trouvé pour cette classe / période.',
      });
    }

    const studentIds = eleves.map((e) => String(e._id || e.id));

    const attFilter = {
      teacher: teacherId,
      classId,
      schoolYear,
      student: { $in: studentIds },
      date: {
        $gte: fromDate,
        $lte: toDate,
      },
    };

    const attendances = await Attendance.find(attFilter)
      .select('student date present absent late')
      .lean();

    const byStudentPerDate = new Map();

    attendances.forEach((a) => {
      const sid = String(a.student);
      const d = new Date(a.date);
      const iso = schoolCalendar.toISODate(d); // "YYYY-MM-DD"

      if (monthFilter && d.getMonth() + 1 !== monthFilter) return;
      if (!workingDaysSet.has(iso)) return;

      if (!byStudentPerDate.has(sid)) {
        byStudentPerDate.set(sid, new Map());
      }
      const perDate = byStudentPerDate.get(sid);

      if (!perDate.has(iso)) {
        perDate.set(iso, { present: false, absent: false, late: false });
      }
      const flags = perDate.get(iso);

      if (a.present) flags.present = true;
      if (a.absent) flags.absent = true;
      if (a.late) flags.late = true;
    });

    const workingDaysCount = workingDays.length;

    // Préparation des stats par élève
    const recapEleves = eleves.map((el, index) => {
      const sid = String(el._id || el.id);
      const perDate = byStudentPerDate.get(sid) || new Map();

      let presenceDays = 0;
      let absenceDays = 0;
      let lateDays = 0;

      perDate.forEach((flags) => {
        if (flags.present) presenceDays += 1;
        if (flags.absent) absenceDays += 1;
        if (flags.late) lateDays += 1;
      });

      const attendanceRate =
        workingDaysCount > 0 ? (presenceDays / workingDaysCount) * 100 : null;

      return {
        index: index + 1,
        classLabel,
        studentId: sid,
        fullName: `${el.nom} ${el.prenom}`.trim(),
        gender: el.sexe || '',
        workingDays: workingDaysCount,
        presenceDays,
        absenceDays,
        lateDays,
        attendanceRate,
      };
    });

    // KPI globaux
    const totalStudents = recapEleves.length;
    const totalPresence = recapEleves.reduce((acc, r) => acc + r.presenceDays, 0);
    const totalAbsence = recapEleves.reduce((acc, r) => acc + r.absenceDays, 0);
    const totalLate = recapEleves.reduce((acc, r) => acc + r.lateDays, 0);
    const maxPresence = Math.max(...recapEleves.map(r => r.attendanceRate || 0), 0);
    const minPresence = Math.min(
      ...recapEleves.map(r => (r.attendanceRate != null ? r.attendanceRate : 100)),
      100
    );
    const avgPresence =
      totalStudents > 0
        ? (
            recapEleves.reduce(
              (acc, r) => acc + (r.attendanceRate || 0),
              0
            ) / totalStudents
          ).toFixed(1)
        : null;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gabkut Schola';
    workbook.lastModifiedBy = 'Récap Présences';
    const now = new Date();
    workbook.created = now;
    workbook.modified = now;

    const titleFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF111827' },
    };
    const headerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    const borderThin = {
      top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
    };
    const periodLabel = `du ${fromDate.toLocaleDateString(
      'fr-FR'
    )} au ${toDate.toLocaleDateString('fr-FR')}`;

    // ======================
    // ONGLET 1 : DASHBOARD
    // ======================
    const dash = workbook.addWorksheet('Dashboard Présences', {
      views: [{ showGridLines: false }],
    });

    dash.mergeCells('A1', 'E1');
    dash.getCell('A1').value = 'Récapitulatif des présences';
    dash.getCell('A1').font = {
      bold: true,
      size: 16,
      color: { argb: 'FFFFFFFF' },
    };
    dash.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    dash.getCell('A1').fill = titleFill;

    dash.mergeCells('A2', 'E2');
    dash.getCell('A2').value = `Classe : ${classLabel} • Période ${periodLabel}`;
    dash.getCell('A2').font = {
      bold: true,
      size: 12,
      color: { argb: 'FFFFFFFF' },
    };
    dash.getCell('A2').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    dash.getCell('A2').fill = titleFill;

    dash.getRow(1).height = 24;
    dash.getRow(2).height = 20;
    dash.addRow([]);

    const kpiRow = 4;
    const kpis = [
      { label: "Élèves", value: totalStudents, icon: "👥", color: "FF4B5563" },
      { label: "Jours de cours", value: workingDaysCount, icon: "📅", color: "FF0284C7" },
      { label: "Présences", value: totalPresence, icon: "✅", color: "FF16A34A" },
      { label: "Absences", value: totalAbsence, icon: "❌", color: "FFDC2626" },
      { label: "Retards", value: totalLate, icon: "⏰", color: "FFF97316" },
    ];

    kpis.forEach((kpi, idx) => {
      const col = String.fromCharCode(65 + idx); // A..E

      const iconCell = dash.getCell(`${col}${kpiRow}`);
      iconCell.value = kpi.icon;
      iconCell.font = { size: 20 };
      iconCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const valueCell = dash.getCell(`${col}${kpiRow + 1}`);
      valueCell.value = kpi.value;
      valueCell.font = {
        size: 14,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: kpi.color },
      };

      const labelCell = dash.getCell(`${col}${kpiRow + 2}`);
      labelCell.value = kpi.label;
      labelCell.font = { size: 10, bold: true };
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };

      dash.getColumn(col).width = 18;
    });

    dash.getRow(kpiRow).height = 26;
    dash.getRow(kpiRow + 1).height = 32;
    dash.getRow(kpiRow + 2).height = 20;

    const tauxRow = kpiRow + 4;
    dash.mergeCells(`A${tauxRow}:E${tauxRow}`);
    const tauxTitle = dash.getCell(`A${tauxRow}`);
    tauxTitle.value = "Taux de présence (classe)";
    tauxTitle.font = { size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    tauxTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    tauxTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    dash.getRow(tauxRow).height = 22;

    const tauxData = [
      { label: 'Présence moyenne', value: avgPresence ? `${avgPresence}%` : '-', color: 'FF16A34A' },
      { label: 'Présence max', value: `${maxPresence.toFixed(1)}%`, color: 'FF22C55E' },
      { label: 'Présence min', value: `${minPresence.toFixed(1)}%`, color: 'FFDC2626' },
    ];

    tauxData.forEach((item, idx) => {
      const rowIdx = tauxRow + idx + 1;
      dash.mergeCells(`A${rowIdx}:C${rowIdx}`);
      const labelCell = dash.getCell(`A${rowIdx}`);
      labelCell.value = item.label;
      labelCell.font = { size: 12, bold: true };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' },
      };

      dash.mergeCells(`D${rowIdx}:E${rowIdx}`);
      const valueCell = dash.getCell(`D${rowIdx}`);
      valueCell.value = item.value;
      valueCell.font = { size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: item.color },
      };

      dash.getRow(rowIdx).height = 22;
    });

    // ======================
    // ONGLET 2 : RÉCAP DÉTAILLÉ
    // ======================
    const sheet = workbook.addWorksheet('Récap présences', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    sheet.mergeCells('A1', 'J1');
    sheet.getCell('A1').value = 'Récapitulatif des présences';
    sheet.getCell('A1').font = {
      bold: true,
      size: 14,
      color: { argb: 'FFFFFFFF' },
    };
    sheet.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    sheet.getCell('A1').fill = titleFill;

    sheet.mergeCells('A2', 'J2');
    sheet.getCell('A2').value = `Classe : ${classLabel} • Période ${periodLabel}`;
    sheet.getCell('A2').font = {
      bold: true,
      size: 11,
      color: { argb: 'FFFFFFFF' },
    };
    sheet.getCell('A2').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    sheet.getCell('A2').fill = titleFill;

    sheet.getRow(1).height = 22;
    sheet.getRow(2).height = 18;
    sheet.addRow([]);

    sheet.columns = [
      { header: 'N°', key: 'num', width: 6 },
      { header: 'Classe', key: 'classe', width: 18 },
      { header: 'ID élève', key: 'id', width: 18 },
      { header: 'Nom élève', key: 'nom', width: 30 },
      { header: 'Genre', key: 'genre', width: 8 },
      { header: 'Jours attendus', key: 'joursAttendus', width: 16 },
      { header: 'Présents', key: 'presence', width: 12 },
      { header: 'Absents', key: 'absence', width: 12 },
      { header: 'Retards', key: 'retards', width: 12 },
      { header: '% présence', key: 'taux', width: 14 },
    ];

    const headerRow2 = sheet.getRow(4);
    headerRow2.font = { bold: true, color: { argb: 'FF111827' }, size: 11 };
    headerRow2.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow2.fill = headerFill;
    headerRow2.height = 20;
    headerRow2.eachCell((cell) => {
      cell.border = borderThin;
    });

    let iRow = 0;
    recapEleves.forEach((r) => {
      const row = sheet.addRow({
        num: r.index,
        classe: r.classLabel,
        id: r.studentId,
        nom: r.fullName,
        genre: r.gender,
        joursAttendus: r.workingDays,
        presence: r.presenceDays,
        absence: r.absenceDays,
        retards: r.lateDays,
        taux:
          r.attendanceRate === null ? '' : Number(r.attendanceRate.toFixed(1)),
      });
      iRow++;

      const bgColor = iRow % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';

      row.eachCell((cell, col) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.border = borderThin;
        cell.alignment = {
          vertical: 'middle',
          horizontal:
            col <= 5 ? (col === 1 ? 'center' : 'left') : 'right',
        };
        if (col >= 6 && col <= 9) {
          cell.numFmt = '0';
        }
        if (col === 10 && r.attendanceRate != null) {
          cell.numFmt = '0.0" %"';
        }
      });
      row.getCell(4).alignment = {
        horizontal: 'left',
        vertical: 'middle',
      };

      // Couleurs conditionnelles sur % présence
      const tauxCell = row.getCell(10);
      if (r.attendanceRate != null) {
        const t = r.attendanceRate;
        if (t >= 95) {
          tauxCell.font = { color: { argb: 'FF16A34A' }, bold: true };
        } else if (t >= 80) {
          tauxCell.font = { color: { argb: 'FF2563EB' }, bold: true };
        } else if (t >= 60) {
          tauxCell.font = { color: { argb: 'FFF97316' }, bold: true };
        } else {
          tauxCell.font = { color: { argb: 'FFDC2626' }, bold: true };
        }
      }
    });

    // ======================
    // ONGLET 3 : LÉGENDE
    // ======================
    const legend = workbook.addWorksheet('Légende', {
      views: [{ showGridLines: false }],
    });

    legend.mergeCells('A1:D1');
    const lTitle = legend.getCell('A1');
    lTitle.value = 'LÉGENDE ET LECTURE DU RÉCAP PRÉSENCES';
    lTitle.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    lTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    lTitle.fill = titleFill;
    legend.getRow(1).height = 30;

    legend.addRow([]);
    legend.addRow(['Élément', 'Description', '', '']);
    legend.getRow(3).font = { bold: true };
    legend.getRow(3).height = 22;

    const legendRows = [
      [
        'Jours attendus',
        'Nombre de jours de cours prévus dans la période choisie (calendrier scolaire).',
      ],
      [
        'Présents / Absents / Retards',
        'Nombre de jours marqués comme présent (P), absent (A) ou en retard (R) dans le journal de présence.',
      ],
      [
        '% présence',
        'Présence / Jours attendus × 100, avec couleurs selon le niveau (vert, bleu, orange, rouge).',
      ],
      [
        'Filtre mois',
        "Si un mois est spécifié, seules les présences de ce mois civil sont prises en compte.",
      ],
    ];

    legendRows.forEach((item) => {
      const row = legend.addRow([item[0], item[1], '', '']);
      row.height = 20;
      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.alignment = {
          horizontal: 'left',
          vertical: 'middle',
          wrapText: true,
        };
      });
    });

    legend.getColumn(1).width = 28;
    legend.getColumn(2).width = 70;
    legend.getColumn(3).width = 5;
    legend.getColumn(4).width = 5;

    // ======================
    // EXPORT
    // ======================
    const fileName = `recap_presences_${classLabel.replace(/\s+/g, '_')}.xlsx`;

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  } catch (err) {
    console.error('Erreur exportAttendanceRecapXlsx:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du fichier Excel.',
    });
  }
};

/**
 * GET /api/teachers/me/attendance-at-risk?classId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&month=...
 * Retourne les élèves dont absences/retards dépassent un seuil.
 */
exports.getAttendanceAtRisk = async (req, res, next) => {
  try {
    const teacherId = req.user.id; // ou un autre champ si CPE/direction
    const schoolYear = getCurrentSchoolYear();
    const { classId, from, to, month, maxAbsences = 3, maxLates = 3 } = req.query;

    if (!classId || !from || !to) {
      return res.status(400).json({
        success: false,
        message: 'classId, from et to sont requis.',
      });
    }

    await ensureTitularForClass(req, classId);

    const fromDate = new Date(from);
    const toDate = new Date(to);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    let monthFilter = null;
    if (month) {
      const m = parseInt(month, 10);
      if (!Number.isNaN(m) && m >= 1 && m <= 12) {
        monthFilter = m;
      }
    }

    const workingDays = schoolCalendar.getSchoolDaysBetween(fromDate, toDate);
    const workingDaysSet = new Set(workingDays);

    const eleves = await Eleve.find({
      classe: classId,
      anneeScolaire: schoolYear,
    })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    if (!eleves.length) {
      return res.json({
        success: true,
        students: [],
        meta: { workingDaysCount: workingDays.length },
      });
    }

    const studentIds = eleves.map(e => String(e._id || e.id));

    const attFilter = {
      teacher: teacherId,
      classId,
      schoolYear,
      student: { $in: studentIds },
      date: { $gte: fromDate, $lte: toDate },
    };

    const attendances = await Attendance.find(attFilter)
      .select('student date present absent late')
      .lean();

    // Agrégation par élève / jour (similaire à getAttendanceRecap)
    const byStudentPerDate = new Map();
    attendances.forEach(a => {
      const sid = String(a.student);
      const d = new Date(a.date);
      const iso = schoolCalendar.toISODate(d);
      if (monthFilter && d.getMonth() + 1 !== monthFilter) return;
      if (!workingDaysSet.has(iso)) return;

      if (!byStudentPerDate.has(sid)) {
        byStudentPerDate.set(sid, new Map());
      }
      const perDate = byStudentPerDate.get(sid);
      if (!perDate.has(iso)) {
        perDate.set(iso, { present: false, absent: false, late: false });
      }
      const flags = perDate.get(iso);
      if (a.present) flags.present = true;
      if (a.absent) flags.absent = true;
      if (a.late) flags.late = true;
    });

    const workingDaysCount = workingDays.length;
    const atRiskStudents = [];

    eleves.forEach(el => {
      const sid = String(el._id || el.id);
      const perDate = byStudentPerDate.get(sid) || new Map();

      let presenceDays = 0;
      let absenceDays = 0;
      let lateDays = 0;

      perDate.forEach(flags => {
        if (flags.present) presenceDays += 1;
        if (flags.absent) absenceDays += 1;
        if (flags.late) lateDays += 1;
      });

      if (absenceDays >= maxAbsences || lateDays >= maxLates) {
        atRiskStudents.push({
          studentId: sid,
          fullName: `${el.nom || ''} ${el.prenom || ''}`.trim(),
          gender: el.sexe || '',
          presenceDays,
          absenceDays,
          lateDays,
          workingDays: workingDaysCount,
        });
      }
    });

    return res.json({
      success: true,
      students: atRiskStudents,
      meta: {
        workingDaysCount,
        thresholdAbsences: Number(maxAbsences),
        thresholdLates: Number(maxLates),
      },
    });
  } catch (err) {
    console.error('getAttendanceAtRisk error', err);
    return next(err);
  }
};

/**
 * POST /api/teachers/me/monthly-attendance-actions
 * body: { classId, month, year, maxAbsences?, maxLates? }
 *
 * À partir du tableau mensuel de présences, détecte les élèves à risque
 * et déclenche automatiquement :
 *  - génération de lettres d'avertissement (contenu),
 *  - mails aux parents (si email parent dispo),
 *  - notification interne à l'enseignant titulaire.
 */
exports.triggerMonthlyAttendanceActions = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, month, year, maxAbsences = 3, maxLates = 3 } = req.body;

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (!classId || !m || !y) {
      return res.status(400).json({
        success: false,
        message: 'classId, month et year sont requis.',
      });
    }

    // Vérifie que le prof est bien titulaire de cette classe
    const classe = await ensureTitularForClass(req, classId);
    const classLabel = classe.nomClasse || classe.nom || classe.name || classe.niveau || 'Classe';

    // Bornes du mois (identiques au mensuel)
    const fromDate = new Date(y, m - 1, 1);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(y, m, 0);
    toDate.setHours(23, 59, 59, 999);

    // Jours de cours EPST
    const workingDays = schoolCalendar.getSchoolDaysBetween(fromDate, toDate);
    const workingDaysSet = new Set(workingDays);

    // Récupère les élèves de la classe
    const eleves = await Eleve.find({
      classe: classId,
      anneeScolaire: schoolYear,
    })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    if (!eleves.length) {
      return res.json({
        success: true,
        count: 0,
        students: [],
        message: 'Aucun élève dans cette classe.',
      });
    }

    const studentIds = eleves.map(e => String(e._id || e.id));

    // Présences du mois pour ces élèves
    const attFilter = {
      teacher: teacherId,
      classId,
      schoolYear,
      student: { $in: studentIds },
      date: { $gte: fromDate, $lte: toDate },
    };

    const attendances = await Attendance.find(attFilter)
      .select('student date present absent late')
      .lean();

    // Agrégation par élève/jour (comme getAttendanceRecap)
    const byStudentPerDate = new Map();
    attendances.forEach(a => {
      const sid = String(a.student);
      const d = new Date(a.date);
      const iso = schoolCalendar.toISODate(d);
      // On ne compte que les jours de cours EPST
      if (!workingDaysSet.has(iso)) return;

      if (!byStudentPerDate.has(sid)) {
        byStudentPerDate.set(sid, new Map());
      }
      const perDate = byStudentPerDate.get(sid);
      if (!perDate.has(iso)) {
        perDate.set(iso, { present: false, absent: false, late: false });
      }
      const flags = perDate.get(iso);
      if (a.present) flags.present = true;
      if (a.absent) flags.absent = true;
      if (a.late) flags.late = true;
    });

    const workingDaysCount = workingDays.length;
    const thresholdAbsences = Number(maxAbsences);
    const thresholdLates = Number(maxLates);

    // Détection des élèves à risque
    const atRisk = [];

    eleves.forEach(el => {
      const sid = String(el._id || el.id);
      const perDate = byStudentPerDate.get(sid) || new Map();

      let presenceDays = 0;
      let absenceDays = 0;
      let lateDays = 0;

      perDate.forEach(flags => {
        if (flags.present) presenceDays += 1;
        if (flags.absent) absenceDays += 1;
        if (flags.late) lateDays += 1;
      });

      if (absenceDays >= thresholdAbsences || lateDays >= thresholdLates) {
        atRisk.push({
          studentId: sid,
          fullName: `${el.nom || ''} ${el.prenom || ''}`.trim(),
          gender: el.sexe || '',
          presenceDays,
          absenceDays,
          lateDays,
          workingDays: workingDaysCount,
          parentEmail: el.emailParent || el.parentEmail || null, // à adapter à ton modèle
        });
      }
    });

    if (!atRisk.length) {
      return res.json({
        success: true,
        count: 0,
        students: [],
        message: 'Aucun élève à risque pour ce mois avec les seuils actuels.',
      });
    }

    // Pour chaque élève à risque, générer la lettre + envoyer mail aux parents
    for (const st of atRisk) {
      const payload = {
        classLabel,
        month: m,
        year: y,
        absenceDays: st.absenceDays,
        lateDays: st.lateDays,
      };

      // Génération texte/HTML (utile si tu veux garder une trace PDF plus tard)
      const letterText = warningLetterService.generateAttendanceWarningText(
        { fullName: st.fullName },
        payload
      );
      const letterHtml = warningLetterService.generateAttendanceWarningHtml(
        { fullName: st.fullName },
        payload
      );

      console.log('[triggerMonthlyAttendanceActions] Letter generated for', st.fullName);
      console.log(letterText);

      // Envoi mail parents si email dispo
      if (st.parentEmail) {
        await mailingService.sendAttendanceWarningToParents(
          { fullName: st.fullName, parentEmail: st.parentEmail },
          payload
        );
      } else {
        console.warn('[triggerMonthlyAttendanceActions] Pas de parentEmail pour', st.fullName);
      }

      // TODO: si tu veux stocker une entité Warning en DB, c'est ici :
      // await Warning.create({ ...payload, studentId: st.studentId, studentName: st.fullName, teacherId, schoolYear, type: 'ATTENDANCE' });
    }

    // Notification interne pour le titulaire
    await notificationService.notifyTeacherAttendanceWarning({
      teacherId,
      classLabel,
      month: m,
      year: y,
      count: atRisk.length,
    });

    return res.json({
      success: true,
      count: atRisk.length,
      students: atRisk.map(st => ({
        studentId: st.studentId,
        fullName: st.fullName,
        absenceDays: st.absenceDays,
        lateDays: st.lateDays,
        parentEmail: st.parentEmail,
      })),
      meta: {
        classLabel,
        month: m,
        year: y,
        workingDaysCount,
        thresholdAbsences,
        thresholdLates,
      },
    });
  } catch (err) {
    console.error('triggerMonthlyAttendanceActions error', err);
    return next(err);
  }
};

// controllers/teachers/teacherController.js



// GET /api/teachers/me/monthly-attendance
exports.getMonthlyAttendance = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, month, year } = req.query;

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    console.log('[GET monthly] query =', { classId, month: m, year: y, teacherId, schoolYear });

    if (!classId || !m || !y) {
      return res.status(400).json({
        success: false,
        message: 'classId, month et year sont requis.',
      });
    }

    // Vérifie titulaire
    await ensureTitularForClass(req, classId);

    // Bornes du mois
    const fromDate = new Date(y, m - 1, 1);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(y, m, 0);
    toDate.setHours(23, 59, 59, 999);

    console.log('[GET monthly] fromDate/toDate =', fromDate, toDate);

    // Élèves
    const studentsRaw = await Eleve.find({
      classe: classId,
      anneeScolaire: schoolYear,
    })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    const students = studentsRaw.map(e => ({
      id: String(e._id || e.id),
      fullName: `${e.nom || ''} ${e.prenom || ''}`.trim(),
      gender: e.sexe || '',
    }));

    const studentIds = students.map(s => s.id);

    console.log('[GET monthly] students count =', students.length);

    // Liste des jours de cours selon calendrier EPST
    const schoolDays = schoolCalendar.getSchoolDaysBetween(fromDate, toDate); // ["YYYY-MM-DD", ...]
    const schoolDaysSet = new Set(schoolDays);

    // Tous les jours du mois
    const days = [];
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = schoolCalendar.toISODate(new Date(y, m - 1, d)); // "YYYY-MM-DD"
      days.push({
        day: d,
        date: iso,
        isSchoolDay: schoolDaysSet.has(iso),
      });
    }

    // Présences existantes
    const attendances = await Attendance.find({
      teacher: teacherId,
      classId,
      schoolYear,
      student: { $in: studentIds },
      date: { $gte: fromDate, $lte: toDate },
    })
      .select('student date present absent late')
      .lean();

    console.log('[GET monthly] attendances raw =', attendances.length);
    if (attendances.length) {
      console.log('[GET monthly] first attendance =', attendances[0]);
    }

    const attendanceStates = attendances.map(a => {
      const iso = schoolCalendar.toISODate(new Date(a.date));
      let state = null;
      if (a.present) state = 'P';
      else if (a.absent) state = 'A';
      else if (a.late) state = 'R';

      return {
        studentId: String(a.student),
        date: iso,
        state,
      };
    });

    console.log('[GET monthly] attendanceStates sample =', attendanceStates.slice(0, 5));

    return res.json({
      success: true,
      students,
      days,
      attendance: attendanceStates,
      meta: { month: m, year: y },
    });
  } catch (err) {
    console.error('getMonthlyAttendance error', err);
    return next(err);
  }
};

// Utilitaire : normaliser "YYYY-MM-DD" en Date (version locale + safe)
function normalizeDay(iso) {
  // iso attendu: "YYYY-MM-DD"
  const parts = (iso || '').split('-');
  if (parts.length !== 3) {
    console.warn('[normalizeDay] invalid iso format:', iso);
    return null;
  }
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) {
    console.warn('[normalizeDay] invalid y/m/d:', iso);
    return null;
  }
  const date = new Date(y, m - 1, d); // local
  if (Number.isNaN(date.getTime())) {
    console.warn('[normalizeDay] NaN date for iso:', iso);
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * POST /api/teachers/me/monthly-attendance
 * body: { classId, month, year, changes: [{studentId, date:'YYYY-MM-DD', state:'P'|'A'|'R'}] }
 * => crée UNIQUEMENT les présences qui n'existent pas encore
 */
exports.createMonthlyAttendance = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, month, year, changes } = req.body;

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    console.log('[POST monthly] body =', {
      classId,
      month: m,
      year: y,
      nbChanges: Array.isArray(changes) ? changes.length : null,
      teacherId,
      schoolYear,
    });

    if (!classId || !m || !y || !Array.isArray(changes)) {
      return res.status(400).json({
        success: false,
        message: 'classId, month, year et changes sont requis.',
      });
    }

    await ensureTitularForClass(req, classId);

    const docsToInsert = [];

    for (const change of changes) {
      const { studentId, date, state } = change;
      if (!studentId || !date || !state) continue;

      const day = normalizeDay(date);
      if (!day) {
        console.warn('[POST monthly] invalid date, skipped change =', change);
        continue;
      }

      const startOfDay = new Date(day);
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('[POST monthly] change =', change, 'normalized day =', day);

      const existing = await Attendance.findOne({
        teacher: teacherId,
        classId,
        schoolYear,
        student: studentId,
        date: { $gte: startOfDay, $lte: endOfDay },
      }).lean();

      if (existing) {
        console.log('[POST monthly] already exists, skip:', existing._id);
        continue; // déjà présent => pas une création
      }

      const flags = {
        present: state === 'P',
        absent: state === 'A',
        late: state === 'R',
      };

      docsToInsert.push({
        teacher: teacherId,
        classId,
        schoolYear,
        student: studentId,
        date: day,
        present: flags.present,
        absent: flags.absent,
        late: flags.late,
      });
    }

    console.log('[POST monthly] docsToInsert length =', docsToInsert.length);

    if (docsToInsert.length) {
      await Attendance.insertMany(docsToInsert);
    }

    return res.json({
      success: true,
      inserted: docsToInsert.length,
    });
  } catch (err) {
    console.error('createMonthlyAttendance error', err);
    return next(err);
  }
};

/**
 * PUT /api/teachers/me/monthly-attendance
 * body: { classId, month, year, changes: [{studentId, date:'YYYY-MM-DD', state:'P'|'A'|'R'|null}] }
 * => met à jour ou supprime UNIQUEMENT les présences existantes
 */
exports.updateMonthlyAttendance = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, month, year, changes } = req.body;

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    console.log('[PUT monthly] body =', {
      classId,
      month: m,
      year: y,
      nbChanges: Array.isArray(changes) ? changes.length : null,
      teacherId,
      schoolYear,
    });

    if (!classId || !m || !y || !Array.isArray(changes)) {
      return res.status(400).json({
        success: false,
        message: 'classId, month, year et changes sont requis.',
      });
    }

    await ensureTitularForClass(req, classId);

    let updated = 0;
    let deleted = 0;

    for (const change of changes) {
      const { studentId, date, state } = change;
      if (!studentId || !date) continue;

      const day = normalizeDay(date);
      if (!day) {
        console.warn('[PUT monthly] invalid date, skipped change =', change);
        continue;
      }

      const startOfDay = new Date(day);
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);

      let existing = await Attendance.findOne({
        teacher: teacherId,
        classId,
        schoolYear,
        student: studentId,
        date: { $gte: startOfDay, $lte: endOfDay },
      });

      console.log('[PUT monthly] change =', change, 'day =', day, 'existing =', existing?._id);

      // S'il n'y a rien en DB => ce n'est pas du PUT (création), donc on ignore ici.
      if (!existing) continue;

      // Pas d'état => suppression
      if (!state) {
        await Attendance.deleteOne({ _id: existing._id });
        deleted++;
        continue;
      }

      const flags = {
        present: state === 'P',
        absent: state === 'A',
        late: state === 'R',
      };

      existing.present = flags.present;
      existing.absent = flags.absent;
      existing.late = flags.late;
      await existing.save();
      updated++;
    }

    console.log('[PUT monthly] updated =', updated, 'deleted =', deleted);

    return res.json({
      success: true,
      updated,
      deleted,
    });
  } catch (err) {
    console.error('updateMonthlyAttendance error', err);
    return next(err);
  }
};


exports.exportMonthlyAttendanceXlsx = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();
    const { classId, month, year } = req.query;

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (!classId || !m || !y) {
      return res.status(400).json({
        success: false,
        message: 'classId, month et year sont requis pour exporter.',
      });
    }

    // Vérifie titulaire
    const classe = await ensureTitularForClass(req, classId);
    const classLabel =
      classe.nomClasse || classe.nom || classe.name || classe.niveau || 'Classe';

    // Bornes du mois
    const fromDate = new Date(y, m - 1, 1);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(y, m, 0);
    toDate.setHours(23, 59, 59, 999);

    // Élèves de la classe
    const studentsRaw = await Eleve.find({
      classe: classId,
      anneeScolaire: schoolYear,
    })
      .sort({ nom: 1, prenom: 1 })
      .lean();

    if (!studentsRaw.length) {
      return res.status(400).json({
        success: false,
        message: 'Aucun élève trouvé pour cette classe.',
      });
    }

    const students = studentsRaw.map(e => ({
      id: String(e._id || e.id),
      fullName: `${e.nom || ''} ${e.prenom || ''}`.trim(),
      gender: e.sexe || '',
    }));
    const studentIds = students.map(s => s.id);

    // Jours de cours EPST
    const schoolDays = schoolCalendar.getSchoolDaysBetween(fromDate, toDate);
    const schoolDaysSet = new Set(schoolDays);

    // Tous les jours du mois
    const days = [];
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = schoolCalendar.toISODate(new Date(y, m - 1, d));
      days.push({
        day: d,
        date: iso,
        isSchoolDay: schoolDaysSet.has(iso),
        dayName: new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short' }),
      });
    }

    // Présences existantes
    const attendances = await Attendance.find({
      teacher: teacherId,
      classId,
      schoolYear,
      student: { $in: studentIds },
      date: { $gte: fromDate, $lte: toDate },
    })
      .select('student date present absent late')
      .lean();

    // Map (studentId, dateIso) -> 'P' | 'A' | 'R' | ''
    const stateMap = new Map();
    attendances.forEach(a => {
      const iso = schoolCalendar.toISODate(new Date(a.date));
      let state = '';
      if (a.present) state = 'P';
      else if (a.absent) state = 'A';
      else if (a.late) state = 'R';
      const key = `${String(a.student)}-${iso}`;
      stateMap.set(key, state);
    });

    // ===== CALCUL DES KPI =====
    const totalSchoolDays = schoolDays.length;
    const stats = {
      totalStudents: students.length,
      totalSchoolDays,
      presences: 0,
      absences: 0,
      retards: 0,
      tauxPresence: 0,
      tauxAbsence: 0,
      tauxRetard: 0,
    };

    students.forEach(st => {
      days.forEach(d => {
        if (!d.isSchoolDay) return;
        const key = `${st.id}-${d.date}`;
        const state = stateMap.get(key) || '';
        if (state === 'P') stats.presences++;
        else if (state === 'A') stats.absences++;
        else if (state === 'R') stats.retards++;
      });
    });

    const totalRecords = stats.presences + stats.absences + stats.retards;
    if (totalRecords > 0) {
      stats.tauxPresence = ((stats.presences / totalRecords) * 100).toFixed(2);
      stats.tauxAbsence = ((stats.absences / totalRecords) * 100).toFixed(2);
      stats.tauxRetard = ((stats.retards / totalRecords) * 100).toFixed(2);
    }

    // Statistiques par élève
    const studentStats = students.map(st => {
      let p = 0, a = 0, r = 0;
      days.forEach(d => {
        if (!d.isSchoolDay) return;
        const key = `${st.id}-${d.date}`;
        const state = stateMap.get(key) || '';
        if (state === 'P') p++;
        else if (state === 'A') a++;
        else if (state === 'R') r++;
      });
      const total = p + a + r;
      return {
        ...st,
        presences: p,
        absences: a,
        retards: r,
        tauxPresence: total > 0 ? ((p / total) * 100).toFixed(2) : '0.00',
        tauxAbsence: total > 0 ? ((a / total) * 100).toFixed(2) : '0.00',
      };
    });

    // ===== CRÉATION DU WORKBOOK =====
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Système de Gestion Scolaire';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ===== ONGLET 1: TABLEAU DE BORD (KPI) =====
    const dashboardSheet = workbook.addWorksheet('Tableau de Bord', {
      views: [{ showGridLines: false }],
    });

    // Titre principal
    dashboardSheet.mergeCells('A1:F2');
    const titleCell = dashboardSheet.getCell('A1');
    titleCell.value = `📊 RAPPORT DE PRÉSENCE MENSUEL`;
    titleCell.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E86AB' },
    };

    // Informations de classe
    dashboardSheet.mergeCells('A3:F3');
    const classInfoCell = dashboardSheet.getCell('A3');
    classInfoCell.value = `Classe: ${classLabel} • Période: ${getMonthName(m)} ${y}`;
    classInfoCell.font = { size: 14, bold: true };
    classInfoCell.alignment = { horizontal: 'center' };
    classInfoCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F4F8' },
    };

    dashboardSheet.addRow([]);

    // KPI Cards
    const kpiRow = 5;
    const kpiData = [
      { label: 'ÉLÈVES', value: stats.totalStudents, color: 'FF4A90E2', icon: '👥' },
      { label: 'JOURS DE COURS', value: totalSchoolDays, color: 'FF50C878', icon: '📅' },
      { label: 'PRÉSENCES', value: stats.presences, color: 'FF34C759', icon: '✅' },
      { label: 'ABSENCES', value: stats.absences, color: 'FFFF3B30', icon: '❌' },
      { label: 'RETARDS', value: stats.retards, color: 'FFFF9500', icon: '⏰' },
    ];

    kpiData.forEach((kpi, idx) => {
      const col = String.fromCharCode(65 + idx); // A, B, C, D, E
      
      // Icon row
      const iconCell = dashboardSheet.getCell(`${col}${kpiRow}`);
      iconCell.value = kpi.icon;
      iconCell.font = { size: 24 };
      iconCell.alignment = { horizontal: 'center', vertical: 'middle' };
      
      // Value row
      const valueCell = dashboardSheet.getCell(`${col}${kpiRow + 1}`);
      valueCell.value = kpi.value;
      valueCell.font = { size: 22, bold: true, color: { argb: 'FFFFFFFF' } };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: kpi.color },
      };
      
      // Label row
      const labelCell = dashboardSheet.getCell(`${col}${kpiRow + 2}`);
      labelCell.value = kpi.label;
      labelCell.font = { size: 10, bold: true };
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' },
      };
      
      dashboardSheet.getColumn(col).width = 18;
    });

    dashboardSheet.getRow(kpiRow).height = 30;
    dashboardSheet.getRow(kpiRow + 1).height = 40;
    dashboardSheet.getRow(kpiRow + 2).height = 25;

    // Taux de présence (avec barre de progression visuelle)
    const tauxRow = kpiRow + 4;
    dashboardSheet.mergeCells(`A${tauxRow}:E${tauxRow}`);
    const tauxHeaderCell = dashboardSheet.getCell(`A${tauxRow}`);
    tauxHeaderCell.value = '📈 TAUX GLOBAUX';
    tauxHeaderCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    tauxHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
    tauxHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5856D6' },
    };

    const tauxData = [
      { label: 'Taux de Présence', value: `${stats.tauxPresence}%`, color: 'FF34C759' },
      { label: 'Taux d\'Absence', value: `${stats.tauxAbsence}%`, color: 'FFFF3B30' },
      { label: 'Taux de Retard', value: `${stats.tauxRetard}%`, color: 'FFFF9500' },
    ];

    tauxData.forEach((taux, idx) => {
      const row = tauxRow + idx + 1;
      
      dashboardSheet.mergeCells(`A${row}:C${row}`);
      const labelCell = dashboardSheet.getCell(`A${row}`);
      labelCell.value = taux.label;
      labelCell.font = { size: 12, bold: true };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9F9F9' },
      };
      
      dashboardSheet.mergeCells(`D${row}:E${row}`);
      const valueCell = dashboardSheet.getCell(`D${row}`);
      valueCell.value = taux.value;
      valueCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: taux.color },
      };
      
      dashboardSheet.getRow(row).height = 25;
    });

    // ===== ONGLET 2: PRÉSENCES DÉTAILLÉES =====
    const detailSheet = workbook.addWorksheet('Présences Détaillées');

    // En-têtes fixes
    const headerRow = detailSheet.addRow(['N°', 'Nom complet', 'Genre']);
    
    // Colonnes de jours
    days.forEach(d => {
      headerRow.getCell(headerRow.cellCount + 1).value = `${d.day}\n${d.dayName}`;
    });

    // Style de l'en-tête
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2C3E50' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });

    detailSheet.getRow(1).height = 35;

    // Largeurs de colonnes
    detailSheet.getColumn(1).width = 5;
    detailSheet.getColumn(2).width = 30;
    detailSheet.getColumn(3).width = 8;
    for (let i = 4; i <= days.length + 3; i++) {
      detailSheet.getColumn(i).width = 4;
    }

    // Données élèves
    students.forEach((st, index) => {
      const row = detailSheet.addRow([index + 1, st.fullName, st.gender]);

      days.forEach((d, dayIndex) => {
        const cell = row.getCell(dayIndex + 4);
        
        if (!d.isSchoolDay) {
          cell.value = '';
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' },
          };
        } else {
          const key = `${st.id}-${d.date}`;
          const state = stateMap.get(key) || '';
          cell.value = state;

          // Couleurs conditionnelles
          if (state === 'P') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFC6EFCE' },
            };
            cell.font = { color: { argb: 'FF006100' }, bold: true };
          } else if (state === 'A') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFC7CE' },
            };
            cell.font = { color: { argb: 'FF9C0006' }, bold: true };
          } else if (state === 'R') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFEB9C' },
            };
            cell.font = { color: { argb: 'FF9C6500' }, bold: true };
          } else {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' },
            };
          }
        }

        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        };
      });

      // Style pour les 3 premières colonnes
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      
      row.eachCell({ includeEmpty: true }, cell => {
        if (!cell.border) {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          };
        }
      });

      row.height = 20;
    });

    // ===== ONGLET 3: STATISTIQUES PAR ÉLÈVE =====
    const statsSheet = workbook.addWorksheet('Statistiques par Élève');

    // En-tête
    const statsHeaderRow = statsSheet.addRow([
      'N°',
      'Nom complet',
      'Genre',
      'Présences',
      'Absences',
      'Retards',
      'Taux Présence',
      'Taux Absence',
    ]);

    statsHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF34495E' },
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } },
      };
    });

    statsSheet.getRow(1).height = 30;
    statsSheet.getColumn(1).width = 5;
    statsSheet.getColumn(2).width = 30;
    statsSheet.getColumn(3).width = 8;
    statsSheet.getColumn(4).width = 12;
    statsSheet.getColumn(5).width = 12;
    statsSheet.getColumn(6).width = 12;
    statsSheet.getColumn(7).width = 15;
    statsSheet.getColumn(8).width = 15;

    // Données
    studentStats.forEach((st, index) => {
      const row = statsSheet.addRow([
        index + 1,
        st.fullName,
        st.gender,
        st.presences,
        st.absences,
        st.retards,
        `${st.tauxPresence}%`,
        `${st.tauxAbsence}%`,
      ]);

      row.height = 22;

      // Alternance de couleurs
      const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA';
      
      row.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

      // Couleurs conditionnelles pour les taux
      const tauxPresenceCell = row.getCell(7);
      const tauxPresenceValue = parseFloat(st.tauxPresence);
      if (tauxPresenceValue >= 90) {
        tauxPresenceCell.font = { color: { argb: 'FF006100' }, bold: true };
      } else if (tauxPresenceValue >= 75) {
        tauxPresenceCell.font = { color: { argb: 'FF9C6500' }, bold: true };
      } else {
        tauxPresenceCell.font = { color: { argb: 'FF9C0006' }, bold: true };
      }

      const tauxAbsenceCell = row.getCell(8);
      const tauxAbsenceValue = parseFloat(st.tauxAbsence);
      if (tauxAbsenceValue > 25) {
        tauxAbsenceCell.font = { color: { argb: 'FF9C0006' }, bold: true };
      }
    });

    // ===== ONGLET 4: LÉGENDE =====
    const legendSheet = workbook.addWorksheet('Légende');
    legendSheet.views = [{ showGridLines: false }];

    legendSheet.mergeCells('A1:D1');
    const legendTitleCell = legendSheet.getCell('A1');
    legendTitleCell.value = 'LÉGENDE ET INSTRUCTIONS';
    legendTitleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    legendTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    legendTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16A085' },
    };
    legendSheet.getRow(1).height = 40;

    legendSheet.addRow([]);

    const legendItems = [
      { symbol: 'P', meaning: 'Présent(e)', color: 'FFC6EFCE' },
      { symbol: 'A', meaning: 'Absent(e)', color: 'FFFFC7CE' },
      { symbol: 'R', meaning: 'Retard', color: 'FFFFEB9C' },
      { symbol: '', meaning: 'Jour non scolaire (weekend/férié)', color: 'FFD3D3D3' },
      { symbol: '', meaning: 'Non renseigné', color: 'FFFFFFFF' },
    ];

    legendSheet.addRow(['Symbole', 'Signification', 'Couleur', '']);
    legendSheet.getRow(3).font = { bold: true };
    legendSheet.getRow(3).height = 25;

    legendItems.forEach((item, idx) => {
      const row = legendSheet.addRow([item.symbol, item.meaning, '', '']);
      row.height = 25;
      
      row.getCell(3).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: item.color },
      };
      
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    });

    legendSheet.getColumn(1).width = 12;
    legendSheet.getColumn(2).width = 40;
    legendSheet.getColumn(3).width = 15;
    legendSheet.getColumn(4).width = 5;

    // Instructions supplémentaires
    legendSheet.addRow([]);
    legendSheet.addRow([]);
    
    legendSheet.mergeCells('A' + (legendSheet.rowCount + 1) + ':D' + (legendSheet.rowCount + 1));
    const instructionsCell = legendSheet.getCell('A' + legendSheet.rowCount);
    instructionsCell.value = '📋 INSTRUCTIONS D\'UTILISATION';
    instructionsCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    instructionsCell.alignment = { horizontal: 'center', vertical: 'middle' };
    instructionsCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3498DB' },
    };
    legendSheet.getRow(legendSheet.rowCount).height = 30;

    const instructions = [
      '• Tableau de Bord: Vue d\'ensemble avec KPI et statistiques globales',
      '• Présences Détaillées: Suivi quotidien de chaque élève',
      '• Statistiques par Élève: Analyse individuelle des présences/absences',
      '• Les jours grisés correspondent aux weekends et jours fériés',
      '• Les cellules vides indiquent que la présence n\'a pas été renseignée',
    ];

    instructions.forEach(instruction => {
      legendSheet.addRow([]);
      legendSheet.mergeCells('A' + legendSheet.rowCount + ':D' + legendSheet.rowCount);
      const cell = legendSheet.getCell('A' + legendSheet.rowCount);
      cell.value = instruction;
      cell.font = { size: 11 };
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      legendSheet.getRow(legendSheet.rowCount).height = 20;
    });

    // ===== GÉNÉRATION DU FICHIER =====
    const fileName = `presence_mensuelle_${classLabel}_${y}-${String(m).padStart(2, '0')}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  } catch (err) {
    console.error('exportMonthlyAttendanceXlsx error', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du fichier Excel mensuel.',
    });
  }
};

// Fonction utilitaire pour obtenir le nom du mois
function getMonthName(month) {
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return months[month - 1] || '';
}







module.exports = exports;
