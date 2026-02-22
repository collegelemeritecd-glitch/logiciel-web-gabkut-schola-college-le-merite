const Notice = require('../models/Notice');

// GET /api/public/notices
exports.getNotices = async (req, res) => {
  try {
    const notices = await Notice.find({ published: true })
      .sort({ date: -1, createdAt: -1 })
      .select('_id title excerpt date imageUrl');

    res.json(
      notices.map((n) => ({
        id: n._id,
        title: n.title,
        excerpt: n.excerpt,
        date: n.date,
        imageUrl: n.imageUrl,
      }))
    );
  } catch (err) {
    console.error('Erreur getNotices public:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/public/notices/:id
exports.getNoticeById = async (req, res) => {
  try {
    const notice = await Notice.findOne({
      _id: req.params.id,
      published: true,
    });

    if (!notice) {
      return res.status(404).json({ message: 'Communiqué introuvable' });
    }

    res.json({
      id: notice._id,
      title: notice.title,
      content: notice.content,
      date: notice.date,
      imageUrl: notice.imageUrl,
      videoUrl: notice.videoUrl,
    });
  } catch (err) {
    console.error('Erreur getNoticeById public:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
