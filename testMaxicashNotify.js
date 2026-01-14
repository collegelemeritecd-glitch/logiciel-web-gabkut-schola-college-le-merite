// testMaxicashNotify.js
// ⚠️ À lancer APRÈS avoir créé une intention "pending" via le formulaire public.

const http = require('http');
const querystring = require('querystring');

// Matricule utilisé pour le test (doit avoir une intention "pending")
const ELEVE_MATRICULE_TEST = '19732-NKK';

// Config API backend pour aller lire l'intention
const API_HOST = 'localhost';
const API_PORT = 8080;

// Utilitaires simples pour faire des requêtes HTTP
function httpGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path,
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          resolve({ statusCode: res.statusCode, body: json });
        } catch (e) {
          console.error('❌ Erreur parse JSON GET', e.message);
          console.error('Réponse brute:', data);
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}

function httpPostForm(path, payload) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify(payload);

    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', (e) => reject(e));

    req.write(postData);
    req.end();
  });
}

// 1) Aller chercher la dernière intention PENDING pour ce matricule
async function getDerniereIntention(referenceMatricule) {
  // Route debug à exposer côté backend :
  // GET /api/debug/intention-derniere?reference=19732-NKK
  // => findOne({ reference, status: 'pending' }).sort({ createdAt: -1 })
  const path =
    `/api/debug/intention-derniere?reference=${encodeURIComponent(
      referenceMatricule
    )}`;

  console.log('🔎 Récupération de la dernière intention via', path);

  const { statusCode, body } = await httpGet(path);

  if (statusCode !== 200 || !body.success || !body.intention) {
    throw new Error(
      `Aucune intention 'pending' trouvée pour ${referenceMatricule}. Réponse: ${JSON.stringify(
        body
      )}`
    );
  }

  return body.intention;
}

// 2) Construire et envoyer le webhook de test à partir de l’intention
async function envoyerWebhookTest() {
  try {
    const intention = await getDerniereIntention(ELEVE_MATRICULE_TEST);

    console.log('✅ Intention utilisée pour le test :');
    console.log({
      reference: intention.reference,
      montant: intention.montant,
      mois: intention.mois,
      devise: intention.devise,
      status: intention.status,
      createdAt: intention.createdAt,
    });

    const montant = Number(intention.montant || 0);
    if (!Number.isFinite(montant) || montant <= 0) {
      throw new Error(
        `Montant d'intention invalide: ${intention.montant} pour ${ELEVE_MATRICULE_TEST}`
      );
    }

    // Maxicash envoie des cents => on convertit
    const amountCents = Math.round(montant * 100);

    const payload = {
      MerchantID:
        process.env.MAXICASH_MERCHANT_ID ||
        '0625caf71ffc4657976545fd9d3e3d47',
      MerchantPassword:
        process.env.MAXICASH_MERCHANT_PASS ||
        '727ddceec6d5436ea5e8fa8a8869c4d7',

      // Reference = même clé que l’intention (ici matricule)
      Reference: intention.reference,

      Amount: String(amountCents),
      Currency: intention.devise || 'USD',
      Status: 'success',
      ResponseStatus: 'success',
      ResponseError: '',
      TransactionID: `TEST-TX-${Date.now()}`,

      Telephone: intention.telephonePayer || '+243822783500',
      Email: intention.emailPayer || 'test-paiement@example.com',
    };

    console.log(
      '🔄 Envoi du webhook de TEST vers http://localhost:8080/api/maxicash'
    );
    console.log('Payload webhook simulé :', payload);

    const result = await httpPostForm('/api/maxicash', payload);

    console.log('➡️  Status:', result.statusCode);
    console.log('➡️  Body:', result.body);
  } catch (e) {
    console.error('❌ Erreur envoi webhook de test:', e.message);
  }
}

// Lancer le script
envoyerWebhookTest();
