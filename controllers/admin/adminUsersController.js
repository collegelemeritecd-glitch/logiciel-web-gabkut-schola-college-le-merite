const User = require('../../models/User');

exports.getUsers = async (req, res, next) => {
  try {
    const { role } = req.query;

    console.log('👥 Admin demande liste users, role:', role || 'tous');

    const filter = {};
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      count: users.length,
      users
    });

    console.log(`✅ ${users.length} users envoyés`);
  } catch (error) {
    console.error('❌ Erreur users:', error);
    next(error);
  }
};
