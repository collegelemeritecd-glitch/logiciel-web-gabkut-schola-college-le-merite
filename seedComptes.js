// =======================================================
// 🌐 PLAN COMPTABLE OHADA — CLASSES 1 à 7
// Version JavaScript propre, prête à importer
// =======================================================

const mongoose = require("mongoose");
const Compte = require("./models/comptable/Compte");



// 🔌 Connexion MongoDB (syntaxe correcte)
const MONGO_URL = "mongodb+srv://collegelemeritecd_db_user:iQFQEcn4JpB8UpFz@college-le-merite.fp5hzor.mongodb.net/collegelemerite?retryWrites=true&w=majority";


const planComptable = [

/* =======================================================
   CLASSE 1 — RESSOURCES DURABLES
======================================================= */
{
  numero: "1",
  classe: "1",
  intitule: "Ressources durables",
  rubriques: [
    {
      numero: "10",
      intitule: "Capital",
      comptes: [
        { numero: "101",  intitule: "Capital social" },
        { numero: "1011", intitule: "Capital souscrit, non appelé" },
        { numero: "1012", intitule: "Capital souscrit, appelé, non versé" },
        { numero: "1013", intitule: "Capital souscrit, appelé, versé, non amorti" },
        { numero: "1014", intitule: "Capital souscrit, appelé, versé, amorti" },
        { numero: "1018", intitule: "Capital soumis à conditions particulières" }
      ]
    },
    {
      numero: "102",
      intitule: "Capital par dotation",
      comptes: [
        { numero: "1021", intitule: "Dotation initiale" },
        { numero: "1022", intitule: "Dotations complémentaires" },
        { numero: "1028", intitule: "Autres dotations" }
      ]
    },
    {
      numero: "103",
      intitule: "Capital personnel",
      comptes: []
    },
    {
      numero: "104",
      intitule: "Compte de l'exploitant",
      comptes: [
        { numero: "1041", intitule: "Apports temporaires" },
        { numero: "1042", intitule: "Opérations courantes" },
        { numero: "1043", intitule: "Charges personnelles" },
        { numero: "1047", intitule: "Prélèvements autoconsommation" },
        { numero: "1048", intitule: "Autres prélèvements" }
      ]
    },
    {
      numero: "105",
      intitule: "Primes liées au capital",
      comptes: [
        { numero: "1051", intitule: "Primes d'émission" },
        { numero: "1052", intitule: "Primes d'apport" },
        { numero: "1053", intitule: "Primes de fusion" },
        { numero: "1054", intitule: "Primes de conversion" },
        { numero: "1058", intitule: "Autres primes" }
      ]
    },
    {
      numero: "106",
      intitule: "Écarts de réévaluation",
      comptes: [
        { numero: "1061", intitule: "Réévaluation légale" },
        { numero: "1062", intitule: "Réévaluation libre" }
      ]
    },
    { numero: "109", intitule: "Apporteurs, capital non appelé", comptes: [] },

    // 11 RÉSERVES
    {
      numero: "11",
      intitule: "Réserves",
      comptes: [
        { numero: "111", intitule: "Réserve légale" },
        { numero: "112", intitule: "Réserves statutaires" },
        { numero: "113", intitule: "Réserves réglementées" },
        { numero: "1131", intitule: "Réserves plus-values LT" },
        { numero: "1132", intitule: "Réserves attributions actions" },
        { numero: "1133", intitule: "Réserves subventions d’investissement" },
        { numero: "1134", intitule: "Réserves valeurs mobilières" },
        { numero: "1138", intitule: "Autres réserves réglementées" },
        { numero: "118", intitule: "Autres réserves" },
        { numero: "1181", intitule: "Réserves facultatives" },
        { numero: "1188", intitule: "Réserves diverses" }
      ]
    },

    // 12 REPORT À NOUVEAU
    {
      numero: "12",
      intitule: "Report à nouveau",
      comptes: [
        { numero: "121", intitule: "Report créditeur" },
        { numero: "129", intitule: "Report débiteur" },
        { numero: "1291", intitule: "Perte nette à reporter" },
        { numero: "1292", intitule: "Pertes amortissements différés" }
      ]
    },

    // 13 RÉSULTAT NET
    {
      numero: "13",
      intitule: "Résultat net",
      comptes: [
        { numero: "130", intitule: "Résultat en instance d’affectation" },
        { numero: "1301", intitule: "Résultat : bénéfice" },
        { numero: "1309", intitule: "Résultat : perte" },
        { numero: "131", intitule: "Résultat net : bénéfice" },
        { numero: "139", intitule: "Résultat net : perte" }
      ]
    },
    
    // 14 SUBVENTIONS D'INVESTISSEMENT
    {
      numero: "14",
      intitule: "Subventions d'investissement",
      comptes: [
        { numero: "141", intitule: "Subventions d'équipement" },
        { numero: "148", intitule: "Autres subventions d’investissement" }
      ]
    },

    // 15 PROVISIONS RÉGLEMENTÉES
    {
      numero: "15",
      intitule: "Provisions réglementées",
      comptes: [
        { numero: "151", intitule: "Amortissements dérogatoires" },
        { numero: "152", intitule: "Plus-values à réinvestir" },
        { numero: "153", intitule: "Fonds réglementés" },
        { numero: "154", intitule: "Provisions réévaluation" },
        { numero: "155", intitule: "Provisions sur immobilisations" },
        { numero: "156", intitule: "Provisions sur stocks" },
        { numero: "157", intitule: "Provisions pour investissement" },
        { numero: "158", intitule: "Autres provisions" }
      ]
    }
  ]
},

/* =======================================================
   CLASSE 2 — ACTIF IMMOBILISÉ
======================================================= */
{
  numero: "2",
  classe: "2",
  intitule: "Actif immobilisé",
  rubriques: [
    {
      numero: "21",
      intitule: "Immobilisations incorporelles",
      comptes: [
        { numero: "211", intitule: "Frais de développement" },
        { numero: "212", intitule: "Frais de recherche appliquée" },
        { numero: "213", intitule: "Brevets, licences, logiciels" },
        { numero: "214", intitule: "Marques" },
        { numero: "215", intitule: "Fonds commercial" },
        { numero: "216", intitule: "Droit au bail" },
        { numero: "217", intitule: "Franchises et concessions" },
        { numero: "218", intitule: "Autres immobilisations incorporelles" },
        { numero: "219", intitule: "Immobilisations incorporelles en cours" }
      ]
    },
    {
      numero: "22",
      intitule: "Terrains",
      comptes: [
        { numero: "221", intitule: "Terrains nus" },
        { numero: "222", intitule: "Terrains aménagés" },
        { numero: "223", intitule: "Terrains agricoles et forestiers" },
        { numero: "224", intitule: "Terrains bâtis" }
      ]
    },
    {
      numero: "23",
      intitule: "Bâtiments et installations",
      comptes: [
        { numero: "231", intitule: "Bâtiments administratifs" },
        { numero: "232", intitule: "Bâtiments scolaires" },
        { numero: "233", intitule: "Bâtiments industriels" },
        { numero: "234", intitule: "Ouvrages d’infrastructure" },
        { numero: "235", intitule: "Installations techniques" },
        { numero: "239", intitule: "Constructions en cours" }
      ]
    },
    {
      numero: "24",
      intitule: "Matériel, mobilier, actifs biologiques",
      comptes: [
        { numero: "241", intitule: "Matériel industriel" },
        { numero: "243", intitule: "Matériel informatique" },
        { numero: "244", intitule: "Matériel bureautique" },
        { numero: "245", intitule: "Matériel de transport" },
        { numero: "246", intitule: "Mobilier" },
        { numero: "247", intitule: "Matériel de sécurité" }
      ]
    },
    {
      numero: "25",
      intitule: "Avances et acomptes",
      comptes: [
        { numero: "251", intitule: "Avances immobilisations incorporelles" },
        { numero: "252", intitule: "Avances immobilisations corporelles" }
      ]
    },
    {
      numero: "26",
      intitule: "Immobilisations financières",
      comptes: [
        { numero: "261", intitule: "Titres de participation (groupe)" },
        { numero: "262", intitule: "Titres de participation (hors groupe)" },
        { numero: "263", intitule: "Participations organismes" }
      ]
    },
    {
      numero: "28",
      intitule: "Amortissements",
      comptes: [
        { numero: "2811", intitule: "Amortissement incorporels" },
        { numero: "2821", intitule: "Amortissements bâtiments" },
        { numero: "2833", intitule: "Amortissements informatique" },
        { numero: "2834", intitule: "Amortissements transport" }
      ]
    },
    {
      numero: "29",
      intitule: "Dépréciations",
      comptes: [
        { numero: "291", intitule: "Dépréciation incorporels" },
        { numero: "292", intitule: "Dépréciation terrains" },
        { numero: "293", intitule: "Dépréciation constructions" }
      ]
    }
  ]
},

/* =======================================================
   CLASSE 3 — STOCKS
======================================================= */
{
  numero: "3",
  classe: "3",
  intitule: "Stocks",
  comptes: [
    { numero: "311", intitule: "Marchandises" },
    { numero: "312", intitule: "Marchandises B" },
    { numero: "313", intitule: "Actifs biologiques" },
    { numero: "321", intitule: "Matières A" },
    { numero: "322", intitule: "Matières B" },
    { numero: "331", intitule: "Matières consommables" },
    { numero: "3351", intitule: "Emballages perdus" },
    { numero: "341", intitule: "Produits en cours" },
    { numero: "351", intitule: "Études en cours" },
    { numero: "361", intitule: "Produits finis" },
    { numero: "371", intitule: "Produits intermédiaires" },
    { numero: "381", intitule: "Marchandises en route" },
    { numero: "391", intitule: "Dépréciation stocks marchandises" },
    { numero: "398", intitule: "Dépréciations divers" }
  ]
},

/* =======================================================
   CLASSE 4 — COMPTES DE TIERS
======================================================= */
{
  numero: "4",
  classe: "4",
  intitule: "Comptes de tiers",
  comptes: [
    { numero: "40", intitule: "Fournisseurs" },
    { numero: "401", intitule: "Fournisseurs, dettes en compte" },
    { numero: "402", intitule: "Fournisseurs, effets à payer" },
    { numero: "404", intitule: "Fournisseurs, acquisitions courantes d'immobilisations" },
    { numero: "408", intitule: "Fournisseurs, factures non parvenues" },
    { numero: "409", intitule: "Fournisseurs débiteurs" },

    { numero: "41", intitule: "Clients" },
    { numero: "411", intitule: "Clients" },
    { numero: "412", intitule: "Clients, effets à recevoir" },
    { numero: "413", intitule: "Clients, chèques, effets et autres valeurs impayés" },
    { numero: "414", intitule: "Créances sur cession courantes d'immobilisation" },
    { numero: "415", intitule: "Clients, effets escomptés non échus" },
    { numero: "418", intitule: "Clients produits à recevoir" },
    { numero: "419", intitule: "Clients créditeurs" },
    
    { numero: "42", intitule: "Personnel" },
    { numero: "421", intitule: "Personnel avances et acomptes" },
    { numero: "422", intitule: "Personnel rémunérations dues" },

    { numero: "423", intitule: "Personnel; oppositions, saisies-arrêts" },
    { numero: "424", intitule: "Personnel; ouevres sociales internes" },
    { numero: "425", intitule: "Presentations du personnel" },
    { numero: "426", intitule: "Personnel; participations au capital" },
    { numero: "427", intitule: "Personnel - Dépôt" },
    { numero: "428", intitule: "Personnel; charges à payer, produit à reçevoir" },
     
    { numero: "43", intitule: "Organismes sociaux" },
    { numero: "431", intitule: "Sécurité sociale" },
    { numero: "441", intitule: "État impôt bénéfices" },
    { numero: "445", intitule: "TVA facturée" },
    { numero: "447", intitule: "Impôts retenus à la source" },
    { numero: "461", intitule: "Apporteurs" },
    { numero: "462", intitule: "Associés, comptes courants" },
    { numero: "471", intitule: "Débiteurs divers" },
    { numero: "472", intitule: "Créances sur titres" },
    { numero: "491", intitule: "Dépréciations clients" },
    { numero: "499", intitule: "Provisions risques tiers" }
  ]
},

/* =======================================================
   CLASSE 5 — TRÉSORERIE
======================================================= */
{
  numero: "5",
  classe: "5",
  intitule: "Trésorerie",
  comptes: [
    { numero: "501", intitule: "Titres Trésor CT" },
    { numero: "502", intitule: "Actions" },
    { numero: "503", intitule: "Obligations" },
    { numero: "504", intitule: "Bons souscription" },
    { numero: "511", intitule: "Effets à encaisser" },
    { numero: "512", intitule: "Chèques à encaisser" },

    { numero: "513", intitule: "Cartes crédit à encaisser" },
    { numero: "521", intitule: "Banques locales" },
    { numero: "523", intitule: "Banques zone monétaire" },
    { numero: "526", intitule: "Dépôts à terme" },
    { numero: "531", intitule: "Chèques postaux" },
    { numero: "533", intitule: "SGI" },
    { numero: "541", intitule: "Options taux intérêt" },
    { numero: "554", intitule: "Porte-monnaie électronique" },
    { numero: "561", intitule: "Crédits trésorerie" },
    { numero: "571", intitule: "Caisse siège social" },
    { numero: "572", intitule: "Caisse succursale A" },
    { numero: "573", intitule: "Caisse succursale B" },
    { numero: "581", intitule: "Régies d'avance" },
    { numero: "585", intitule: "Virements internes" },
    { numero: "591", intitule: "Dépréciations titres placement" }
  ]
},

/* =======================================================
   CLASSE 6 — CHARGES
======================================================= */
/* =======================================================
   CLASSE 6 — CHARGES
======================================================= */
{
  numero: "6",
  classe: "6",
  intitule: "Charges des activités ordinaires",
  rubriques: [
    {
      numero: "60",
      intitule: "Achats et variations de stocks",
      comptes: [
        { numero: "601", intitule: "Achats marchandises" },
        { numero: "602", intitule: "Achats de matières premières et fournitures liées" },
        { numero: "603", intitule: "Variation de stock des biens achetés" },
        { numero: "604", intitule: "Achats stockés de matières et fournitures consommables" },
        { numero: "605", intitule: "Autres achats" },
        { numero: "608", intitule: "Achats d'emballages" }
      ]
    },
    {
      numero: "61",
      intitule: "Transports",
      comptes: [
        { numero: "611", intitule: "Transports sur achats" },
        { numero: "612", intitule: "Transports sur ventes" },
        { numero: "613", intitule: "Transports pour le compte de tiers" },
        { numero: "614", intitule: "Transports du personnel" },
        { numero: "616", intitule: "Transports de plis" },
        { numero: "618", intitule: "Autres frais de Transports" },
        { numero: "6181", intitule: "Voyages et déplacements" },
        { numero: "6182", intitule: "Transport inter établissements" },
        { numero: "6183", intitule: "Transports administratifs" }
      ]
    },
    {
      numero: "62",
      intitule: "Services extérieurs",
      comptes: [
        { numero: "621", intitule: "Sous-traitance" },
        { numero: "622", intitule: "Locations et charges locatives" },
        { numero: "623", intitule: "Redevance de location acquisition" },
        { numero: "624", intitule: "Entretien et maintenance" },
        { numero: "625", intitule: "Primes d'assurance" },
        { numero: "626", intitule: "Étude, Recherche et Documentation" },
        { numero: "627", intitule: "Publicité et Relations Publiques" },
        { numero: "628", intitule: "Frais de télécommunications" },
        { numero: "6224", intitule: "Malis sur emballages" },
        { numero: "6225", intitule: "Location d'emballages" },
        { numero: "6226", intitule: "Fermages et loyers du foncier" },
        { numero: "6228", intitule: "Locations diverses" }
      ]
    },
    {
      numero: "63",
      intitule: "Autres services extérieurs",
      comptes: [
        { numero: "631", intitule: "Frais bancaires" },
        { numero: "632", intitule: "Rémunération d’intermédiaires et conseils" },
        { numero: "633", intitule: "Frais de formation du personnel" },
        { numero: "634", intitule: "Redevances pour brevets, licences, logiciels" },
        { numero: "635", intitule: "Cotisations" },
        { numero: "637", intitule: "Personnel extérieur" },
        { numero: "638", intitule: "Autres charges externes" },
        { numero: "6381", intitule: "Frais de recrutement" },
        { numero: "6382", intitule: "Frais de déménagement" },
        { numero: "6383", intitule: "Réceptions" },
        { numero: "6384", intitule: "Missions" },
        { numero: "6385", intitule: "Charges de copropriété" }
      ]
    },
    {
      numero: "64",
      intitule: "Impôts et taxes",
      comptes: [
        { numero: "641", intitule: "Impôts et taxes directs" },
        { numero: "6411", intitule: "Impôts fonciers" },
        { numero: "6412", intitule: "Patentes et licences" },
        { numero: "6413", intitule: "Taxes sur salaires" },
        { numero: "6414", intitule: "Taxes d’apprentissage" },
        { numero: "6415", intitule: "Formation professionnelle" },
        { numero: "645", intitule: "Impôts indirects" },
        { numero: "646", intitule: "Droits d’enregistrement" },
        { numero: "6461", intitule: "Droits de mutation" },
        { numero: "6464", intitule: "Vignettes" },
        { numero: "647", intitule: "Pénalités fiscales" },
        { numero: "648", intitule: "Autres impôts et taxes" }
      ]
    },
    {
      numero: "65",
      intitule: "Autres charges",
      comptes: [
        { numero: "651", intitule: "Pertes sur créances" },
        { numero: "656", intitule: "Perte de change" },
        { numero: "657", intitule: "Pénalités" },
        { numero: "658", intitule: "Charges diverses" },
        { numero: "6582", intitule: "Dons" },
        { numero: "6583", intitule: "Mécénat" }
      ]
    },
    {
      numero: "66",
      intitule: "Charges du personnel",
      comptes: [
        { numero: "661", intitule: "Rémunérations personnel national" },
        { numero: "662", intitule: "Rémunérations personnel non national" },
        { numero: "663", intitule: "Indemnités" },
        { numero: "664", intitule: "Charges sociales" },
        { numero: "667", intitule: "Personnel extérieur" },
        { numero: "668", intitule: "Autres charges sociales" }
      ]
    },
    {
      numero: "67",
      intitule: "Charges financières",
      comptes: [
        { numero: "671", intitule: "Intérêts emprunts" },
        { numero: "672", intitule: "Intérêts location acquisition" },
        { numero: "673", intitule: "Escomptes accordés" },
        { numero: "674", intitule: "Autres intérêts" },
        { numero: "676", intitule: "Pertes de change" }
      ]
    },
    {
  numero: "68",
  intitule: "Dotations aux amortissements et provisions",
  comptes: [
    { numero: "6811", intitule: "Dotations aux amortissements des immobilisations en cours" },
    { numero: "6812", intitule: "Dotations aux amortissements des immobilisations incorporelles" },
    { numero: "6813", intitule: "Dotations aux amortissements des immobilisations corporelles" },
    { numero: "6861", intitule: "Dotations aux amortissements d'exploitation à caractère financier" },
    { numero: "6871", intitule: "Dotations aux amortissements à caractère exceptionnel" }
  ]
},
{
  numero: "69",
  intitule: "Participation des salariés – Impôts sur le résultat",
  comptes: [
    { numero: "691", intitule: "Participation des salariés aux résultats" },
    { numero: "695", intitule: "Impôts sur les bénéfices" },
    { numero: "699", intitule: "Produits des reports en arrière de déficits" }
  ]
}

  ]
},


/* =======================================================
   CLASSE 7 — PRODUITS (VERSION PRO)
======================================================= */
/* =======================================================
   CLASSE 7 — PRODUITS
======================================================= */
{
  numero: "7",
  classe: "7",
  intitule: "Produits des activités ordinaires",
  rubriques: [

    /* ------------------------------
       70 — VENTES
    ------------------------------ */
    {
      numero: "70",
      intitule: "Ventes",
      comptes: [
        { numero: "701", intitule: "Ventes marchandises" },
        { numero: "702", intitule: "Ventes produits finis" },
        { numero: "703", intitule: "Ventes produits intermédiaires" },
        { numero: "704", intitule: "Ventes produits résiduels" },
        { numero: "705", intitule: "Travaux facturés" },
        { numero: "706", intitule: "Services vendus" },
        { numero: "707", intitule: "Produits accessoires" }
      ]
    },

    /* ------------------------------
       71 — SUBVENTIONS D’EXPLOITATION
    ------------------------------ */
    {
      numero: "71",
      intitule: "Subventions d'exploitation",
      comptes: [
        { numero: "711", intitule: "Subventions sur produits à l'exportation" },
        { numero: "712", intitule: "Subventions sur produits à l'importation" },
        { numero: "713", intitule: "Subventions de péréquation" },
        { numero: "714", intitule: "Indemnités et subventions d’exploitation" },
        { numero: "718", intitule: "Autres subventions d'exploitation" },
        { numero: "7181", intitule: "Versées par l'État et collectivités" },
        { numero: "7182", intitule: "Versées par organismes internationaux" },
        { numero: "7183", intitule: "Versées par les tiers" }
      ]
    },

    /* ------------------------------
       72 — PRODUCTION IMMOBILISÉE
    ------------------------------ */
    {
      numero: "72",
      intitule: "Production immobilisée",
      comptes: [
        { numero: "721", intitule: "Production immobilisations incorporelles" },
        { numero: "722", intitule: "Production immobilisations corporelles" }
      ]
    },

    /* ------------------------------
       73 — VARIATIONS DE STOCK
    ------------------------------ */
    {
      numero: "73",
      intitule: "Variations de stocks",
      comptes: [
        { numero: "734", intitule: "Variation produits en cours" },
        { numero: "7341", intitule: "Produits en cours" },
        { numero: "7342", intitule: "Travaux en cours" },
        { numero: "736", intitule: "Variation stock produits finis" },
        { numero: "737", intitule: "Variation stock produits intermédiaires et résiduels" }
      ]
    },

    /* ------------------------------
       75 — AUTRES PRODUITS
    ------------------------------ */
    {
      numero: "75",
      intitule: "Autres produits",
      comptes: [
        { numero: "751", intitule: "Profits sur créances clients et autres débiteurs" },
        { numero: "752", intitule: "Quote-part de résultats opérations en commun" }
      ]
    },

    /* ------------------------------
       77 — PRODUITS FINANCIERS
    ------------------------------ */
    {
      numero: "77",
      intitule: "Revenus financiers et produits assimilés",
      comptes: [
        { numero: "771", intitule: "Intérêts de prêts et créances diverses" },
        { numero: "772", intitule: "Revenus participations et titres immobilisés" },
        { numero: "773", intitule: "Escomptes obtenus" },
        { numero: "774", intitule: "Revenus de placement" },
        { numero: "775", intitule: "Intérêts sur contrats de location acquisition" },
        { numero: "776", intitule: "Gains de change financiers" },
        { numero: "777", intitule: "Gains sur cession titres placement" },
        { numero: "778", intitule: "Gains sur risques financiers" },
        { numero: "779", intitule: "Reprises provisions financières CT" }
      ]
    },

    /* ------------------------------
       78 — TRANSFERT DE CHARGES
    ------------------------------ */
    {
      numero: "78",
      intitule: "Transferts de charges",
      comptes: [
        { numero: "781", intitule: "Transferts charges d'exploitation" },
        { numero: "787", intitule: "Transferts charges financières" }
      ]
    },

    /* ------------------------------
       79 — REPRISES DE PROVISIONS
    ------------------------------ */
    {
      numero: "79",
      intitule: "Reprise de provisions et dépréciations",
      comptes: [
        { numero: "791", intitule: "Reprise de provisions d'exploitation" },
        { numero: "797", intitule: "Reprise provisions financières" },
        { numero: "798", intitule: "Reprise d’amortissements" },
        { numero: "799", intitule: "Reprise de subventions d'investissement" }
      ]
    }

  ]
}


];

// ======================================================================
// 🔍 EXTRACTION DES COMPTES INDIVIDUELS POUR LE JOURNAL (flat list)
// ======================================================================
function extractFlatComptes(plan) {
  const comptes = [];

  for (const classe of plan) {
    // classes avec rubriques (1,2,6,7)
    if (classe.rubriques) {
      for (const rub of classe.rubriques) {
        if (rub.comptes && rub.comptes.length > 0) {
          for (const c of rub.comptes) {
            comptes.push({
              numero: c.numero,
              intitule: c.intitule,
            });
          }
        }
      }
    }

    // classes avec comptes directs (3,4,5)
    if (classe.comptes && classe.comptes.length > 0) {
      for (const c of classe.comptes) {
        comptes.push({
          numero: c.numero,
          intitule: c.intitule,
        });
      }
    }
  }

  return comptes;
}

// ======================================================================
// 🚀 SEED — VERSION OPTION 1 (Uniquement Compte.js)
// ======================================================================
async function seed() {
  try {
    console.log("🔌 Connexion à MongoDB…");
    await mongoose.connect(MONGO_URL);

    console.log("🔍 Extraction des comptes individuels du plan OHADA…");
    const comptesFlat = extractFlatComptes(planComptable);

    console.log("🗑 Suppression des anciens comptes (Compte.js)...");
    await Compte.deleteMany();

    console.log(`📝 Insertion de ${comptesFlat.length} comptes…`);
    await Compte.insertMany(comptesFlat);

    console.log("🎉 SEED TERMINÉ — VERSION LÉGÈRE (Compte.js uniquement)");
    process.exit();
  } catch (err) {
    console.error("❌ ERREUR SEED :", err);
    process.exit(1);
  }
}

seed();

// ======================================================================
// EXPORT
// ======================================================================
module.exports = planComptable;