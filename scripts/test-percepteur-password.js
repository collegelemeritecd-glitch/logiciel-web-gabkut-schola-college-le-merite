const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: 'percepteur@gabkut.com' }).lean();

    if (!user) {
      console.log('User non trouvé');
      process.exit(0);
    }

    console.log('Email:', user.email);
    console.log('Hash:', user.password);

    const ok = await bcrypt.compare('percepteur123', user.password);
    console.log('Compare("percepteur123") =>', ok);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
