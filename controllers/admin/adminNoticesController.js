const Notice = require('../../models/Notice');

// Helper de sérialisation
function serializeNotice(n) {
  if (!n) return null;
  return {
    id: n._id,
    title: n.title,
    excerpt: n.excerpt,
    content: n.content,
    date: n.date,
    published: n.published,
    imageUrl: n.imageUrl,
    videoUrl: n.videoUrl,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

// GET /api/admin/notices
exports.getNotices = async (req, res) => {
  try {
    const notices = await Notice.find({}).sort({ date: -1, createdAt: -1 });
    res.json(notices.map(serializeNotice));
  } catch (err) {
    console.error('Erreur getNotices admin:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/admin/notices/:id
exports.getNoticeById = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ message: 'Communiqué introuvable' });
    }
    res.json(serializeNotice(notice));
  } catch (err) {
    console.error('Erreur getNoticeById admin:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/admin/notices
exports.createNotice = async (req, res) => {
  try {
    const { title, excerpt, content, date, published, imageUrl, videoUrl } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        message: 'Le titre et le contenu sont obligatoires.',
      });
    }

    const notice = new Notice({
      title,
      excerpt,
      content,
      date: date ? new Date(date) : new Date(),
      published: published !== undefined ? !!published : true,
      imageUrl: imageUrl || undefined,
      videoUrl: videoUrl || undefined,
      createdBy: req.user ? req.user._id : undefined,
    });

    await notice.save();

    res.status(201).json({
      message: 'Communiqué créé avec succès.',
      notice: serializeNotice(notice),
    });
  } catch (err) {
    console.error('Erreur createNotice admin:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// PUT /api/admin/notices/:id
exports.updateNotice = async (req, res) => {
  try {
    const { title, excerpt, content, date, published, imageUrl, videoUrl } = req.body;

    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ message: 'Communiqué introuvable' });
    }

    if (title !== undefined) notice.title = title;
    if (excerpt !== undefined) notice.excerpt = excerpt;
    if (content !== undefined) notice.content = content;
    if (date !== undefined) notice.date = date ? new Date(date) : notice.date;
    if (published !== undefined) notice.published = !!published;
    if (imageUrl !== undefined) notice.imageUrl = imageUrl || undefined;
    if (videoUrl !== undefined) notice.videoUrl = videoUrl || undefined;

    await notice.save();

    res.json({
      message: 'Communiqué mis à jour avec succès.',
      notice: serializeNotice(notice),
    });
  } catch (err) {
    console.error('Erreur updateNotice admin:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// DELETE /api/admin/notices/:id
exports.deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ message: 'Communiqué introuvable' });
    }

    await notice.deleteOne();

    res.json({ message: 'Communiqué supprimé avec succès.' });
  } catch (err) {
    console.error('Erreur deleteNotice admin:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
