// controllers/admin/adminUsersController.js
const User = require('../../models/User');
const emailService = require('../../services/emailService');

// GET /api/admin/users?role=&status=&search=
exports.getUsers = async (req, res, next) => {
  try {
    const { role, status, search } = req.query;

    console.log('👥 Admin demande liste users, role:', role || 'tous');

    const filter = {};
    if (role) filter.role = role;
    if (status) {
      if (status === 'true' || status === 'false') {
        filter.isActive = status === 'true';
      } else {
        filter.status = status;
      }
    }

    if (search) {
      const s = search.trim().toLowerCase();
      filter.$or = [
        { fullName: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      count: users.length,
      users,
    });

    console.log(`✅ ${users.length} users envoyés`);
  } catch (error) {
    console.error('❌ Erreur users:', error);
    next(error);
  }
};

// POST /api/admin/users
exports.createUser = async (req, res, next) => {
  try {
    const { fullName, email, role, phone, isActive = true, password } = req.body;

    if (!fullName || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Nom complet, email et rôle sont obligatoires',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà',
      });
    }

    const tempPassword =
      password || Math.random().toString(36).slice(-8) + 'A1!';

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      role,
      phone,
      password: tempPassword, // hash via hook pre('save') si tu en as un
      isActive,
      status: isActive ? 'active' : 'suspended',
      mustChangePassword: true,
      isSystemAccount: false,
    });

    // Email de bienvenue
    try {
      await emailService.sendUserWelcomeEmail({
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        tempPassword,
      });
    } catch (errMail) {
      console.error('❌ Erreur envoi email bienvenue:', errMail);
    }

    res.status(201).json({
      success: true,
      message:
        "Utilisateur créé avec succès. Un email de bienvenue lui a été envoyé.",
      user: { ...user.toObject(), password: undefined },
    });
  } catch (error) {
    console.error('❌ Erreur createUser:', error);
    next(error);
  }
};

// PUT /api/admin/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      email,
      role,
      phone,
      isActive,
      status,
      password,
    } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'Utilisateur introuvable' });
    }

    if (fullName != null) user.fullName = fullName;
    if (email != null) user.email = email.toLowerCase();
    if (role != null) user.role = role;
    if (phone != null) user.phone = phone;
    if (isActive != null) user.isActive = isActive;
    if (status != null) user.status = status;

    if (password) {
      user.password = password; // hash via hook
      user.mustChangePassword = true;
    }

    // cohérence isActive / status
    if (isActive === false && !status) {
      user.status = 'suspended';
    }
    if (isActive === true && !status) {
      user.status = 'active';
    }

    await user.save();

    res.json({
      success: true,
      message: 'Utilisateur mis à jour',
      user: { ...user.toObject(), password: undefined },
    });
  } catch (error) {
    console.error('❌ Erreur updateUser:', error);
    next(error);
  }
};

// PUT /api/admin/users/:id/status  (bloquer / suspendre / révoquer)
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' | 'suspended' | 'revoked'

    if (!['active', 'suspended', 'revoked'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'Utilisateur introuvable' });
    }

    user.status = status;
    user.isActive = status === 'active';
    await user.save();

    try {
      await emailService.sendUserStatusChangedEmail({
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        newStatus: status,
      });
    } catch (errMail) {
      console.error('❌ Erreur email statut user:', errMail);
    }

    res.json({
      success: true,
      message: 'Statut utilisateur mis à jour',
    });
  } catch (error) {
    console.error('❌ Erreur updateUserStatus:', error);
    next(error);
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'Utilisateur introuvable' });
    }

    await User.findByIdAndDelete(id);

    try {
      await emailService.sendUserDeletedEmail({
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      });
    } catch (errMail) {
      console.error('❌ Erreur envoi email suppression:', errMail);
    }

    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès',
    });
  } catch (error) {
    console.error('❌ Erreur deleteUser:', error);
    next(error);
  }
};
