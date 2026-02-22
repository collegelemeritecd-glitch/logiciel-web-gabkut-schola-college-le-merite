// services/teacherCourseClassService.js
const TeacherCourse = require('../models/TeacherCourse'); // adapte le chemin

/**
 * Regroupe les cours par classId pour une année scolaire / un prof / une école, etc.
 * @param {Object} params
 * @param {String} params.schoolYear
 * @param {String} [params.teacherId]
 * @param {String} [params.schoolId]
 * @returns {Promise<Array>} classesWithCourses
 */
async function getClassesWithCoursesByClassId({ schoolYear, teacherId, schoolId }) {
  const filter = { schoolYear };

  if (teacherId) {
    filter.teacher = teacherId;
  }
  if (schoolId) {
    filter.schoolId = schoolId;
  }

  const courses = await TeacherCourse.find(filter).lean();

  const mapByClassId = new Map();

  for (const c of courses) {
    const cid = String(c.classId); // on fige en string

    if (!mapByClassId.has(cid)) {
      mapByClassId.set(cid, {
        classId: cid,
        className: c.className || null,
        optionCode: c.optionCode || null,
        optionLabel: c.optionLabel || null,
        periodsLabel: c.periodsLabel || null,
        schoolYear: c.schoolYear,
        schoolId: c.schoolId || null,
        courses: [],
      });
    }

    const entry = mapByClassId.get(cid);

    if (!entry.className && c.className) {
      entry.className = c.className;
    }

    entry.courses.push({
      _id: String(c._id),
      subjectName: c.subjectName,
      weight: c.weight,
      teacher: String(c.teacher),
    });
  }

  return Array.from(mapByClassId.values());
}

module.exports = {
  getClassesWithCoursesByClassId,
};
