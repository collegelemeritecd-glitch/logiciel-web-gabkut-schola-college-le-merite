// services/teacherHomeroom.service.ts
import { TeacherClass } from "../models/TeacherClass.model"; // ou ton modèle qui stocke les titulaires

export async function getTeacherHomeroomClasses(teacherId: string, schoolYear: string) {
  const links = await TeacherClass.find({ teacher: teacherId, schoolYear });
  // on renvoie un tableau d'objets { classId, className } ou seulement les IDs
  return links.map(l => ({
    classId: l.classId.toString(),
    className: l.className,
  }));
}
