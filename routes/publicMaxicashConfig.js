// routes/publicMaxicashConfig.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch'); // utilisé pour /debug-entry si besoin

// GET /api/public/maxicash-config
router.get('/maxicash-config', (req, res) => {
  // Logs de debug pour vérifier le .env
  console.log('🔎 [MaxiCash Config] MAXICASH_ENV =', process.env.MAXICASH_ENV);
  console.log('🔎 [MaxiCash Config] MAXICASH_MERCHANT_ID =', process.env.MAXICASH_MERCHANT_ID);
  console.log('🔎 [MaxiCash Config] MAXICASH_MERCHANT_PASS =', process.env.MAXICASH_MERCHANT_PASS);
  console.log('🔎 [MaxiCash Config] PUBLIC_FRONT_BASE_URL =', process.env.PUBLIC_FRONT_BASE_URL);
  console.log('🔎 [MaxiCash Config] PUBLIC_API_BASE_URL =', process.env.PUBLIC_API_BASE_URL);

  const env = process.env.MAXICASH_ENV || 'test';

  const paymentUrl =
    env === 'live'
      ? (process.env.MAXICASH_PAYMENT_URL_LIVE ||
          'https://api.maxicashapp.com/PayEntryPost')
      : (process.env.MAXICASH_PAYMENT_URL_TEST ||
          'https://api-testbed.maxicashapp.com/PayEntryPost');

  const frontBase = process.env.PUBLIC_FRONT_BASE_URL;
  const apiBase = process.env.PUBLIC_API_BASE_URL;

  if (!process.env.MAXICASH_MERCHANT_ID || !process.env.MAXICASH_MERCHANT_PASS) {
    console.error('❌ [MaxiCash Config] Identifiants manquants');
    return res.status(500).json({
      success: false,
      message: 'Identifiants MaxiCash manquants',
    });
  }

  if (!frontBase || !apiBase) {
    console.error('❌ [MaxiCash Config] PUBLIC_FRONT_BASE_URL ou PUBLIC_API_BASE_URL manquant');
    return res.status(500).json({
      success: false,
      message: 'PUBLIC_FRONT_BASE_URL ou PUBLIC_API_BASE_URL manquant',
    });
  }

    const response = {
    success: true,
    env,
    paymentUrl,
    merchantId: process.env.MAXICASH_MERCHANT_ID,
    merchantPass: process.env.MAXICASH_MERCHANT_PASS,
    // 👉 Toutes les URLs MaxiCash doivent pointer vers le backend (apiBase)
    accepturl: `${apiBase.replace(/\/+$/, '')}/maxicash/accept`,
    declineurl: `${apiBase.replace(/\/+$/, '')}/maxicash/decline`,
    cancelurl: `${apiBase.replace(/\/+$/, '')}/maxicash/cancel`,
    notifyurl: `${apiBase.replace(/\/+$/, '')}/maxicash`,
  };


  console.log('✅ [MaxiCash Config] Config envoyée au front:', response);

  return res.json(response);
});

// (Optionnel) Debug: front -> backend -> MaxiCash
router.post(
  '/debug-entry',
  express.urlencoded({ extended: true }),
  async (req, res) => {
    try {
      const payload = req.body || {};
      console.log('🧪 Debug MaxiCash - payload reçu du front:', payload);

      const env = process.env.MAXICASH_ENV || 'test';
      const paymentUrl =
        env === 'live'
          ? (process.env.MAXICASH_PAYMENT_URL_LIVE ||
              'https://api.maxicashapp.com/PayEntryPost')
          : (process.env.MAXICASH_PAYMENT_URL_TEST ||
              'https://api-testbed.maxicashapp.com/PayEntryPost');

      console.log('🧪 Posting to MaxiCash URL:', paymentUrl);

      const formData = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          formData.append(k, String(v));
        }
      });

      const mcRes = await fetch(paymentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      const mcText = await mcRes.text();
      console.log('🧪 Réponse MaxiCash status =', mcRes.status);
      res.status(mcRes.status).send(mcText);
    } catch (err) {
      console.error('❌ Erreur debug-entry MaxiCash:', err);
      res.status(500).send('Erreur debug MaxiCash');
    }
  }
);

module.exports = router;
