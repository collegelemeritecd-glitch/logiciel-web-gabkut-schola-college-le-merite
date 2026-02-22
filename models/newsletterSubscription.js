const mongoose = require('mongoose');

const newsletterSubscriptionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'newsletter_subscriptions',
  }
);

module.exports = mongoose.model('NewsletterSubscription', newsletterSubscriptionSchema);
