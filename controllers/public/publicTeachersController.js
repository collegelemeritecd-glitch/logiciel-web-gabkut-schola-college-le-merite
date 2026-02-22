const Teacher = require('../../models/Teacher');

// GET /api/public/teachers
exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find({}).sort({ fullName: 1 });

    res.json(
      teachers.map((t) => ({
        id: t._id,
        fullName: t.fullName,
        subject: t.subject,
        category: t.category,
        bio: t.bio,
        photoUrl: t.photoUrl,
        facebook: t.facebook,
        twitter: t.twitter,
        google: t.google,
        linkedin: t.linkedin,
        email: t.email,
        phone: t.phone,
        address: t.address,
        intro: t.intro,
        summary: t.summary || [],
      }))
    );
  } catch (err) {
    console.error('Erreur getTeachers public:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/public/teachers/:id
exports.getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ message: 'Enseignant introuvable' });
    }

    res.json({
      id: teacher._id,
      fullName: teacher.fullName,
      subject: teacher.subject,
      category: teacher.category,
      bio: teacher.bio,
      photoUrl: teacher.photoUrl,
      facebook: teacher.facebook,
      twitter: teacher.twitter,
      google: teacher.google,
      linkedin: teacher.linkedin,
      email: teacher.email,
      phone: teacher.phone,
      address: teacher.address,
      intro: teacher.intro,
      summary: teacher.summary || [],
    });
  } catch (err) {
    console.error('Erreur getTeacherById public:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
