// backend/controllers/admin/adminTeachersUploadController.js

exports.uploadPhoto = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Aucun fichier fourni.' });
  }

  // Chemin public pour la photo enseignant
  const filePath = `/uploads/teachers/${req.file.filename}`;

  res.status(201).json({
    message: 'Photo uploadée avec succès.',
    fileUrl: filePath,
  });
};
