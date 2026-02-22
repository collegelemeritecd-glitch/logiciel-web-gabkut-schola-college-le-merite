// services/teacherHomeroom.service.js
const TeacherCourse = require('../models/TeacherCourse');

const getTeacherHomeroomClasses = async (teacherId, schoolYear) => {
  const links = await TeacherClass.find({ teacher: teacherId, schoolYear });
  return links.map((l) => ({
    classId: l.classId.toString(),
    className: l.className,
  }));
};

module.exports = {
  getTeacherHomeroomClasses,
};
