// controllers/admin/adminUploadController.js
exports.handleUpload = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Aucun fichier fourni.' });
  }

  const filePath = `/uploads/images/${req.file.filename}`;

  res.status(201).json({
    message: 'Fichier uploadé avec succès.',
    fileUrl: filePath,
  });
};
