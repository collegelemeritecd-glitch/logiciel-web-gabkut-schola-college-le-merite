// services/notificationService.js

// TODO: si tu veux les stocker, définis un modèle Notification et remplace les console.log

/**
 * Crée une notification générique (en DB ou ailleurs).
 */
async function createNotification({ userId, type, title, message, meta = {} }) {
  if (!userId) {
    console.warn('[notificationService] createNotification sans userId, ignoré.');
    return;
  }

  // Ici tu peux remplacer par un insert MongoDB (Notification.create({...}))
  console.log('[notificationService] NEW NOTIFICATION', {
    userId,
    type,
    title,
    message,
    meta,
  });

  return true;
}

/**
 * Notification à l'enseignant titulaire qu'une action d'avertissement a été générée.
 */
async function notifyTeacherAttendanceWarning({ teacherId, classLabel, month, year, count }) {
  const title = 'Avertissements d’assiduité générés';
  const message = `${count} élève(s) à risque détectés pour ${classLabel} en ${month}/${year}.`;
  return createNotification({
    userId: teacherId,
    type: 'ATTENDANCE_WARNING',
    title,
    message,
    meta: { classLabel, month, year, count },
  });
}

/**
 * Notification à la direction / CPE (si tu ajoutes ces rôles plus tard).
 */
async function notifyDirectionAttendanceWarning({ directionUserId, classLabel, month, year, count }) {
  const title = 'Suivi assiduité - élèves à risque';
  const message = `${count} élève(s) à risque en ${classLabel} pour ${month}/${year}.`;
  return createNotification({
    userId: directionUserId,
    type: 'ATTENDANCE_WARNING_DIRECTION',
    title,
    message,
    meta: { classLabel, month, year, count },
  });
}

module.exports = {
  createNotification,
  notifyTeacherAttendanceWarning,
  notifyDirectionAttendanceWarning,
};
