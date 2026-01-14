// routes/public.routes.js
const router = require("express").Router();

router.get("/maxicash-config", (req, res) => {
  const isProd = process.env.NODE_ENV === "production";

  const paymentUrl = isProd
    ? "https://api.maxicashapp.com/PayEntryPost"
    : "https://api-testbed.maxicashapp.com/PayEntryPost";

  return res.json({
    success: true,
    paymentUrl,
    merchantId: process.env.MAXICASH_MERCHANT_ID,
    merchantPass: process.env.MAXICASH_MERCHANT_PASSWORD,
    accepturl: `${process.env.PROD_BASE_URL}/paiement/maxicash/success`,
    declineurl: `${process.env.PROD_BASE_URL}/paiement/maxicash/failed`,
    cancelurl: `${process.env.PROD_BASE_URL}/paiement/maxicash/cancel`,
    notifyurl: `${process.env.HOST}/api/webhooks/maxicash-notify`
  });
});

module.exports = router;
