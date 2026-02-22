// routes/newsletter.routes.js
const express = require('express');
const router = express.Router();
const NewsletterSubscription = require('../models/newsletterSubscription');
const { sendNewsletterConfirmation } = require('../services/mail.service');


// POST /api/newsletter  (public, sans auth)
// Body: { email: string }
router.post('/newsletter', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email requis.' });
    }

    // normaliser
    const normalizedEmail = String(email).trim().toLowerCase();

    let subscription = await NewsletterSubscription.findOne({ email: normalizedEmail });

    if (!subscription) {
      subscription = await NewsletterSubscription.create({ email: normalizedEmail });

      // on n’envoie l’email de bienvenue qu’à la première inscription
      try {
        await sendNewsletterConfirmation(normalizedEmail);
      } catch (mailErr) {
        console.error('Erreur envoi mail newsletter:', mailErr);
        // on ne bloque pas l’API pour autant
      }

      return res.status(201).json({
        message: 'Inscription à la newsletter réussie.',
        subscription,
        alreadySubscribed: false,
      });
    }

    // déjà inscrit
    return res.status(200).json({
      message: 'Cet email est déjà inscrit à la newsletter.',
      subscription,
      alreadySubscribed: true,
    });
  } catch (error) {
    console.error('Erreur POST /api/newsletter:', error);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
});


// GET /api/newsletter  (public pour l’instant – à sécuriser plus tard)
// Retourne la liste des abonnés, du plus récent au plus ancien
router.get('/newsletter', async (req, res) => {
  try {
    const subscriptions = await NewsletterSubscription
      .find({})
      .sort({ createdAt: -1 });

    return res.status(200).json(subscriptions);
  } catch (error) {
    console.error('Erreur GET /api/newsletter:', error);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
});


module.exports = router;
