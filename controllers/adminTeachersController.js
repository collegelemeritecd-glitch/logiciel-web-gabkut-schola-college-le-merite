const Teacher = require('../../models/Teacher');

function serializeTeacher(t) {
  if (!t) return null;
  return {
    id: t._id,
    fullName: t.fullName,
    subject: t.subject,
    category: t.category,
    grade: t.grade,
    photoUrl: t.photoUrl,
    email: t.email,
    phone: t.phone,
    address: t.address,
    intro: t.intro,
    bio: t.bio,
    summary: t.summary || [],
    facebook: t.facebook,
    twitter: t.twitter,
    google: t.google,
    linkedin: t.linkedin,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// GET /api/admin/teachers
exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find({}).sort({ fullName: 1 });
    res.json(teachers.map(serializeTeacher));
  } catch (err) {
    console.error('Erreur getTeachers admin:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/admin/teachers/:id
exports.getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ message: 'Enseignant introuvable' });
    }
    res.json(serializeTeacher(teacher));
  } catch (err) {
    console.error('Erreur getTeacherById admin:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/admin/teachers
exports.createTeacher = async (req, res) => {
  try {
    const {
      fullName,
      subject,
      category,
      grade,
      photoUrl,
      email,
      phone,
      address,
      intro,
      bio,
      summary,
      facebook,
      twitter,
      google,
      linkedin,
    } = req.body;

    if (!fullName || !subject) {
      return res
        .status(400)
        .json({ message: 'Le nom complet et la matière sont obligatoires.' });
    }

    const teacher = new Teacher({
      fullName,
      subject,
      category: category || null,
      grade: grade || null,
      photoUrl: photoUrl || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      intro: intro || null,
      bio: bio || null,
      summary: Array.isArray(summary)
        ? summary
        : [],
      facebook: facebook || null,
      twitter: twitter || null,
      google: google || null,
      linkedin: linkedin || null,
      createdBy: req.user ? req.user._id : undefined,
    });

    await teacher.save();

    res.status(201).json({
      message: 'Enseignant créé avec succès.',
      teacher: serializeTeacher(teacher),
    });
  } catch (err) {
    console.error('Erreur createTeacher admin:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// PUT /api/admin/teachers/:id
exports.updateTeacher = async (req, res) => {
  try {
    const {
      fullName,
      subject,
      category,
      grade,
      photoUrl,
      email,
      phone,
      address,
      intro,
      bio,
      summary,
      facebook,
      twitter,
      google,
      linkedin,
    } = req.body;

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ message: 'Enseignant introuvable' });
    }

    if (fullName !== undefined) teacher.fullName = fullName;
    if (subject !== undefined) teacher.subject = subject;
    if (category !== undefined) teacher.category = category || null;
    if (grade !== undefined) teacher.grade = grade || null;
    if (photoUrl !== undefined) teacher.photoUrl = photoUrl || null;
    if (email !== undefined) teacher.email = email || null;
    if (phone !== undefined) teacher.phone = phone || null;
    if (address !== undefined) teacher.address = address || null;
    if (intro !== undefined) teacher.intro = intro || null;
    if (bio !== undefined) teacher.bio = bio || null;
    if (summary !== undefined) {
      teacher.summary = Array.isArray(summary)
        ? summary
        : [];
    }
    if (facebook !== undefined) teacher.facebook = facebook || null;
    if (twitter !== undefined) teacher.twitter = twitter || null;
    if (google !== undefined) teacher.google = google || null;
    if (linkedin !== undefined) teacher.linkedin = linkedin || null;

    await teacher.save();

    res.json({
      message: 'Enseignant mis à jour avec succès.',
      teacher: serializeTeacher(teacher),
    });
  } catch (err) {
    console.error('Erreur updateTeacher admin:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// DELETE /api/admin/teachers/:id
exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ message: 'Enseignant introuvable' });
    }

    await teacher.deleteOne();

    res.json({ message: 'Enseignant supprimé avec succès.' });
  } catch (err) {
    console.error('Erreur deleteTeacher admin:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
