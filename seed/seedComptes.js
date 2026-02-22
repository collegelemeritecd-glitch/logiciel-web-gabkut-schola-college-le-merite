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
        { numero: "6011", intitule: "Dans la region (1) (Achats marchandises)" },
        { numero: "6012", intitule: "Hors region (1) (Achats marchandises)" },
        { numero: "6013", intitule: "Aux entités du groupe dans la region (Achats marchandises)" },
        { numero: "6014", intitule: "Aux entités du groupe Hors region (Achats marchandises)" },
        { numero: "6015", intitule: "Frais sur achats (2) (Achats marchandises)" },
        { numero: "6019", intitule: "Rabais, Remises et ristournes obtenus (non ventilés) (Achats marchandises)" },
        

        { numero: "602", intitule: "Achats de matières premières et fournitures liées" },
        { numero: "6021", intitule: "Dans la region (1) (Achats de matières premières et fournitures liées)" },
        { numero: "6022", intitule: "Hors region (1) (Achats de matières premières et fournitures liées)" },
        { numero: "6023", intitule: "Aux entités du groupe dans la region (Achats de matières premières et fournitures liées)" },
        { numero: "6024", intitule: "Aux entités du groupe hors region (Achats de matières premières et fournitures liées)" },
        { numero: "6025", intitule: "Frais sur achats (2) (Achats de matières premières et fournitures liées)" },
        { numero: "6029", intitule: "Rabais, Remises et ristournes obtenus (non ventilés) (Achats de matières premières et fournitures liées)" },


        { numero: "603", intitule: "Variations des stocks des biens achetés" },
        { numero: "6031", intitule: "Variations des stocks des marchandises" },
        { numero: "6032", intitule: "Variations des stocks de matières premières et fournitures liées" },
        { numero: "6033", intitule: "Variations des stocks d'autres approvisionnements'" },



        { numero: "604", intitule: "Achats stockés de matières et fournitures consommables" },
        { numero: "6041", intitule: "Matières consommables" },
        { numero: "6042", intitule: "Matières combustibles" },
        { numero: "6043", intitule: "Produits d'entretien" },
        { numero: "6044", intitule: "Fournitures d'atelier et d'usine" },
        { numero: "6045", intitule: "frais sur achats (Achats stockés de matières et fournitures consommables)" },
        { numero: "6046", intitule: "Fournitures de magasin" },
        { numero: "6047", intitule: "Fournitures de bureau" },
        { numero: "6049", intitule: "Rabais, Remises et ristournes obtenus (non ventilés) (Achats stockés de matières et fournitures consommables)" },



        { numero: "605", intitule: "Autres achats" },
        { numero: "6051", intitule: "Fournitures non stockables-Eau" },
        { numero: "6052", intitule: "Fournitures non stockables-Electricité" },
        { numero: "6053", intitule: "Fournitures non stockables-Autres énergies" },
        { numero: "6054", intitule: "Fournitures d'entretien non stockables" },
        { numero: "6055", intitule: "Fournitures de bureau non stockables" },
        { numero: "6056", intitule: "Achats de petit matériel et outillage" },
        { numero: "6058", intitule: "Achats de trauvaux, matériels et équipements" },
        { numero: "6059", intitule: "Rabais, Remises et ristournes obtenus (non ventilés) (Autres achats)" },



        { numero: "608", intitule: "Achats d'emballages" },
        { numero: "6081", intitule: "Emballages perdus" },
        { numero: "6082", intitule: "Emballages récupérables non identifiables" },
        { numero: "6083", intitule: "Emballages à usages mixte" },
        { numero: "6085", intitule: "Frais sur achats (Achats d'emballages)" },
        { numero: "6089", intitule: "Rabais, Remises et Ristournes obtenus (non ventilé) (Autres achats)" }
      ]
    },
    {
      numero: "61",
      intitule: "Transports",
      comptes: [
        { numero: "612", intitule: "Transports sur achats" },
        { numero: "613", intitule: "Transports pour le compte de tiers" },
        { numero: "614", intitule: "Transports du personnel" },
        { numero: "616", intitule: "Transports de plis" },
        { numero: "618", intitule: "Autres frais de Transports " },
        { numero: "6181", intitule: "Voyages et déplacements (Autres frais de transport)" },
        { numero: "6182", intitule: "Transport inter établissements (Autres frais de transport)" },
        { numero: "6183", intitule: "Transports administratifs (Autres frais de transport)" }
      ]
    },
    {
      numero: "62",
      intitule: "Services extérieurs",
      comptes: [
        { numero: "621", intitule: "Sous-traitance Générale" },
        { numero: "622", intitule: "Locations et charges locatives" },
        { numero: "6221", intitule: "Locations de terrains" },
        { numero: "6222", intitule: "Locations de bâtiments" },
        { numero: "6223", intitule: "Locations de matériels et outillages" },
        { numero: "6224", intitule: "Malis sur emballages" },
        { numero: "6225", intitule: "Locations d'emballages" },
        { numero: "6226", intitule: "Fermages et loyers du foncier" },
        { numero: "6228", intitule: "Locations et charges locatives diverses" },
        



        { numero: "623", intitule: "Redevance de location acquisition" },
        { numero: "6232", intitule: "Contrat-bail immobilier" },
        { numero: "6233", intitule: "Contrat-bail mobilier" },
        { numero: "62324", intitule: "Location vente" },
        { numero: "6238", intitule: "Autres contrats de location acquisition" },



        { numero: "624", intitule: "Entretien, Réparations, Rémise en état et maintenance" },
        { numero: "6241", intitule: "Entretien et Réparations des biens immobiliers" },
        { numero: "6242", intitule: "Entretien et Réparations des biens mobiliers" },
        { numero: "6243", intitule: "Maintenance" },
        { numero: "6244", intitule: "Charge de démentèlement et remise en état" },
        { numero: "6248", intitule: "Autres entretiens et réparations" },




        { numero: "625", intitule: "Primes d'assurance" },
        { numero: "6251", intitule: "Assurances multirisques" },
        { numero: "6252", intitule: "Assurances matériel de transport" },
        { numero: "6253", intitule: "Assurances risques d'éxploitation" },
        { numero: "6254", intitule: "Assurances responsabilités du producteur" },
        { numero: "6255", intitule: "Assurances insolvabilité clients" },
        { numero: "6257", intitule: "Assurances transport sur ventes" },
        { numero: "6258", intitule: "Autres primes d'assurances" },




        { numero: "626", intitule: "Étude, Recherche et Documentation" },


        { numero: "627", intitule: "Publicité, publication, Relations Publiques" },
        { numero: "6271", intitule: "Annonces, insertions" },
        { numero: "6272", intitule: "Catalogies, imprimés publicitaires" },
        { numero: "6273", intitule: "Echantillons" },
        { numero: "6274", intitule: "Foires et expositions" },
        { numero: "6275", intitule: "Publications" },
        { numero: "6276", intitule: "Cadeaux à la clientèle" },
        { numero: "6277", intitule: "Frais de colloque, séminaires, conférences" },
        { numero: "6278", intitule: "Autres charges de publicité et relations publiques" },




        { numero: "628", intitule: "Frais de télécommunications" },
        { numero: "6281", intitule: "Frais de téléphone" },
        { numero: "6282", intitule: "Frais de téléx" },
        { numero: "6283", intitule: "Frais de télécopie" },
        { numero: "6288", intitule: "Autres frais de télécommunications" }



        
      ]
    },
    {
      numero: "63",
      intitule: "Autres services extérieurs",
      comptes: [
        { numero: "631", intitule: "Frais bancaires" },
        { numero: "6311", intitule: "Frais sur terrain (ventes, garde) (frais bancaires)" },
        { numero: "6312", intitule: "Frais sur effets (Frais bancaires)" },
        { numero: "6313", intitule: "Locaton de coffres (Frais bancaires)" },
        { numero: "6314", intitule: "Commissions d'affacturage (Frais bancaires)" },
        { numero: "6315", intitule: "Commissions sur cartes de crédit (Frais bancaires)" },
        { numero: "6316", intitule: "Frais d'émissions d'emprunts (Frais bancaires)" },
        { numero: "6318", intitule: "Autres frais bancaires" },



        { numero: "632", intitule: "Rémunération d’intermédiaires et conseils" },
        { numero: "6322", intitule: "Commisions et courtages sur ventes" },
        { numero: "6324", intitule: "Honoraires des professions règlementées" },
        { numero: "6325", intitule: "Frais d'actes et de contentieux" },
        { numero: "6326", intitule: "Rémunérations des autres prestataires de services" },
        { numero: "6328", intitule: "Divers frais" },



        { numero: "633", intitule: "Frais de formation du personnel" },
        { numero: "634", intitule: "Redevances pour brevets, licences, logiciels" },

        { numero: "635", intitule: "Cotisations" },
        { numero: "637", intitule: "Rémunérations de personnel exterieurs à l'entreprise" },
        { numero: "6371", intitule: "Personnel intérimaire" },
        { numero: "6372", intitule: "Personnel détaché ou prêté à l'éntité" },


        { numero: "638", intitule: "Autres charges externes" },
        { numero: "6381", intitule: "Frais de recrutement du personnel" },
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
        { numero: "6411", intitule: "Impôts fonciers et taxes annexes" },
        { numero: "6412", intitule: "Patentes, licences et taxes annexes" },
        { numero: "6413", intitule: "Taxes sur appontements et salaires" },
        { numero: "6414", intitule: "Taxes d’apprentissage" },
        { numero: "6415", intitule: "Formation professionnelle continue" },
        { numero: "6418", intitule: "Autres imp$ots et taxes directs" },

        { numero: "645", intitule: "Impôts indirects" },

        { numero: "646", intitule: "Droits d’enregistrement" },
        { numero: "6461", intitule: "Droits de mutation" },
        { numero: "6462", intitule: "Droits de timbre" },
        { numero: "6463", intitule: "Taxes sur les véhicules de société" },
        { numero: "6464", intitule: "Vignettes" },
        { numero: "6468", intitule: "Autres droits" }
      ]
    },
    {
      numero: "65",
      intitule: "Autres charges",
      comptes: [
        { numero: "651", intitule: "Pertes sur créances clients et autres débiteurs" },
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