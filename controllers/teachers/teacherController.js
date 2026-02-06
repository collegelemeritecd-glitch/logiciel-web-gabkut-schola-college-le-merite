const XLSX = require('xlsx');
const TeacherCourse = require('../../models/TeacherCourse');
const StudentGrade = require('../../models/StudentGrade');
const Attendance = require('../../models/Attendance');
const Eleve = require('../../models/Eleve');
const Classe = require('../../models/Classe');

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

// ========== CONTROLLERS ==========

// GET /api/teachers/me/overview
// GET /api/teachers/me/overview
exports.getOverview = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();

    const todayClasses = [];

    const lastGrades = await StudentGrade.find({
      teacher: teacherId,
      schoolYear,
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('classId', 'nomClasse name') // ok
      // .populate('subjectId', 'name nomMatiere') // ❌ à retirer si pas de modèle Subject
      .lean();

    const lastGradesMapped = lastGrades.map((g) => ({
      className: g.classId?.nomClasse || g.classId?.name || '',
      subjectName: '', // ou à remplir via courseId si tu veux ajouter cette info
      period: g.period,
      date: g.updatedAt,
    }));

    const notifications = [];

    res.json({
      success: true,
      todayClasses,
      lastGrades: lastGradesMapped,
      notifications,
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

// GET /api/teachers/me/bulletins
exports.getBulletins = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const schoolYear = getCurrentSchoolYear();

    const courses = await TeacherCourse.find({
      teacher: teacherId,
      schoolYear,
    }).lean();

    const classMap = new Map();
    courses.forEach((c) => {
      classMap.set(String(c.classId), c.className);
    });

    const bulletins = [];
    classMap.forEach((className, classId) => {
      bulletins.push(
        {
          id: `${classId}-S1`,
          className,
          semesterLabel: '1er semestre',
          typeLabel: 'Bulletin partiel',
        },
        {
          id: `${classId}-S2`,
          className,
          semesterLabel: '2ème semestre',
          typeLabel: 'Bulletin global',
        }
      );
    });

    res.json({
      success: true,
      bulletins,
    });
  } catch (err) {
    next(err);
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
    const { classId, subjectId, period } = req.query;

    if (!classId || !period) {
      return res.status(400).json({
        success: false,
        message: 'classId et period sont requis pour exporter.',
      });
    }

    const students = await getStudentsAndGradesForExport(teacherId, classId, subjectId, period);

    const rows = [];
    const header = ['N°', 'Nom de l\'élève', 'Genre', 'Note'];
    rows.push(header);

    students.forEach((st, index) => {
      const num = index + 1;
      const name = st.fullName || '';
      const gender = st.gender || '';
      const grade = st.gradeValue ?? '';
      rows.push([num, name, gender, grade]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Notes');

    const fileName = `notes_${classId}_${period}.xlsx`;

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="' + fileName + '"'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return res.send(buffer);
  } catch (err) {
    console.error(err);
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
      gradeFilter.period = period; // P1, P2, EX1, P3, P4, EX2
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

    const header = [
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
    ];

    const rows = [header];

    rowsAll.forEach((r, index) => {
      const T1 = computeT1(r);
      const T2 = computeT2(r);
      const TOT = computeTotal(r);

      rows.push([
        index + 1,
        r.className || '',
        r.subjectName || '',
        r.studentId,
        r.fullName || '',
        r.gender || '',
        r.P1 ?? '',
        r.P2 ?? '',
        r.EX1 ?? '',
        T1 === null ? '' : T1,
        r.P3 ?? '',
        r.P4 ?? '',
        r.EX2 ?? '',
        T2 === null ? '' : T2,
        TOT === null ? '' : TOT,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recap notes');

    const fileName = 'recap_notes.xlsx';

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="' + fileName + '"'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
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

        // suppression si vide
        if (valueRaw === '' || valueRaw === null || typeof valueRaw === 'undefined') {
          bulkOps.push({
            deleteOne: {
              filter: {
                teacher: teacherId,
                student: studentId,
                classId,
                courseId,              // 🔴 on filtre aussi par courseId
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
              courseId,              // 🔴 on stocke le courseId
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
